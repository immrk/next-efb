import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { networkInterfaces } from 'node:os'
import type {
  ChartAssetPayload,
  ChartImportFromUrlInput,
  ChartImportResult,
  ChartRecord,
  ChartUpdateInput,
  FinalizeChartImportInput,
  GeoReferencePoint
} from '@shared/chart-types'
import type {
  AircraftState,
  AppSettings,
  ConnectionState,
  RemoteAccessStatus
} from '@shared/types'
import type {
  BuildFlightPlanInput,
  SimBriefImportInput
} from '@shared/flight-plan-types'
import type { NavMapQueryInput } from '@shared/nav-map-types'
import { WebSocket, WebSocketServer } from 'ws'
import { SettingsStore } from '../config/SettingsStore'
import { SimConnectService } from '../simconnect/SimConnectService'
import { FlightStateStore } from '../state/FlightStateStore'
import { ChartRepository } from '../storage/ChartRepository'
import { StorageService } from '../storage/StorageService'
import { RemoteChartImportService } from '../storage/RemoteChartImportService'
import { NavDataService } from '../navigation/NavDataService'

interface LanServerOptions {
  settings: AppSettings
  rendererRoot: string
  flightStateStore: FlightStateStore
  settingsStore: SettingsStore
  simConnectService: SimConnectService
  chartRepository: ChartRepository
  storageService: StorageService
  navDataService: NavDataService
}

type ServerEvent =
  | { type: 'aircraft:update'; payload: AircraftState }
  | { type: 'connection:update'; payload: ConnectionState }
  | { type: 'chart:changed' }
  | { type: 'settings:changed' }

export class LanServer {
  private settings: AppSettings
  private readonly rendererRoot: string
  private readonly flightStateStore: FlightStateStore
  private readonly settingsStore: SettingsStore
  private readonly simConnectService: SimConnectService
  private readonly chartRepository: ChartRepository
  private readonly storageService: StorageService
  private readonly remoteChartImportService: RemoteChartImportService
  private readonly navDataService: NavDataService
  private server: ReturnType<typeof createServer> | null = null
  private readonly wsServer = new WebSocketServer({ noServer: true })
  private readonly sockets = new Set<WebSocket>()

  constructor(options: LanServerOptions) {
    this.settings = options.settings
    this.rendererRoot = options.rendererRoot
    this.flightStateStore = options.flightStateStore
    this.settingsStore = options.settingsStore
    this.simConnectService = options.simConnectService
    this.chartRepository = options.chartRepository
    this.storageService = options.storageService
    this.remoteChartImportService = new RemoteChartImportService()
    this.navDataService = options.navDataService
  }

  async start(): Promise<void> {
    if (!this.settings.lanAccess.enabled || this.server) {
      return
    }

    this.server = createServer((request, response) => {
      void this.handleRequest(request, response)
    })

    this.server.on('upgrade', (request, socket, head) => {
      if (!this.isAuthorized(request)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/ws') {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
        socket.destroy()
        return
      }

      this.wsServer.handleUpgrade(request, socket, head, (ws) => {
        this.sockets.add(ws)
        ws.on('close', () => this.sockets.delete(ws))
      })
    })

    await new Promise<void>((resolvePromise, reject) => {
      this.server?.once('error', reject)
      this.server?.listen(this.settings.lanAccess.port, '0.0.0.0', () => {
        this.server?.off('error', reject)
        resolvePromise()
      })
    })
  }

  async stop(): Promise<void> {
    this.sockets.forEach((socket) => socket.close())
    this.sockets.clear()

    if (!this.server) {
      return
    }

    const current = this.server
    this.server = null
    await new Promise<void>((resolvePromise, reject) => {
      current.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolvePromise()
      })
    })
  }

  async reconfigure(settings: AppSettings): Promise<void> {
    const shouldRestart =
      Boolean(this.server) !== settings.lanAccess.enabled ||
      this.settings.lanAccess.port !== settings.lanAccess.port ||
      this.settings.lanAccess.authEnabled !== settings.lanAccess.authEnabled ||
      this.settings.lanAccess.authToken !== settings.lanAccess.authToken

    this.settings = settings

    if (shouldRestart) {
      await this.stop()
      await this.start()
    }
  }

  getStatus(): RemoteAccessStatus {
    const accessUrls = this.server
      ? getLanAccessUrls(
          this.settings.lanAccess.port,
          this.settings.lanAccess.authEnabled ? this.settings.lanAccess.authToken : ''
        )
      : []

    return {
      enabled: this.settings.lanAccess.enabled,
      running: Boolean(this.server),
      port: this.settings.lanAccess.port,
      primaryAccessUrl: accessUrls[0] ?? null,
      accessUrls
    }
  }

  broadcastAircraftState(state: AircraftState): void {
    this.flightStateStore.setAircraftState(state)
    this.broadcast({ type: 'aircraft:update', payload: state })
  }

  broadcastConnectionState(state: ConnectionState): void {
    this.flightStateStore.setConnectionState(state)
    this.broadcast({ type: 'connection:update', payload: state })
  }

  broadcastChartChanged(): void {
    this.broadcast({ type: 'chart:changed' })
  }

  broadcastSettingsChanged(): void {
    this.broadcast({ type: 'settings:changed' })
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')

      if (url.pathname === '/api/health') {
        this.sendJson(response, {
          ok: true,
          running: Boolean(this.server)
        })
        return
      }

      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/charts/')) {
        if (!this.isAuthorized(request)) {
          this.sendJson(response, { error: 'UNAUTHORIZED' }, 401)
          return
        }
      }

      if (url.pathname === '/api/snapshot') {
        this.sendJson(response, {
          aircraft: this.flightStateStore.getAircraftState(),
          connection: this.flightStateStore.getConnectionState()
        })
        return
      }

      if (url.pathname === '/api/settings') {
        if (request.method === 'PATCH') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          const partial = (await this.readJsonBody(request)) as Partial<AppSettings>
          const nextSettings = this.settingsStore.update(partial)
          this.settings = nextSettings
          this.simConnectService.reconfigure(nextSettings)
          await this.reconfigure(nextSettings)
          this.broadcastSettingsChanged()
          this.sendJson(response, sanitizeSettings(nextSettings))
          return
        }

        this.sendJson(response, sanitizeSettings(this.settings))
        return
      }

      if (url.pathname === '/api/nav/status') {
        this.sendJson(response, this.navDataService.getStatus(this.settingsStore.get()))
        return
      }

      if (url.pathname === '/api/nav/airports') {
        const query = url.searchParams.get('query') ?? ''
        this.sendJson(response, this.navDataService.searchAirports(this.settingsStore.get(), query))
        return
      }

      const navProceduresMatch = url.pathname.match(/^\/api\/nav\/airport\/([^/]+)\/procedures$/)
      if (navProceduresMatch) {
        this.sendJson(
          response,
          this.navDataService.getAirportProcedures(this.settingsStore.get(), navProceduresMatch[1] ?? '')
        )
        return
      }

      if (url.pathname === '/api/nav/plan' && request.method === 'POST') {
        const input = (await this.readJsonBody(request)) as BuildFlightPlanInput
        this.sendJson(response, this.navDataService.buildFlightPlan(this.settingsStore.get(), input))
        return
      }

      if (url.pathname === '/api/nav/map-features' && request.method === 'POST') {
        const input = (await this.readJsonBody(request)) as NavMapQueryInput
        this.sendJson(response, this.navDataService.getMapFeatures(this.settingsStore.get(), input))
        return
      }

      if (url.pathname === '/api/simbrief/import' && request.method === 'POST') {
        const input = (await this.readJsonBody(request)) as SimBriefImportInput
        this.sendJson(
          response,
          await this.navDataService.importFromSimBrief({
            username: input.username ?? this.settingsStore.get().simbrief.username,
            userId: input.userId ?? this.settingsStore.get().simbrief.userId
          })
        )
        return
      }

      if (url.pathname === '/api/storage-summary') {
        this.sendJson(response, this.storageService.getSummary())
        return
      }

      if (url.pathname === '/api/charts') {
        if (request.method === 'POST') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          const input = (await this.readJsonBody(request)) as FinalizeChartImportInput
          const result = this.finalizeChartImport(input)
          this.sendJson(response, result, 201)
          return
        }

        this.sendJson(response, this.chartRepository.listCharts())
        return
      }

      if (url.pathname === '/api/charts/import-from-url' && request.method === 'POST') {
        if (!this.ensureWriteEnabled(response)) {
          return
        }
        const input = (await this.readJsonBody(request)) as ChartImportFromUrlInput
        this.sendJson(response, await this.remoteChartImportService.download(input.url), 201)
        return
      }

      const chartMatch = url.pathname.match(/^\/api\/charts\/([^/]+)$/)
      if (chartMatch) {
        if (request.method === 'PATCH') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          const input = (await this.readJsonBody(request)) as ChartUpdateInput
          this.sendJson(response, this.updateChart({ ...input, id: chartMatch[1] }))
          return
        }

        if (request.method === 'DELETE') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          this.deleteChart(chartMatch[1])
          this.sendJson(response, { ok: true })
          return
        }

        this.sendJson(response, this.chartRepository.getChart(chartMatch[1]))
        return
      }

      const pointsMatch = url.pathname.match(/^\/api\/charts\/([^/]+)\/reference-points$/)
      if (pointsMatch) {
        if (request.method === 'PUT') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          const payload = (await this.readJsonBody(request)) as { points: GeoReferencePoint[] }
          this.sendJson(response, this.saveReferencePoints(pointsMatch[1], payload.points))
          return
        }

        this.sendJson(response, this.chartRepository.listReferencePoints(pointsMatch[1]))
        return
      }

      const chartAssetMatch = url.pathname.match(/^\/assets\/charts\/([^/]+)\/preview$/)
      if (chartAssetMatch) {
        this.serveChartAsset(chartAssetMatch[1], response)
        return
      }

      this.serveRendererAsset(url.pathname, response)
    } catch (error) {
      if (response.headersSent) {
        return
      }
      this.sendJson(response, { error: error instanceof Error ? error.message : 'INTERNAL_ERROR' }, 500)
    }
  }

  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = []

    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    if (chunks.length === 0) {
      return {}
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
  }

  private ensureWriteEnabled(response: ServerResponse): boolean {
    if (!this.settings.lanAccess.allowWrite) {
      this.sendJson(response, { error: 'WRITE_DISABLED' }, 403)
      return false
    }

    return true
  }

  private serveChartAsset(chartId: string, response: ServerResponse): void {
    const asset = this.getChartAsset(chartId)
    if (!asset?.filePath || !existsSync(asset.filePath)) {
      response.writeHead(404)
      response.end('Chart asset not found')
      return
    }

    const stat = statSync(asset.filePath)
    response.writeHead(200, {
      'Content-Type': asset.mimeType,
      'Content-Length': stat.size,
      'Cache-Control': 'private, max-age=300'
    })
    createReadStream(asset.filePath).pipe(response)
  }

  private getChartAsset(chartId: string): ChartAssetPayload | null {
    const chart = this.chartRepository.getChart(chartId)
    if (!chart) {
      return null
    }

    const displayPath = chart.previewImagePath ?? chart.sourceFilePath
    return {
      chartId,
      fileFormat: chart.fileFormat,
      mimeType: getMimeTypeByFormat(chart.fileFormat),
      filePath: displayPath
    }
  }

  private serveRendererAsset(pathname: string, response: ServerResponse): void {
    const requestedPath = pathname === '/' ? '/index.html' : pathname
    const absolutePath = resolve(this.rendererRoot, `.${requestedPath}`)
    const fallbackPath = join(this.rendererRoot, 'index.html')

    const targetPath =
      absolutePath.startsWith(resolve(this.rendererRoot)) && existsSync(absolutePath)
        ? absolutePath
        : fallbackPath

    if (!existsSync(targetPath)) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('LAN renderer assets are unavailable. Run npm run build:bundle or npm run build first.')
      return
    }

    response.writeHead(200, {
      'Content-Type': getContentType(targetPath),
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache'
    })
    response.end(readFileSync(targetPath))
  }

  private sendJson(response: ServerResponse, data: unknown, statusCode = 200): void {
    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    response.end(JSON.stringify(data))
  }

  private finalizeChartImport(input: FinalizeChartImportInput): ChartImportResult {
    const chartId = randomUUID()
    const imported = input.sourcePath
      ? this.storageService.importChartFile(input.sourcePath, chartId)
      : input.sourceFileBase64 && input.sourceFileFormat
        ? this.storageService.writeChartSourceFile(chartId, input.sourceFileFormat, input.sourceFileBase64)
        : null

    if (!imported) {
      throw new Error('CHART_SOURCE_REQUIRED')
    }

    const displayPath =
      input.displayImageBase64 && input.displayImageMimeType
        ? this.storageService.writeChartDisplayImage(
            chartId,
            input.displayImageMimeType,
            input.displayImageBase64
          )
        : imported.destinationPath
    const displayFormat = getFileFormat(displayPath)
    const now = Date.now()

    const chart: ChartRecord = {
      id: chartId,
      title: input.title,
      airportCode: null,
      chartType: 'general',
      titleMode: 'manual',
      boundApproachProcedureId: null,
      sourceFilePath: imported.destinationPath,
      previewImagePath: displayPath,
      fileFormat: displayFormat,
      width: null,
      height: null,
      isGeoreferenced: false,
      createdAt: now,
      updatedAt: now
    }

    const created = this.chartRepository.createChart(chart)
    this.broadcastChartChanged()

    return { chart: created }
  }

  private updateChart(input: ChartUpdateInput): ChartRecord | null {
    const updated = this.chartRepository.updateChart(input)
    this.broadcastChartChanged()
    return updated
  }

  private saveReferencePoints(chartId: string, points: GeoReferencePoint[]): GeoReferencePoint[] {
    const saved = this.chartRepository.saveReferencePoints(chartId, points)
    this.broadcastChartChanged()
    return saved
  }

  private deleteChart(chartId: string): void {
    this.chartRepository.deleteChart(chartId)
    this.storageService.deleteChartFiles(chartId)
    this.broadcastChartChanged()
  }

  private isAuthorized(request: IncomingMessage): boolean {
    if (!this.settings.lanAccess.authEnabled) {
      return true
    }

    const expectedToken = this.settings.lanAccess.authToken
    if (!expectedToken) {
      return true
    }

    const authHeader = request.headers.authorization
    if (authHeader === `Bearer ${expectedToken}`) {
      return true
    }

    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    return url.searchParams.get('token') === expectedToken
  }

  private broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event)
    this.sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload)
      }
    })
  }
}

function getFileFormat(filePath: string): ChartRecord['fileFormat'] {
  const ext = filePath.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'jpg') return 'jpg'
  if (ext === 'jpeg') return 'jpeg'
  return 'png'
}

function sanitizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    lanAccess: {
      ...settings.lanAccess,
      authToken: ''
    }
  }
}

function getLanAccessUrls(port: number, authToken: string): string[] {
  const interfaces = networkInterfaces()
  const results = new Set<string>()
  const querySuffix = authToken ? `/?token=${authToken}` : '/'

  Object.values(interfaces).forEach((entries) => {
    entries?.forEach((entry) => {
      if (entry.family !== 'IPv4' || entry.internal || !entry.address.startsWith('192.168.')) {
        return
      }

      results.add(`http://${entry.address}:${port}${querySuffix}`)
    })
  })

  return Array.from(results).sort()
}

function getMimeTypeByFormat(fileFormat: ChartAssetPayload['fileFormat']): string {
  switch (fileFormat) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
    default:
      return 'image/png'
  }
}

function getContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.js':
      return 'application/javascript; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.html':
    default:
      return 'text/html; charset=utf-8'
  }
}
