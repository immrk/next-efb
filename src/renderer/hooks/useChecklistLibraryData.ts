import { useEffect, useState } from 'react'
import type {
  ChecklistImportResult,
  ChecklistRecord,
  ChecklistUpdateInput,
  PickedChecklistFile
} from '@shared/checklist-types'
import { getAppClient } from '../client'
import {
  notifyChecklistChanged,
  subscribeChecklistChanged
} from '../utils/checklistSync'

export function useChecklistLibraryData() {
  const appClient = getAppClient()
  const [checklists, setChecklists] = useState<ChecklistRecord[]>([])

  const refresh = () => {
    void appClient.listChecklists().then(setChecklists)
  }

  useEffect(() => {
    refresh()
    return subscribeChecklistChanged(refresh)
  }, [appClient])

  const finalizeChecklistImport = async (
    picked: PickedChecklistFile,
    metadata: { title: string; aircraftModel: string }
  ): Promise<ChecklistImportResult | null> => {
    const result = await appClient.finalizeChecklistImport({
      title: metadata.title,
      aircraftModel: metadata.aircraftModel,
      sourcePath: picked.sourcePath,
      sourceFileName: picked.fileName,
      sourceFileBase64: picked.base64,
      sourceFileMimeType: picked.mimeType,
      sourceFileFormat: picked.fileFormat
    })

    refresh()
    notifyChecklistChanged()
    return result
  }

  const pickChecklistFile = (): Promise<PickedChecklistFile | null> => {
    return appClient.pickChecklistFile()
  }

  const downloadChecklistFromUrl = (url: string): Promise<PickedChecklistFile> => {
    return appClient.importChecklistFromUrl({ url })
  }

  const updateChecklist = async (
    input: ChecklistUpdateInput
  ): Promise<ChecklistRecord | null> => {
    const updated = await appClient.updateChecklist(input)
    refresh()
    notifyChecklistChanged()
    return updated
  }

  return {
    checklists,
    refresh,
    pickChecklistFile,
    downloadChecklistFromUrl,
    finalizeChecklistImport,
    updateChecklist
  }
}
