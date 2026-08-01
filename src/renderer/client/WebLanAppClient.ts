import type {
  ChartAssetPayload,
  ChartBundleExportInput,
  ChartBundleExportResult,
  ChartBundleImportInput,
  ChartBundleImportPreview,
  ChartBundleImportResult,
  ChartImportFromUrlInput,
  ChartImportResult,
  ChartRecord,
  ChartUpdateInput,
  FinalizeChartImportInput,
  GeoReferencePoint,
  PickedChartFile,
  StorageSummary
} from '@shared/chart-types'
import type {
  ChecklistAssetPayload,
  ChecklistImportFromUrlInput,
  ChecklistImportResult,
  ChecklistRecord,
  ChecklistUpdateInput,
  FinalizeChecklistImportInput,
  PickedChecklistFile
} from '@shared/checklist-types'
import type {
  AircraftState,
  AppSettings,
  ConnectionState,
  RemoteAccessStatus
} from '@shared/types'
import type {
  BuildFlightPlanInput,
  BuildFlightPlanResult,
  NavAirportOption,
  NavAirportProcedures,
  NavDataStatus,
  SimBriefImportInput,
  SimBriefImportResult
} from '@shared/flight-plan-types'
import type {
  NavMapFeatureCollection,
  NavMapQueryInput,
  NavMapSearchInput,
  NavMapSearchResult
} from '@shared/nav-map-types'
import type { AppClient } from './AppClient'
import type { SnapshotPayload } from './AppClient'
import type { AppUpdateState } from '@shared/update-types'

type ServerEvent =
  | { type: 'aircraft:update'; payload: AircraftState }
  | { type: 'connection:update'; payload: ConnectionState }
  | { type: 'chart:changed' }
  | { type: 'checklist:changed' }
  | { type: 'settings:changed' }

const TOKEN_STORAGE_KEY = `msfs-lan-token:${window.location.origin}`

export class WebLanAppClient implements AppClient {
  private readonly aircraftListeners = new Set<(state: AircraftState) => void>()
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>()
  private readonly chartListeners = new Set<() => void>()
  private readonly checklistListeners = new Set<() => void>()
  private readonly settingsListeners = new Set<() => void>()
  private readonly token = this.resolveToken()
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null

  constructor() {
    this.connectSocket()
  }

  getRuntime() {
    return {
      host: 'web' as const,
      canWrite: true,
      canManageLocalFiles: true,
      isDev: import.meta.env.DEV
    }
  }

  getSnapshot(): Promise<SnapshotPayload> {
    return this.fetchJson('/api/snapshot')
  }

  getSettings(): Promise<AppSettings> {
    return this.fetchJson('/api/settings')
  }

  async getWindowState() {
    return { isMaximized: false }
  }

  async performWindowAction() {
    return { isMaximized: false }
  }

  async performDevAction() {
    return false
  }

  onWindowStateChange() {
    return () => void 0
  }

  getNavDataStatus(): Promise<NavDataStatus> {
    return this.fetchJson('/api/nav/status')
  }

  async pickNavSqliteFile(): Promise<string | null> {
    return null
  }

  searchNavAirports(query: string): Promise<NavAirportOption[]> {
    const url = `/api/nav/airports?query=${encodeURIComponent(query)}`
    return this.fetchJson(url)
  }

  getNavAirportProcedures(airportIdent: string): Promise<NavAirportProcedures> {
    return this.fetchJson(`/api/nav/airport/${encodeURIComponent(airportIdent)}/procedures`)
  }

  buildFlightPlan(input: BuildFlightPlanInput): Promise<BuildFlightPlanResult> {
    return this.fetchJson('/api/nav/plan', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  getNavMapFeatures(input: NavMapQueryInput): Promise<NavMapFeatureCollection> {
    return this.fetchJson('/api/nav/map-features', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  searchNavMapPoints(input: NavMapSearchInput): Promise<NavMapSearchResult[]> {
    return this.fetchJson('/api/nav/search-points', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  importSimBrief(input: SimBriefImportInput): Promise<SimBriefImportResult> {
    return this.fetchJson('/api/simbrief/import', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  async getRemoteAccessStatus(): Promise<RemoteAccessStatus> {
    return {
      enabled: true,
      running: true,
      port: Number(window.location.port || 80),
      primaryAccessUrl: window.location.origin,
      accessUrls: [window.location.origin]
    }
  }

  getChart(chartId: string): Promise<ChartRecord | null> {
    return this.fetchJson(`/api/charts/${chartId}`)
  }

  async getChartAsset(chartId: string): Promise<ChartAssetPayload | null> {
    const chart = await this.getChart(chartId)
    if (!chart) {
      return null
    }

    return {
      chartId,
      fileFormat: chart.fileFormat,
      mimeType: getMimeTypeByFormat(chart.fileFormat),
      url: this.withToken(`/assets/charts/${chartId}/preview`)
    }
  }

  getChartReferencePoints(chartId: string): Promise<GeoReferencePoint[]> {
    return this.fetchJson(`/api/charts/${chartId}/reference-points`)
  }

  async pickChartBundleImport(): Promise<ChartBundleImportPreview | null> {
    throw new Error('CHART_BUNDLE_DESKTOP_REQUIRED')
  }

  async importChartBundle(
    _input: ChartBundleImportInput
  ): Promise<ChartBundleImportResult> {
    throw new Error('CHART_BUNDLE_DESKTOP_REQUIRED')
  }

  async exportChartBundle(
    _input: ChartBundleExportInput
  ): Promise<ChartBundleExportResult | null> {
    throw new Error('CHART_BUNDLE_DESKTOP_REQUIRED')
  }

  listCharts(): Promise<ChartRecord[]> {
    return this.fetchJson('/api/charts')
  }

  getStorageSummary(): Promise<StorageSummary> {
    return this.fetchJson('/api/storage-summary')
  }

  async pickChartFile(): Promise<PickedChartFile | null> {
    const file = await pickBrowserFile()
    if (!file) {
      return null
    }

    return {
      sourcePath: null,
      fileName: file.name,
      fileFormat: getFileFormat(file.name),
      mimeType: file.type || getMimeTypeByFormat(getFileFormat(file.name)),
      base64: await readFileAsBase64(file)
    }
  }

  async getAppUpdateState(): Promise<AppUpdateState> {
    return createUnsupportedUpdateState()
  }

  async checkForAppUpdate(): Promise<AppUpdateState> {
    return createUnsupportedUpdateState()
  }

  async downloadAndInstallAppUpdate(): Promise<AppUpdateState> {
    return createUnsupportedUpdateState()
  }

  async pickChartsDirectory(): Promise<string | null> {
    return null
  }

  async importChartFromUrl(input: ChartImportFromUrlInput): Promise<PickedChartFile> {
    return this.fetchJson('/api/charts/import-from-url', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  async finalizeChartImport(input: FinalizeChartImportInput): Promise<ChartImportResult> {
    return this.fetchJson('/api/charts', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  async deleteChart(chartId: string): Promise<boolean> {
    await this.fetchJson(`/api/charts/${chartId}`, {
      method: 'DELETE'
    })
    return true
  }

  getChecklist(checklistId: string): Promise<ChecklistRecord | null> {
    return this.fetchJson(`/api/checklists/${encodeURIComponent(checklistId)}`)
  }

  async getChecklistAsset(checklistId: string): Promise<ChecklistAssetPayload | null> {
    const checklist = await this.getChecklist(checklistId)
    if (!checklist) {
      return null
    }

    return {
      checklistId,
      fileFormat: checklist.fileFormat,
      mimeType: getMimeTypeByFormat(checklist.fileFormat),
      url: this.withToken(
        `/assets/checklists/${encodeURIComponent(checklistId)}/source`
      )
    }
  }

  listChecklists(): Promise<ChecklistRecord[]> {
    return this.fetchJson('/api/checklists')
  }

  async pickChecklistFile(): Promise<PickedChecklistFile | null> {
    const file = await pickBrowserFile()
    if (!file) {
      return null
    }

    return {
      sourcePath: null,
      fileName: file.name,
      fileFormat: getFileFormat(file.name),
      mimeType: file.type || getMimeTypeByFormat(getFileFormat(file.name)),
      base64: await readFileAsBase64(file)
    }
  }

  importChecklistFromUrl(input: ChecklistImportFromUrlInput): Promise<PickedChecklistFile> {
    return this.fetchJson('/api/checklists/import-from-url', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  finalizeChecklistImport(input: FinalizeChecklistImportInput): Promise<ChecklistImportResult> {
    return this.fetchJson('/api/checklists', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }

  async deleteChecklist(checklistId: string): Promise<boolean> {
    await this.fetchJson(`/api/checklists/${encodeURIComponent(checklistId)}`, {
      method: 'DELETE'
    })
    return true
  }

  updateChecklist(input: ChecklistUpdateInput): Promise<ChecklistRecord | null> {
    return this.fetchJson(`/api/checklists/${encodeURIComponent(input.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    })
  }

  async saveChartReferencePoints(
    chartId: string,
    points: GeoReferencePoint[]
  ): Promise<GeoReferencePoint[]> {
    return this.fetchJson(`/api/charts/${chartId}/reference-points`, {
      method: 'PUT',
      body: JSON.stringify({ points })
    })
  }

  async updateChart(input: ChartUpdateInput): Promise<ChartRecord | null> {
    return this.fetchJson(`/api/charts/${input.id}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    })
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    return this.fetchJson('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(partial)
    })
  }

  async openExternal(url: string): Promise<boolean> {
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  }

  onAircraftUpdate(listener: (state: AircraftState) => void) {
    this.aircraftListeners.add(listener)
    this.connectSocket()
    return () => this.aircraftListeners.delete(listener)
  }

  onConnectionUpdate(listener: (state: ConnectionState) => void) {
    this.connectionListeners.add(listener)
    this.connectSocket()
    return () => this.connectionListeners.delete(listener)
  }

  onChartsChanged(listener: () => void) {
    this.chartListeners.add(listener)
    this.connectSocket()
    return () => this.chartListeners.delete(listener)
  }

  onChecklistsChanged(listener: () => void) {
    this.checklistListeners.add(listener)
    this.connectSocket()
    return () => this.checklistListeners.delete(listener)
  }

  onSettingsChanged(listener: () => void) {
    this.settingsListeners.add(listener)
    this.connectSocket()
    return () => this.settingsListeners.delete(listener)
  }

  onAppUpdateStateChange() {
    return () => void 0
  }

  private async fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers ?? {})
    const authHeaders = this.getHeaders()
    Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value))

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json; charset=utf-8')
    }

    const response = await fetch(path, {
      ...init,
      headers
    })

    if (!response.ok) {
      throw new Error(`LAN request failed: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  private getHeaders(): Record<string, string> {
    if (!this.token) {
      return {}
    }

    return {
      Authorization: `Bearer ${this.token}`
    }
  }

  private connectSocket(): void {
    if (this.socket) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = new URL(`${protocol}//${window.location.host}/ws`)
    if (this.token) {
      wsUrl.searchParams.set('token', this.token)
    }
    const socket = new WebSocket(wsUrl.toString())

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerEvent
      switch (message.type) {
        case 'aircraft:update':
          this.aircraftListeners.forEach((listener) => listener(message.payload))
          break
        case 'connection:update':
          this.connectionListeners.forEach((listener) => listener(message.payload))
          break
        case 'chart:changed':
          this.chartListeners.forEach((listener) => listener())
          break
        case 'checklist:changed':
          this.checklistListeners.forEach((listener) => listener())
          break
        case 'settings:changed':
          this.settingsListeners.forEach((listener) => listener())
          break
      }
    }

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null
      }
      this.scheduleReconnect()
    }

    socket.onerror = () => {
      socket.close()
    }

    this.socket = socket
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connectSocket()
    }, 1500)
  }

  private resolveToken(): string | null {
    const url = new URL(window.location.href)
    const tokenFromUrl = url.searchParams.get('token')
    if (tokenFromUrl) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, tokenFromUrl)
      url.searchParams.delete('token')
      window.history.replaceState({}, document.title, url.toString())
      return tokenFromUrl
    }

    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  }

  private withToken(path: string): string {
    if (!this.token) {
      return path
    }

    const url = new URL(path, window.location.origin)
    url.searchParams.set('token', this.token)
    return url.toString()
  }
}

async function pickBrowserFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.png,.jpg,.jpeg'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

async function readFileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

function getFileFormat(fileName: string): ChartRecord['fileFormat'] {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'jpg') return 'jpg'
  if (ext === 'jpeg') return 'jpeg'
  return 'png'
}

function getMimeTypeByFormat(fileFormat: ChartRecord['fileFormat']): string {
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

function createUnsupportedUpdateState(): AppUpdateState {
  return {
    supported: false,
    phase: 'unsupported',
    currentVersion: '',
    availableVersion: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    progressPercent: null,
    transferredBytes: null,
    totalBytes: null,
    bytesPerSecond: null,
    errorMessage: null
  }
}
