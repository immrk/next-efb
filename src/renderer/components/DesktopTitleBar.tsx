import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@shared/branding'
import { getAppClient } from '../client'
import { BRAND_ICON_URL } from '../branding'

function WindowControlIcon({ kind }: { kind: 'minimize' | 'maximize' | 'restore' | 'close' | 'tools' | 'refresh' }) {
  if (kind === 'minimize') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12H19" />
      </svg>
    )
  }

  if (kind === 'maximize') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="2" />
      </svg>
    )
  }

  if (kind === 'restore') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 9H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
        <path d="M11 5H17a2 2 0 0 1 2 2V13" />
        <path d="M10 14L19 5" />
      </svg>
    )
  }

  if (kind === 'tools') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 5L7 8L10 11" />
        <path d="M14 13L17 16L14 19" />
        <path d="M17 8H7" />
        <path d="M7 16H17" />
      </svg>
    )
  }

  if (kind === 'refresh') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11A8 8 0 1 0 18 16" />
        <path d="M20 4V11H13" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6L18 18" />
      <path d="M18 6L6 18" />
    </svg>
  )
}

export function DesktopTitleBar() {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let active = true

    void appClient.getWindowState().then((state) => {
      if (active) {
        setIsMaximized(state.isMaximized)
      }
    })

    const unsubscribe = appClient.onWindowStateChange((state) => {
      setIsMaximized(state.isMaximized)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [appClient])

  if (runtime.host !== 'electron') {
    return null
  }

  return (
    <header className="desktop-titlebar">
      <div className="desktop-titlebar-left">
        <div className="desktop-titlebar-brand">
          <span className="desktop-titlebar-logo" aria-hidden="true">
            <img src={BRAND_ICON_URL} alt="" />
          </span>
          <div className="desktop-titlebar-copy">
            <strong>{APP_NAME}</strong>
            <span>{t('desktop.chromeSubtitle')}</span>
          </div>
        </div>

        {runtime.isDev ? (
          <div className="desktop-dev-actions no-drag">
            <button type="button" className="desktop-dev-button" onClick={() => void appClient.performDevAction('toggle-devtools')}>
              <WindowControlIcon kind="tools" />
              <span>{t('desktop.devtools')}</span>
            </button>
            <button type="button" className="desktop-dev-button" onClick={() => void appClient.performDevAction('reload')}>
              <WindowControlIcon kind="refresh" />
              <span>{t('desktop.reload')}</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="desktop-window-controls no-drag">
        <button
          type="button"
          className="desktop-window-button"
          onClick={() => void appClient.performWindowAction('minimize')}
          aria-label={t('desktop.minimize')}
          title={t('desktop.minimize')}
        >
          <WindowControlIcon kind="minimize" />
        </button>
        <button
          type="button"
          className="desktop-window-button"
          onClick={() => void appClient.performWindowAction('toggle-maximize')}
          aria-label={isMaximized ? t('desktop.restore') : t('desktop.maximize')}
          title={isMaximized ? t('desktop.restore') : t('desktop.maximize')}
        >
          <WindowControlIcon kind={isMaximized ? 'restore' : 'maximize'} />
        </button>
        <button
          type="button"
          className="desktop-window-button desktop-window-button-close"
          onClick={() => void appClient.performWindowAction('close-to-tray')}
          aria-label={t('desktop.hideToTray')}
          title={t('desktop.hideToTray')}
        >
          <WindowControlIcon kind="close" />
        </button>
      </div>
    </header>
  )
}
