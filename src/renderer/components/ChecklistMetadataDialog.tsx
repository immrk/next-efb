import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface ChecklistMetadataDialogProps {
  mode: 'import' | 'edit'
  initialTitle: string
  initialAircraftModel: string
  pending: boolean
  onCancel: () => void
  onSubmit: (metadata: { title: string; aircraftModel: string }) => void
}

export function ChecklistMetadataDialog({
  mode,
  initialTitle,
  initialAircraftModel,
  pending,
  onCancel,
  onSubmit
}: ChecklistMetadataDialogProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initialTitle)
  const [aircraftModel, setAircraftModel] = useState(initialAircraftModel)
  const canSubmit = title.trim().length > 0 && aircraftModel.trim().length > 0
  const dialogTitle =
    mode === 'import'
      ? t('checklists.importDialogTitle')
      : t('checklists.editDialogTitle')

  return (
    <div
      className="chart-meta-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!pending) onCancel()
      }}
    >
      <section
        className="chart-meta-modal checklist-meta-modal"
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="chart-meta-modal-head">
          <div>
            <h3>{dialogTitle}</h3>
            <p className="checklist-meta-dialog-hint">
              {t('checklists.importDialogHint')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            onClick={onCancel}
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="chart-meta-modal-body checklist-meta-dialog-body">
          <label className="settings-field">
            <span>{t('checklists.title')}</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('checklists.titlePlaceholder')}
              autoFocus
            />
          </label>
          <label className="settings-field">
            <span>{t('checklists.aircraftModel')}</span>
            <Input
              value={aircraftModel}
              onChange={(event) => setAircraftModel(event.target.value.toUpperCase())}
              placeholder={t('checklists.aircraftModelPlaceholder')}
              spellCheck={false}
            />
          </label>
        </div>

        <footer className="chart-meta-modal-foot">
          <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={pending || !canSubmit}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                aircraftModel: aircraftModel.trim().toUpperCase()
              })
            }
          >
            {pending
              ? t('checklists.saving')
              : mode === 'import'
                ? t('checklists.confirmImport')
                : t('checklists.saveChanges')}
          </Button>
        </footer>
      </section>
    </div>
  )
}
