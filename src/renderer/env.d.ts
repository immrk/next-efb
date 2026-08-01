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
  ChartAssetPayload,
  ChartBundleExportInput,
  ChartBundleExportResult,
  ChartBundleImportInput,
  ChartBundleImportPreview,
  ChartBundleImportResult,
  ChartImportFromUrlInput,
  ChartImportResult,
  ChartRecord,
  FinalizeChartImportInput,
  PickedChartFile,
  ChartUpdateInput,
  GeoReferencePoint,
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
import type { AppUpdateState } from '@shared/update-types'

declare global {
  interface Window {
    msfsApi: {
      getSnapshot: () => Promise<{ aircraft: AircraftState; connection: ConnectionState }>
      getSettings: () => Promise<AppSettings>
      getNavDataStatus: () => Promise<NavDataStatus>
      pickNavSqliteFile: () => Promise<string | null>
      searchNavAirports: (query: string) => Promise<NavAirportOption[]>
      getNavAirportProcedures: (airportIdent: string) => Promise<NavAirportProcedures>
      buildFlightPlan: (input: BuildFlightPlanInput) => Promise<BuildFlightPlanResult>
      getNavMapFeatures: (input: NavMapQueryInput) => Promise<NavMapFeatureCollection>
      searchNavMapPoints: (input: NavMapSearchInput) => Promise<NavMapSearchResult[]>
      importSimBrief: (input: SimBriefImportInput) => Promise<SimBriefImportResult>
      getChart: (chartId: string) => Promise<ChartRecord | null>
      getChartAsset: (chartId: string) => Promise<ChartAssetPayload | null>
      getChartReferencePoints: (chartId: string) => Promise<GeoReferencePoint[]>
      pickChartBundleImport: () => Promise<ChartBundleImportPreview | null>
      importChartBundle: (input: ChartBundleImportInput) => Promise<ChartBundleImportResult>
      exportChartBundle: (
        input: ChartBundleExportInput
      ) => Promise<ChartBundleExportResult | null>
      pickChartFile: () => Promise<PickedChartFile | null>
      pickChartsDirectory: () => Promise<string | null>
      importChartFromUrl: (input: ChartImportFromUrlInput) => Promise<PickedChartFile>
      listCharts: () => Promise<ChartRecord[]>
      getStorageSummary: () => Promise<StorageSummary>
      finalizeChartImport: (input: FinalizeChartImportInput) => Promise<ChartImportResult>
      deleteChart: (chartId: string) => Promise<boolean>
      getChecklist: (checklistId: string) => Promise<ChecklistRecord | null>
      getChecklistAsset: (checklistId: string) => Promise<ChecklistAssetPayload | null>
      listChecklists: () => Promise<ChecklistRecord[]>
      pickChecklistFile: () => Promise<PickedChecklistFile | null>
      importChecklistFromUrl: (
        input: ChecklistImportFromUrlInput
      ) => Promise<PickedChecklistFile>
      finalizeChecklistImport: (
        input: FinalizeChecklistImportInput
      ) => Promise<ChecklistImportResult>
      deleteChecklist: (checklistId: string) => Promise<boolean>
      updateChecklist: (input: ChecklistUpdateInput) => Promise<ChecklistRecord | null>
      saveChartReferencePoints: (chartId: string, points: GeoReferencePoint[]) => Promise<GeoReferencePoint[]>
      updateChart: (input: ChartUpdateInput) => Promise<ChartRecord | null>
      updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
      getRemoteAccessStatus: () => Promise<RemoteAccessStatus>
      getAppUpdateState: () => Promise<AppUpdateState>
      checkForAppUpdate: () => Promise<AppUpdateState>
      downloadAndInstallAppUpdate: () => Promise<AppUpdateState>
      onAppUpdateStateChange: (listener: (state: AppUpdateState) => void) => () => void
      openExternal: (url: string) => Promise<boolean>
      performWindowAction: (action: DesktopWindowAction) => Promise<DesktopWindowState>
      getWindowState: () => Promise<DesktopWindowState>
      onWindowStateChange: (listener: (state: DesktopWindowState) => void) => () => void
      performDevAction: (action: DesktopDevAction) => Promise<boolean>
      onAircraftUpdate: (listener: (state: AircraftState) => void) => () => void
      onConnectionUpdate: (listener: (state: ConnectionState) => void) => () => void
      onChecklistsChanged: (listener: () => void) => () => void
    }
  }
}

export {}
