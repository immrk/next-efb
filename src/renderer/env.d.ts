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

declare global {
  interface TemplateIpcResponse<T = undefined> {
    success: boolean
    data?: T
    error?: string
  }

  interface Window {
    windowManager?: {
      createWindow: (name: string, options?: Electron.BrowserWindowConstructorOptions) => Promise<TemplateIpcResponse>
      showWindow: (name: string) => Promise<TemplateIpcResponse>
      hideWindow: (name: string) => Promise<TemplateIpcResponse>
      closeWindow: (name: string) => Promise<TemplateIpcResponse>
      focusWindow: (name: string) => Promise<TemplateIpcResponse>
      minimizeWindow: (name: string) => Promise<TemplateIpcResponse>
      maximizeWindow: (name: string) => Promise<TemplateIpcResponse>
      restoreWindow: (name: string) => Promise<TemplateIpcResponse>
      hasWindow: (name: string) => Promise<TemplateIpcResponse<boolean>>
      isWindowVisible: (name: string) => Promise<TemplateIpcResponse<boolean>>
      getAllWindows: () => Promise<TemplateIpcResponse<Array<{ name: string; isVisible: boolean }>>>
      getVisibleWindowCount: () => Promise<TemplateIpcResponse<number>>
    }
    auth?: {
      login: (data: unknown) => Promise<TemplateIpcResponse>
      logout: () => Promise<TemplateIpcResponse>
      getToken: () => Promise<TemplateIpcResponse<import('./composables/useAuth').MockUser | null>>
      tokenRefresh: () => Promise<TemplateIpcResponse<import('./composables/useAuth').MockUser | null>>
      onTokenChange: (
        listener: (user: import('./composables/useAuth').MockUser | null) => void
      ) => () => void
    }
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
      pickChartFile: () => Promise<PickedChartFile | null>
      pickChartsDirectory: () => Promise<string | null>
      importChartFromUrl: (input: ChartImportFromUrlInput) => Promise<PickedChartFile>
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
