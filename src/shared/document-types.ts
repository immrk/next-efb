export type DocumentFileFormat = 'pdf' | 'png' | 'jpg' | 'jpeg'

export interface PickedDocumentFile {
  sourcePath?: string | null
  fileName: string
  fileFormat: DocumentFileFormat
  mimeType: string
  base64: string
}

export interface DocumentImportFromUrlInput {
  url: string
}

export interface DocumentAssetPayload {
  documentId: string
  fileFormat: DocumentFileFormat
  mimeType: string
  base64?: string | null
  url?: string | null
  filePath?: string | null
}
