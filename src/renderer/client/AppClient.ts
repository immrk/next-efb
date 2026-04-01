import type {
  ChartAssetPayload,
  ChartImportResult,
  ChartRecord,
  ChartUpdateInput,
  FinalizeChartImportInput,
  GeoReferencePoint,
  PickedChartFile,
  StorageSummary
} from '@shared/chart-types'
import type {
  AircraftState,
  AppSettings,
  ConnectionState,
  DesktopDevAction,
  DesktopWindowAction,
  DesktopWindowState,
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

export interface AppClientRuntime {
  host: 'electron' | 'web'
  canWrite: boolean
  canManageLocalFiles: boolean
  isDev: boolean
}

export interface SnapshotPayload {
  aircraft: AircraftState
  connection: ConnectionState
}

export interface AppClient {
  getRuntime(): AppClientRuntime
  getSnapshot(): Promise<SnapshotPayload>
  getSettings(): Promise<AppSettings>
  getNavDataStatus(): Promise<NavDataStatus>
  pickNavSqliteFile(): Promise<string | null>
  searchNavAirports(query: string): Promise<NavAirportOption[]>
  getNavAirportProcedures(airportIdent: string): Promise<NavAirportProcedures>
  buildFlightPlan(input: BuildFlightPlanInput): Promise<BuildFlightPlanResult>
  importSimBrief(input: SimBriefImportInput): Promise<SimBriefImportResult>
  getRemoteAccessStatus(): Promise<RemoteAccessStatus>
  getChart(chartId: string): Promise<ChartRecord | null>
  getChartAsset(chartId: string): Promise<ChartAssetPayload | null>
  getChartReferencePoints(chartId: string): Promise<GeoReferencePoint[]>
  listCharts(): Promise<ChartRecord[]>
  getStorageSummary(): Promise<StorageSummary>
  pickChartFile(): Promise<PickedChartFile | null>
  finalizeChartImport(input: FinalizeChartImportInput): Promise<ChartImportResult>
  deleteChart(chartId: string): Promise<boolean>
  saveChartReferencePoints(chartId: string, points: GeoReferencePoint[]): Promise<GeoReferencePoint[]>
  updateChart(input: ChartUpdateInput): Promise<ChartRecord | null>
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>
  openExternal(url: string): Promise<boolean>
  getWindowState(): Promise<DesktopWindowState>
  performWindowAction(action: DesktopWindowAction): Promise<DesktopWindowState>
  performDevAction(action: DesktopDevAction): Promise<boolean>
  onWindowStateChange(listener: (state: DesktopWindowState) => void): () => void
  onAircraftUpdate(listener: (state: AircraftState) => void): () => void
  onConnectionUpdate(listener: (state: ConnectionState) => void): () => void
  onChartsChanged(listener: () => void): () => void
  onSettingsChanged(listener: () => void): () => void
}
