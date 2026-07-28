import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChecklistRecord, PickedChecklistFile } from '@shared/checklist-types'
import { ChecklistDocumentPreview } from '../components/ChecklistDocumentPreview'
import { ChecklistLibraryDrawer } from '../components/ChecklistLibraryDrawer'
import { ChecklistMetadataDialog } from '../components/ChecklistMetadataDialog'
import { LibraryWorkspace } from '../components/LibraryWorkspace'
import { Card } from '../components/ui/card'
import { toast } from '../components/ui/use-toast'
import { useChecklistDetailData } from '../hooks/useChecklistDetailData'
import { useChecklistLibraryData } from '../hooks/useChecklistLibraryData'

interface ChecklistsPageProps {
  selectedChecklistId: string | null
  onSelectChecklist: (checklistId: string) => void
}

export function ChecklistsPage({
  selectedChecklistId,
  onSelectChecklist
}: ChecklistsPageProps) {
  const { t } = useTranslation()
  const {
    checklists,
    pickChecklistFile,
    downloadChecklistFromUrl,
    finalizeChecklistImport,
    updateChecklist
  } = useChecklistLibraryData()
  const { checklist, asset } = useChecklistDetailData(selectedChecklistId)
  const [importUrl, setImportUrl] = useState('')
  const [importingUrl, setImportingUrl] = useState(false)
  const [pendingImport, setPendingImport] = useState<PickedChecklistFile | null>(null)
  const [editingChecklist, setEditingChecklist] = useState<ChecklistRecord | null>(null)
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)

  useEffect(() => {
    if (checklists.length === 0 || selectedChecklistId) return
    onSelectChecklist(checklists[0].id)
  }, [checklists, onSelectChecklist, selectedChecklistId])

  const handlePickChecklist = async () => {
    try {
      const picked = await pickChecklistFile()
      if (picked) setPendingImport(picked)
    } catch (error) {
      const detail = error instanceof Error ? `\n${error.message}` : ''
      toast.error(`${t('checklists.importFailed')}${detail}`)
    }
  }

  const handleImportChecklistFromUrl = async () => {
    const normalizedUrl = importUrl.trim()
    if (!normalizedUrl) return

    setImportingUrl(true)
    try {
      const picked = await downloadChecklistFromUrl(normalizedUrl)
      setPendingImport(picked)
    } catch (error) {
      let message = t('checklists.importUrlFailed')
      if (error instanceof Error) {
        message = `${message}\n${translateChecklistImportError(t, error.message)}`
      }
      toast.error(message)
    } finally {
      setImportingUrl(false)
    }
  }

  const handleFinalizeImport = async (metadata: {
    title: string
    aircraftModel: string
  }) => {
    if (!pendingImport) return
    setSavingMetadata(true)
    try {
      const result = await finalizeChecklistImport(pendingImport, metadata)
      if (result?.checklist) {
        onSelectChecklist(result.checklist.id)
        setPendingImport(null)
        setImportUrl('')
        toast.success(t('feedback.imported'))
      }
    } catch (error) {
      const detail = error instanceof Error ? `\n${error.message}` : ''
      toast.error(`${t('checklists.importFailed')}${detail}`)
    } finally {
      setSavingMetadata(false)
    }
  }

  const handleUpdateChecklist = async (metadata: {
    title: string
    aircraftModel: string
  }) => {
    if (!editingChecklist) return
    setSavingMetadata(true)
    try {
      await updateChecklist({
        id: editingChecklist.id,
        ...metadata
      })
      setEditingChecklist(null)
      toast.success(t('feedback.updated'))
    } catch (error) {
      const detail = error instanceof Error ? `\n${error.message}` : ''
      toast.error(`${t('checklists.updateFailed')}${detail}`)
    } finally {
      setSavingMetadata(false)
    }
  }

  return (
    <>
      <LibraryWorkspace
        className="checklists-workspace"
        libraryCollapsed={libraryCollapsed}
        onLibraryCollapsedChange={setLibraryCollapsed}
        collapseLibraryLabel={t('checklists.collapseSidebar')}
        expandLibraryLabel={t('checklists.expandSidebar')}
        library={
          <ChecklistLibraryDrawer
            checklists={checklists}
            selectedChecklistId={selectedChecklistId}
            importUrlValue={importUrl}
            importUrlPending={importingUrl}
            onSelect={onSelectChecklist}
            onEdit={(checklistId) => {
              const target = checklists.find((item) => item.id === checklistId)
              if (target) setEditingChecklist(target)
            }}
            onImportUrlValueChange={setImportUrl}
            onImport={() => void handlePickChecklist()}
            onImportFromUrl={() => void handleImportChecklistFromUrl()}
          />
        }
        preview={
          <Card className="charts-panel chart-preview-panel">
            {checklist ? (
              <ChecklistDocumentPreview title={checklist.title} asset={asset} />
            ) : (
              <div className="empty-state">
                <strong>{t('checklists.emptyTitle')}</strong>
                <p>{t('checklists.emptyDescription')}</p>
              </div>
            )}
          </Card>
        }
      />

      {pendingImport ? (
        <ChecklistMetadataDialog
          key={`import-${pendingImport.fileName}`}
          mode="import"
          initialTitle={pendingImport.fileName.replace(/\.[^.]+$/, '')}
          initialAircraftModel=""
          pending={savingMetadata}
          onCancel={() => setPendingImport(null)}
          onSubmit={(metadata) => void handleFinalizeImport(metadata)}
        />
      ) : null}

      {editingChecklist ? (
        <ChecklistMetadataDialog
          key={`edit-${editingChecklist.id}-${editingChecklist.updatedAt}`}
          mode="edit"
          initialTitle={editingChecklist.title}
          initialAircraftModel={editingChecklist.aircraftModel}
          pending={savingMetadata}
          onCancel={() => setEditingChecklist(null)}
          onSubmit={(metadata) => void handleUpdateChecklist(metadata)}
        />
      ) : null}
    </>
  )
}

function translateChecklistImportError(
  t: (key: string) => string,
  message: string
): string {
  if (message.startsWith('REMOTE_DOWNLOAD_FAILED:')) {
    return t('checklists.importUrlErrorDownload')
  }

  switch (message) {
    case 'REMOTE_URL_INVALID':
      return t('checklists.importUrlErrorInvalid')
    case 'REMOTE_FILE_EMPTY':
      return t('checklists.importUrlErrorEmpty')
    case 'REMOTE_FILE_TYPE_UNSUPPORTED':
      return t('checklists.importUrlErrorUnsupported')
    default:
      return message
  }
}
