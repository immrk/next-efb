export type ChartType = 'airport' | 'sid' | 'star' | 'approach' | 'general'
export type ChartTitleMode = 'manual' | 'approach-procedure'

import type {
  DocumentAssetPayload,
  DocumentFileFormat,
  DocumentImportFromUrlInput,
  PickedDocumentFile
} from './document-types'

export type ChartFileFormat = DocumentFileFormat

export interface ChartRecord {
  id: string
  title: string
  airportCode: string | null
  chartType: ChartType
  titleMode: ChartTitleMode
  boundRunwayNames: string[]
  boundApproachProcedureIds: string[]
  sourceFilePath: string
  previewImagePath: string | null
  fileFormat: ChartFileFormat
  width: number | null
  height: number | null
  isGeoreferenced: boolean
  createdAt: number
  updatedAt: number
}

export interface ChartAirportSummary {
  airportCode: string
  chartCount: number
}

export interface GeoReferencePoint {
  id: string
  chartId: string
  index: 1 | 2
  mapLat: number
  mapLon: number
  chartX: number
  chartY: number
}

export interface ChartRegistration {
  chartId: string
  scale: number
  rotationDeg: number
  translateX: number
  translateY: number
  originLat: number
  originLon: number
  updatedAt: number
}

export interface StorageSummary {
  databasePath: string
  chartsRoot: string
  defaultChartsRoot: string
  legacyChartsRoot: string
}

export interface ChartImportResult {
  chart: ChartRecord
}

export type ChartBundleImportAction = 'create' | 'update'

export interface ChartBundleImportChartPreview {
  id: string
  title: string
  airportCode: string | null
  chartType: ChartType
  action: ChartBundleImportAction
  localTitle: string | null
  incomingUpdatedAt: number
  localUpdatedAt: number | null
  isOlderThanLocal: boolean
  assetSizeBytes: number
}

export interface ChartBundleImportPreview {
  sessionId: string
  fileName: string
  schemaVersion: number
  exportedAt: number
  charts: ChartBundleImportChartPreview[]
  totalAssetSizeBytes: number
}

export interface ChartBundleImportInput {
  sessionId: string
  chartIds: string[]
}

export interface ChartBundleImportResult {
  charts: ChartRecord[]
  createdCount: number
  updatedCount: number
}

export interface ChartBundleExportInput {
  chartIds: string[]
}

export interface ChartBundleExportResult {
  filePath: string
  chartCount: number
}

export type PickedChartFile = PickedDocumentFile
export type ChartImportFromUrlInput = DocumentImportFromUrlInput

export interface FinalizeChartImportInput {
  title: string
  sourcePath?: string | null
  sourceFileName?: string | null
  sourceFileBase64?: string | null
  sourceFileMimeType?: string | null
  sourceFileFormat?: ChartFileFormat | null
  displayImageBase64?: string | null
  displayImageMimeType?: string | null
}

export interface ChartUpdateInput {
  id: string
  title: string
  airportCode: string | null
  chartType: ChartType
  titleMode: ChartTitleMode
  boundRunwayNames: string[]
  boundApproachProcedureIds: string[]
}

export interface ChartAssetPayload extends Omit<DocumentAssetPayload, 'documentId'> {
  chartId: string
}
