import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/channels'
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

const api = {
  getSnapshot: async (): Promise<{ aircraft: AircraftState; connection: ConnectionState }> =>
    ipcRenderer.invoke(IPC_CHANNELS.aircraftSnapshot),
  getSettings: async (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  getNavDataStatus: async (): Promise<NavDataStatus> => ipcRenderer.invoke(IPC_CHANNELS.navDataStatus),
  pickNavSqliteFile: async (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.navDataPickSqlite),
  searchNavAirports: async (query: string): Promise<NavAirportOption[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.navAirportsSearch, query),
  getNavAirportProcedures: async (airportIdent: string): Promise<NavAirportProcedures> =>
    ipcRenderer.invoke(IPC_CHANNELS.navAirportProcedures, airportIdent),
  buildFlightPlan: async (input: BuildFlightPlanInput): Promise<BuildFlightPlanResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.navBuildPlan, input),
  getNavMapFeatures: async (input: NavMapQueryInput): Promise<NavMapFeatureCollection> =>
    ipcRenderer.invoke(IPC_CHANNELS.navMapFeatures, input),
  searchNavMapPoints: async (input: NavMapSearchInput): Promise<NavMapSearchResult[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.navMapSearch, input),
  importSimBrief: async (input: SimBriefImportInput): Promise<SimBriefImportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.simbriefImport, input),
  getChart: async (chartId: string): Promise<ChartRecord | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartGet, chartId),
  getChartAsset: async (chartId: string): Promise<ChartAssetPayload | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartAsset, chartId),
  getChartReferencePoints: async (chartId: string): Promise<GeoReferencePoint[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartReferenceGet, chartId),
  pickChartFile: async (): Promise<PickedChartFile | null> => ipcRenderer.invoke(IPC_CHANNELS.chartImport),
  importChartFromUrl: async (input: ChartImportFromUrlInput): Promise<PickedChartFile> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartImportFromUrl, input),
  listCharts: async (): Promise<ChartRecord[]> => ipcRenderer.invoke(IPC_CHANNELS.chartsList),
  getStorageSummary: async (): Promise<StorageSummary> =>
    ipcRenderer.invoke(IPC_CHANNELS.storageSummary),
  finalizeChartImport: async (input: FinalizeChartImportInput): Promise<ChartImportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartFinalizeImport, input),
  deleteChart: async (chartId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartDelete, chartId),
  saveChartReferencePoints: async (
    chartId: string,
    points: GeoReferencePoint[]
  ): Promise<GeoReferencePoint[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartReferenceSave, chartId, points),
  updateChart: async (input: ChartUpdateInput): Promise<ChartRecord | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartUpdate, input),
  updateSettings: async (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, partial),
  getRemoteAccessStatus: async (): Promise<RemoteAccessStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.remoteAccessStatus),
  openExternal: async (url: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  performWindowAction: async (action: DesktopWindowAction): Promise<DesktopWindowState> =>
    ipcRenderer.invoke(IPC_CHANNELS.windowAction, action),
  getWindowState: async (): Promise<DesktopWindowState> => ipcRenderer.invoke(IPC_CHANNELS.windowStateGet),
  onWindowStateChange: (listener: (state: DesktopWindowState) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: DesktopWindowState) => listener(payload)
    ipcRenderer.on(IPC_CHANNELS.windowStateChanged, wrapped)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.windowStateChanged, wrapped)
  },
  performDevAction: async (action: DesktopDevAction): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.devAction, action),
  onAircraftUpdate: (listener: (state: AircraftState) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: AircraftState) => listener(payload)
    ipcRenderer.on(IPC_CHANNELS.aircraftUpdate, wrapped)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.aircraftUpdate, wrapped)
  },
  onConnectionUpdate: (listener: (state: ConnectionState) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ConnectionState) => listener(payload)
    ipcRenderer.on(IPC_CHANNELS.connectionUpdate, wrapped)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.connectionUpdate, wrapped)
  }
}

contextBridge.exposeInMainWorld('msfsApi', api)
