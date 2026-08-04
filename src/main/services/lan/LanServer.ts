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
  ChecklistAssetPayload,
  ChecklistImportFromUrlInput,
  ChecklistImportResult,
  ChecklistRecord,
  ChecklistUpdateInput,
  FinalizeChecklistImportInput
} from '@shared/checklist-types'
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
import type { NavMapQueryInput, NavMapSearchInput } from '@shared/nav-map-types'
import { WebSocket, WebSocketServer } from 'ws'
import { SettingsStore } from '../config/SettingsStore'
import { SimConnectService } from '../simconnect/SimConnectService'
import { FlightStateStore } from '../state/FlightStateStore'
import { ChartRepository } from '../storage/ChartRepository'
import { ChecklistRepository } from '../storage/ChecklistRepository'
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
  checklistRepository: ChecklistRepository
  storageService: StorageService
  navDataService: NavDataService
  onChartsChanged?: () => void
}

type ServerEvent =
  | { type: 'aircraft:update'; payload: AircraftState }
  | { type: 'connection:update'; payload: ConnectionState }
  | { type: 'chart:changed' }
  | { type: 'checklist:changed' }
  | { type: 'settings:changed' }

export class LanServer {
  private settings: AppSettings
  private readonly rendererRoot: string
  private readonly flightStateStore: FlightStateStore
  private readonly settingsStore: SettingsStore
  private readonly simConnectService: SimConnectService
  private readonly chartRepository: ChartRepository
  private readonly checklistRepository: ChecklistRepository
  private readonly storageService: StorageService
  private readonly remoteChartImportService: RemoteChartImportService
  private readonly navDataService: NavDataService
  private readonly onChartsChanged: () => void
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
    this.checklistRepository = options.checklistRepository
    this.storageService = options.storageService
    this.remoteChartImportService = new RemoteChartImportService()
    this.navDataService = options.navDataService
    this.onChartsChanged = options.onChartsChanged ?? (() => void 0)
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
    this.onChartsChanged()
  }

  broadcastChecklistChanged(): void {
    this.broadcast({ type: 'checklist:changed' })
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

      if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/assets/charts/') ||
        url.pathname.startsWith('/assets/checklists/')
      ) {
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
          const nextSettings = this.applySettingsUpdate(partial)
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

      if (url.pathname === '/api/nav/search-points' && request.method === 'POST') {
        const input = (await this.readJsonBody(request)) as NavMapSearchInput
        this.sendJson(response, this.navDataService.searchMapPoints(this.settingsStore.get(), input))
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

        const removedChartIds = this.chartRepository.reconcileMissingCharts()
        removedChartIds.forEach((chartId) => this.storageService.deleteChartFiles(chartId))
        if (removedChartIds.length > 0) {
          this.broadcastChartChanged()
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

      if (url.pathname === '/api/checklists') {
        if (request.method === 'POST') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          const input = (await this.readJsonBody(request)) as FinalizeChecklistImportInput
          this.sendJson(response, this.finalizeChecklistImport(input), 201)
          return
        }

        this.sendJson(response, this.checklistRepository.listChecklists())
        return
      }

      if (url.pathname === '/api/checklists/import-from-url' && request.method === 'POST') {
        if (!this.ensureWriteEnabled(response)) {
          return
        }
        const input = (await this.readJsonBody(request)) as ChecklistImportFromUrlInput
        this.sendJson(response, await this.remoteChartImportService.download(input.url), 201)
        return
      }

      const checklistMatch = url.pathname.match(/^\/api\/checklists\/([^/]+)$/)
      if (checklistMatch) {
        if (request.method === 'PATCH') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          const input = (await this.readJsonBody(request)) as ChecklistUpdateInput
          this.sendJson(
            response,
            this.updateChecklist({ ...input, id: checklistMatch[1] })
          )
          return
        }

        if (request.method === 'DELETE') {
          if (!this.ensureWriteEnabled(response)) {
            return
          }
          this.deleteChecklist(checklistMatch[1])
          this.sendJson(response, { ok: true })
          return
        }

        this.sendJson(response, this.checklistRepository.getChecklist(checklistMatch[1]))
        return
      }

      const checklistAssetMatch = url.pathname.match(/^\/assets\/checklists\/([^/]+)\/source$/)
      if (checklistAssetMatch) {
        this.serveChecklistAsset(checklistAssetMatch[1], response)
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

    const displayPath = chart.previewImagePath && existsSync(chart.previewImagePath)
      ? chart.previewImagePath
      : chart.sourceFilePath
    const fileFormat = getFileFormat(displayPath)
    return {
      chartId,
      fileFormat,
      mimeType: getMimeTypeByFormat(fileFormat),
      filePath: displayPath
    }
  }

  private serveChecklistAsset(checklistId: string, response: ServerResponse): void {
    const asset = this.getChecklistAsset(checklistId)
    if (!asset?.filePath || !existsSync(asset.filePath)) {
      response.writeHead(404)
      response.end('Checklist asset not found')
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

  private getChecklistAsset(checklistId: string): ChecklistAssetPayload | null {
    const checklist = this.checklistRepository.getChecklist(checklistId)
    if (!checklist) {
      return null
    }

    return {
      checklistId,
      fileFormat: checklist.fileFormat,
      mimeType: getMimeTypeByFormat(checklist.fileFormat),
      filePath: checklist.sourceFilePath
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
      response.end('LAN renderer assets are unavailable. Run npm run build:lan or npm run build first.')
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
      boundRunwayNames: [],
      boundApproachProcedureIds: [],
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

  private finalizeChecklistImport(input: FinalizeChecklistImportInput): ChecklistImportResult {
    const aircraftModel = input.aircraftModel.trim().toUpperCase()
    if (!aircraftModel) {
      throw new Error('CHECKLIST_AIRCRAFT_MODEL_REQUIRED')
    }

    const checklistId = randomUUID()
    const imported = input.sourcePath
      ? this.storageService.importChecklistFile(input.sourcePath, checklistId)
      : input.sourceFileBase64 && input.sourceFileFormat
        ? this.storageService.writeChecklistSourceFile(
            checklistId,
            input.sourceFileFormat,
            input.sourceFileBase64
          )
        : null

    if (!imported) {
      throw new Error('CHECKLIST_SOURCE_REQUIRED')
    }

    const now = Date.now()
    const checklist: ChecklistRecord = {
      id: checklistId,
      title: input.title.trim() || 'Checklist',
      aircraftModel,
      sourceFilePath: imported.destinationPath,
      fileFormat: getFileFormat(imported.destinationPath),
      createdAt: now,
      updatedAt: now
    }
    const created = this.checklistRepository.createChecklist(checklist)
    this.broadcastChecklistChanged()
    return { checklist: created }
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

  private deleteChecklist(checklistId: string): void {
    this.checklistRepository.deleteChecklist(checklistId)
    this.storageService.deleteChecklistFiles(checklistId)
    this.broadcastChecklistChanged()
  }

  private updateChecklist(input: ChecklistUpdateInput): ChecklistRecord | null {
    const title = input.title.trim()
    const aircraftModel = input.aircraftModel.trim().toUpperCase()
    if (!title) {
      throw new Error('CHECKLIST_TITLE_REQUIRED')
    }
    if (!aircraftModel) {
      throw new Error('CHECKLIST_AIRCRAFT_MODEL_REQUIRED')
    }

    const updated = this.checklistRepository.updateChecklist({
      id: input.id,
      title,
      aircraftModel
    })
    this.broadcastChecklistChanged()
    return updated
  }

  private applySettingsUpdate(partial: Partial<AppSettings>): AppSettings {
    const currentSettings = this.settingsStore.get()
    const nextCandidate = mergeSettings(currentSettings, partial)
    const storageSummary = this.storageService.getSummary()
    const previousChartsRoot = storageSummary.chartsRoot
    const nextChartsRoot = this.storageService.resolveChartsRoot(nextCandidate)

    if (normalizePath(previousChartsRoot) !== normalizePath(nextChartsRoot)) {
      const relocated = this.storageService.relocateChartsRoot(nextChartsRoot)
      this.chartRepository.relocateChartAssetPaths(relocated.previousChartsRoot, relocated.nextChartsRoot)
    }

    const normalizedPartial = normalizeSettingsPartial(partial, nextChartsRoot, storageSummary.defaultChartsRoot)
    return this.settingsStore.update(normalizedPartial)
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

function mergeSettings(current: AppSettings, partial: Partial<AppSettings>): AppSettings {
  return {
    ...current,
    ...partial,
    storage: {
      ...current.storage,
      ...partial.storage
    },
    navData: {
      ...current.navData,
      ...partial.navData
    },
    simbrief: {
      ...current.simbrief,
      ...partial.simbrief
    },
    lanAccess: {
      ...current.lanAccess,
      ...partial.lanAccess
    }
  }
}

function normalizePath(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value
}

function normalizeSettingsPartial(
  partial: Partial<AppSettings>,
  chartsRoot: string,
  defaultChartsRoot: string
): Partial<AppSettings> {
  if (!partial.storage) {
    return partial
  }

  return {
    ...partial,
    storage: {
      ...partial.storage,
      chartLibraryPath: normalizePath(chartsRoot) === normalizePath(defaultChartsRoot) ? null : chartsRoot
    }
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
