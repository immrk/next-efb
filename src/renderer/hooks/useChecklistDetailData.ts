import { useEffect, useState } from 'react'
import type {
  ChecklistAssetPayload,
  ChecklistRecord
} from '@shared/checklist-types'
import { getAppClient } from '../client'
import { subscribeChecklistChanged } from '../utils/checklistSync'

export function useChecklistDetailData(checklistId: string | null) {
  const appClient = getAppClient()
  const [checklist, setChecklist] = useState<ChecklistRecord | null>(null)
  const [asset, setAsset] = useState<ChecklistAssetPayload | null>(null)

  useEffect(() => {
    const refresh = () => {
      if (!checklistId) {
        setChecklist(null)
        setAsset(null)
        return
      }

      void appClient.getChecklist(checklistId).then(setChecklist)
      void appClient.getChecklistAsset(checklistId).then(setAsset)
    }

    refresh()
    return subscribeChecklistChanged(refresh)
  }, [appClient, checklistId])

  return {
    checklist,
    asset
  }
}
