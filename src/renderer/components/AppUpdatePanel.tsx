import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  LoaderCircle,
  RefreshCw,
  RotateCcw
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppUpdatePhase, AppUpdateState } from '@shared/update-types'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export function AppUpdatePanel() {
  const { t, i18n } = useTranslation()
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const appUpdate = useAppStore((state) => state.appUpdate)
  const setAppUpdate = useAppStore((state) => state.setAppUpdate)
  const [isInvoking, setIsInvoking] = useState(false)

  const invoke = async (operation: () => Promise<AppUpdateState>) => {
    setIsInvoking(true)
    try {
      setAppUpdate(await operation())
    } finally {
      setIsInvoking(false)
    }
  }

  const isBusy =
    isInvoking || appUpdate?.phase === 'checking' || appUpdate?.phase === 'downloading'
  const canInstall = appUpdate?.phase === 'available' || appUpdate?.phase === 'ready'

  return (
    <div className="settings-field">
      <label>{t('update.title')}</label>
      <div className="settings-note settings-note-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <strong>{t('update.currentVersion', {
              version: appUpdate?.currentVersion || t('update.unknownVersion')
            })}</strong>
            <span className="settings-note-inline">
              {getStatusText(appUpdate, t)}
            </span>
          </div>
          <UpdateStatusBadge phase={appUpdate?.phase ?? 'idle'} />
        </div>

        {appUpdate?.availableVersion ? (
          <div className="grid gap-1 rounded-lg border bg-background/60 p-3">
            <strong>{appUpdate.releaseName || `NextEFB v${appUpdate.availableVersion}`}</strong>
            <span className="settings-note-inline">
              {t('update.latestVersion', { version: appUpdate.availableVersion })}
              {appUpdate.releaseDate
                ? ` · ${formatReleaseDate(appUpdate.releaseDate, i18n.language)}`
                : ''}
            </span>
            {appUpdate.releaseNotes ? (
              <p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {appUpdate.releaseNotes}
              </p>
            ) : null}
          </div>
        ) : null}

        {appUpdate?.phase === 'downloading' ? (
          <div className="grid gap-2" aria-label={t('update.downloadProgress')}>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${appUpdate.progressPercent ?? 0}%` }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{Math.round(appUpdate.progressPercent ?? 0)}%</span>
              <span>{formatDownloadProgress(appUpdate)}</span>
            </div>
          </div>
        ) : null}

        {appUpdate?.errorMessage ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{appUpdate.errorMessage}</span>
          </div>
        ) : null}

        <div className="settings-inline-row">
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy || runtime.host !== 'electron'}
            onClick={() => {
              void invoke(() => appClient.checkForAppUpdate())
            }}
          >
            <RefreshCw className={appUpdate?.phase === 'checking' ? 'animate-spin' : ''} />
            {appUpdate?.phase === 'checking' ? t('update.checking') : t('update.checkAction')}
          </Button>

          {canInstall ? (
            <Button
              type="button"
              disabled={isInvoking}
              onClick={() => {
                void invoke(() => appClient.downloadAndInstallAppUpdate())
              }}
            >
              {appUpdate?.phase === 'ready' ? <RotateCcw /> : <Download />}
              {appUpdate?.phase === 'ready'
                ? t('update.restartAndInstall')
                : t('update.downloadAndInstall')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function UpdateStatusBadge({ phase }: { phase: AppUpdatePhase }) {
  const { t } = useTranslation()
  const isError = phase === 'error'
  const isReady = phase === 'up-to-date' || phase === 'ready'
  const isBusy = phase === 'checking' || phase === 'downloading'

  return (
    <Badge variant={isError ? 'destructive' : isReady ? 'secondary' : 'outline'}>
      {isBusy ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
      {t(`update.phase.${phase}`)}
    </Badge>
  )
}

function getStatusText(
  state: AppUpdateState | null,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!state) return t('update.loading')
  if (state.phase === 'available' && state.availableVersion) {
    return t('update.availableDescription', { version: state.availableVersion })
  }
  if (state.phase === 'downloading') {
    return t('update.downloadingDescription')
  }
  if (state.phase === 'ready') {
    return t('update.readyDescription')
  }
  return t(`update.description.${state.phase}`)
}

function formatReleaseDate(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

function formatDownloadProgress(state: AppUpdateState): string {
  if (!state.totalBytes || state.transferredBytes === null) return ''
  return `${formatBytes(state.transferredBytes)} / ${formatBytes(state.totalBytes)}`
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 MB'
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
