export type ChartType = 'airport' | 'sid' | 'star' | 'approach' | 'general'

export type ChartFileFormat = 'pdf' | 'png' | 'jpg' | 'jpeg'

export interface ChartRecord {
  id: string
  title: string
  airportCode: string | null
  chartType: ChartType
  sourceFilePath: string
  previewImagePath: string | null
  fileFormat: ChartFileFormat
  width: number | null
  height: number | null
  isGeoreferenced: boolean
  createdAt: number
  updatedAt: number
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
}

export interface ChartImportResult {
  chart: ChartRecord
}

export interface PickedChartFile {
  sourcePath: string
  fileName: string
  fileFormat: ChartFileFormat
  mimeType: string
  base64: string
}

export interface FinalizeChartImportInput {
  sourcePath: string
  title: string
  displayImageBase64?: string | null
  displayImageMimeType?: string | null
}

export interface ChartUpdateInput {
  id: string
  title: string
  airportCode: string | null
  chartType: ChartType
}

export interface ChartAssetPayload {
  chartId: string
  fileFormat: ChartFileFormat
  mimeType: string
  base64: string
  filePath: string
}
