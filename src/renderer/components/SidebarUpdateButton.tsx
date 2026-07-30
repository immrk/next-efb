import { Download, LoaderCircle, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { Button } from './ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card'

export function SidebarUpdateButton() {
  const { t } = useTranslation()
  const appUpdate = useAppStore((state) => state.appUpdate)
  const setAppUpdate = useAppStore((state) => state.setAppUpdate)
  const appClient = getAppClient()

  if (
    appClient.getRuntime().host !== 'electron' ||
    !appUpdate ||
    !['available', 'downloading', 'ready'].includes(appUpdate.phase)
  ) {
    return null
  }

  const isDownloading = appUpdate.phase === 'downloading'
  const isReady = appUpdate.phase === 'ready'

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="relative mb-2 w-full shadow-sm"
          aria-label={t('update.sidebarAction', {
            version: appUpdate.availableVersion ?? ''
          })}
          aria-disabled={isDownloading}
          onClick={() => {
            if (isDownloading) return
            void appClient.downloadAndInstallAppUpdate().then(setAppUpdate)
          }}
        >
          {isDownloading
            ? <LoaderCircle className="size-5 animate-spin" />
            : isReady
              ? <RotateCcw className="size-5" />
              : <Download className="size-5" />}
          <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-400 ring-2 ring-primary" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="end" sideOffset={12} className="w-72">
        <div className="grid gap-2">
          <strong>{t('update.availableTitle', {
            version: appUpdate.availableVersion ?? ''
          })}</strong>
          <p className="text-sm text-muted-foreground">
            {isDownloading
              ? t('update.sidebarDownloading', {
                  percent: Math.round(appUpdate.progressPercent ?? 0)
                })
              : isReady
                ? t('update.readyDescription')
                : t('update.sidebarHint')}
          </p>
          {appUpdate.releaseName ? (
            <p className="text-xs text-muted-foreground">{appUpdate.releaseName}</p>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
