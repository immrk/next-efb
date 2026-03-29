import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/channels'
import type { AircraftState, AppSettings, ConnectionState } from '@shared/types'
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

const api = {
  getSnapshot: async (): Promise<{ aircraft: AircraftState; connection: ConnectionState }> =>
    ipcRenderer.invoke(IPC_CHANNELS.aircraftSnapshot),
  getSettings: async (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  getChart: async (chartId: string): Promise<ChartRecord | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartGet, chartId),
  getChartAsset: async (chartId: string): Promise<ChartAssetPayload | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartAsset, chartId),
  getChartReferencePoints: async (chartId: string): Promise<GeoReferencePoint[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.chartReferenceGet, chartId),
  pickChartFile: async (): Promise<PickedChartFile | null> => ipcRenderer.invoke(IPC_CHANNELS.chartImport),
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
