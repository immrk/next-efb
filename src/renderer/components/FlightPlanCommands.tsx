import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Download,
  LoaderCircle,
  Map,
  PlaneTakeoff,
  Trash2,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

type PendingFlightPlanAction = 'import' | 'clear'

interface FlightPlanCommandsProps {
  isImporting: boolean
  importDisabled?: boolean
  className?: string
  onImport: () => Promise<void> | void
  onClear: () => void
}

export function FlightPlanCommands({
  isImporting,
  importDisabled = false,
  className,
  onImport,
  onClear
}: FlightPlanCommandsProps) {
  const { t } = useTranslation()
  const [pendingAction, setPendingAction] = useState<PendingFlightPlanAction | null>(
    null
  )

  const confirmAction = () => {
    const action = pendingAction
    setPendingAction(null)

    if (action === 'import') {
      void onImport()
    } else if (action === 'clear') {
      onClear()
    }
  }

  return (
    <>
      <div className={cn('flight-plan-command-group', className)}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="flight-plan-head-command"
          disabled={isImporting || importDisabled}
          onClick={() => setPendingAction('import')}
        >
          {isImporting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          <span>{t('flightPlan.importSimbrief')}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flight-plan-head-command"
          disabled={isImporting}
          onClick={() => setPendingAction('clear')}
        >
          <Trash2 className="size-4" />
          <span>{t('flightPlan.clear')}</span>
        </Button>
      </div>

      {pendingAction ? (
        <FlightPlanConfirmationDialog
          action={pendingAction}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      ) : null}
    </>
  )
}

interface FlightPlanConfirmationDialogProps {
  action: PendingFlightPlanAction
  onCancel: () => void
  onConfirm: () => void
}

function FlightPlanConfirmationDialog({
  action,
  onCancel,
  onConfirm
}: FlightPlanConfirmationDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const isClear = action === 'clear'
  const keyPrefix = isClear ? 'flightPlan.confirmClear' : 'flightPlan.confirmImport'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return createPortal(
    <div
      className="chart-meta-modal-backdrop flight-plan-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <section
        className="chart-meta-modal flight-plan-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="chart-meta-modal-head flight-plan-confirm-head">
          <div className="flight-plan-confirm-title">
            <span
              className={cn(
                'flight-plan-confirm-title-icon',
                isClear && 'is-destructive'
              )}
              aria-hidden="true"
            >
              {isClear ? (
                <Trash2 className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
            </span>
            <h3 id={titleId}>{t(`${keyPrefix}Title`)}</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCancel}
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="chart-meta-modal-body flight-plan-confirm-body">
          <p id={descriptionId} className="flight-plan-confirm-description">
            {t(`${keyPrefix}Description`)}
          </p>
          <div className="flight-plan-confirm-impact-list">
            <div className="flight-plan-confirm-impact">
              <Map className="size-4" aria-hidden="true" />
              <span>{t(`${keyPrefix}MapImpact`)}</span>
            </div>
            <div className="flight-plan-confirm-impact">
              <PlaneTakeoff className="size-4" aria-hidden="true" />
              <span>{t(`${keyPrefix}FlightImpact`)}</span>
            </div>
          </div>
          <p
            className={cn(
              'flight-plan-confirm-note',
              isClear && 'is-destructive'
            )}
          >
            <AlertTriangle className="size-4" aria-hidden="true" />
            <span>{t(`${keyPrefix}Note`)}</span>
          </p>
        </div>

        <footer className="chart-meta-modal-foot">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            autoFocus
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={isClear ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
          >
            {isClear ? (
              <Trash2 className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
            {t(`${keyPrefix}Action`)}
          </Button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
