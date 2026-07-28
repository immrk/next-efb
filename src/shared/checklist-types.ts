import type {
  DocumentAssetPayload,
  DocumentFileFormat,
  DocumentImportFromUrlInput,
  PickedDocumentFile
} from './document-types'

export interface ChecklistRecord {
  id: string
  title: string
  aircraftModel: string
  sourceFilePath: string
  fileFormat: DocumentFileFormat
  createdAt: number
  updatedAt: number
}

export interface ChecklistImportResult {
  checklist: ChecklistRecord
}

export interface FinalizeChecklistImportInput {
  title: string
  aircraftModel: string
  sourcePath?: string | null
  sourceFileName?: string | null
  sourceFileBase64?: string | null
  sourceFileMimeType?: string | null
  sourceFileFormat?: DocumentFileFormat | null
}

export interface ChecklistUpdateInput {
  id: string
  title: string
  aircraftModel: string
}

export interface ChecklistAssetPayload extends Omit<DocumentAssetPayload, 'documentId'> {
  checklistId: string
}

export type PickedChecklistFile = PickedDocumentFile
export type ChecklistImportFromUrlInput = DocumentImportFromUrlInput
