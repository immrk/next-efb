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
  ChartImportResult,
  ChartRecord,
  FinalizeChartImportInput,
  PickedChartFile,
  ChartUpdateInput,
  GeoReferencePoint,
  StorageSummary
} from '@shared/chart-types'
import type {
  BuildFlightPlanInput,
  BuildFlightPlanResult,
  NavAirportOption,
  NavAirportProcedures,
  NavDataStatus,
  SimBriefImportInput,
  SimBriefImportResult
} from '@shared/flight-plan-types'

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
      importSimBrief: (input: SimBriefImportInput) => Promise<SimBriefImportResult>
      getChart: (chartId: string) => Promise<ChartRecord | null>
      getChartAsset: (chartId: string) => Promise<ChartAssetPayload | null>
      getChartReferencePoints: (chartId: string) => Promise<GeoReferencePoint[]>
      pickChartFile: () => Promise<PickedChartFile | null>
      listCharts: () => Promise<ChartRecord[]>
      getStorageSummary: () => Promise<StorageSummary>
      finalizeChartImport: (input: FinalizeChartImportInput) => Promise<ChartImportResult>
      deleteChart: (chartId: string) => Promise<boolean>
      saveChartReferencePoints: (chartId: string, points: GeoReferencePoint[]) => Promise<GeoReferencePoint[]>
      updateChart: (input: ChartUpdateInput) => Promise<ChartRecord | null>
      updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
      getRemoteAccessStatus: () => Promise<RemoteAccessStatus>
      openExternal: (url: string) => Promise<boolean>
      performWindowAction: (action: DesktopWindowAction) => Promise<DesktopWindowState>
      getWindowState: () => Promise<DesktopWindowState>
      onWindowStateChange: (listener: (state: DesktopWindowState) => void) => () => void
      performDevAction: (action: DesktopDevAction) => Promise<boolean>
      onAircraftUpdate: (listener: (state: AircraftState) => void) => () => void
      onConnectionUpdate: (listener: (state: ConnectionState) => void) => () => void
    }
  }
}

export {}
