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

declare global {
  interface Window {
    msfsApi: {
      getSnapshot: () => Promise<{ aircraft: AircraftState; connection: ConnectionState }>
      getSettings: () => Promise<AppSettings>
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
      onAircraftUpdate: (listener: (state: AircraftState) => void) => () => void
      onConnectionUpdate: (listener: (state: ConnectionState) => void) => () => void
    }
  }
}

export {}
