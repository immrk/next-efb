import type {
  ChartAssetPayload,
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
import type {
  NavMapFeatureCollection,
  NavMapQueryInput,
  NavMapSearchInput,
  NavMapSearchResult
} from '@shared/nav-map-types'

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
  getNavMapFeatures(input: NavMapQueryInput): Promise<NavMapFeatureCollection>
  searchNavMapPoints(input: NavMapSearchInput): Promise<NavMapSearchResult[]>
  importSimBrief(input: SimBriefImportInput): Promise<SimBriefImportResult>
  getRemoteAccessStatus(): Promise<RemoteAccessStatus>
  getChart(chartId: string): Promise<ChartRecord | null>
  getChartAsset(chartId: string): Promise<ChartAssetPayload | null>
  getChartReferencePoints(chartId: string): Promise<GeoReferencePoint[]>
  listCharts(): Promise<ChartRecord[]>
  getStorageSummary(): Promise<StorageSummary>
  pickChartFile(): Promise<PickedChartFile | null>
  pickChartsDirectory(): Promise<string | null>
  importChartFromUrl(input: ChartImportFromUrlInput): Promise<PickedChartFile>
  finalizeChartImport(input: FinalizeChartImportInput): Promise<ChartImportResult>
  deleteChart(chartId: string): Promise<boolean>
  getChecklist(checklistId: string): Promise<ChecklistRecord | null>
  getChecklistAsset(checklistId: string): Promise<ChecklistAssetPayload | null>
  listChecklists(): Promise<ChecklistRecord[]>
  pickChecklistFile(): Promise<PickedChecklistFile | null>
  importChecklistFromUrl(input: ChecklistImportFromUrlInput): Promise<PickedChecklistFile>
  finalizeChecklistImport(input: FinalizeChecklistImportInput): Promise<ChecklistImportResult>
  deleteChecklist(checklistId: string): Promise<boolean>
  updateChecklist(input: ChecklistUpdateInput): Promise<ChecklistRecord | null>
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
  onChecklistsChanged(listener: () => void): () => void
  onSettingsChanged(listener: () => void): () => void
}
