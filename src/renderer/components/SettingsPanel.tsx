import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getAppClient } from '../client'
import i18n from '../i18n'
import type { AppLanguage, AircraftSource, MapTileProvider, RemoteAccessStatus } from '@shared/types'
import { useAppStore } from '../store/useAppStore'

export function SettingsPanel() {
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const { t } = useTranslation()
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const [remoteAccessStatus, setRemoteAccessStatus] = useState<RemoteAccessStatus | null>(null)
  const [portDraft, setPortDraft] = useState('31831')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  useEffect(() => {
    const refreshRemoteAccessStatus = () => {
      void appClient.getRemoteAccessStatus().then(setRemoteAccessStatus)
    }

    refreshRemoteAccessStatus()
    const offSettings = appClient.onSettingsChanged(refreshRemoteAccessStatus)
    return () => {
      offSettings()
    }
  }, [appClient])

  useEffect(() => {
    setPortDraft(String(settings?.lanAccess.port ?? 31831))
  }, [settings?.lanAccess.port])

  useEffect(() => {
    const accessUrl = remoteAccessStatus?.primaryAccessUrl
    if (!accessUrl) {
      setQrCodeUrl(null)
      return
    }

    let active = true
    void QRCode.toDataURL(accessUrl, {
      margin: 1,
      width: 180
    }).then((url: string) => {
      if (active) {
        setQrCodeUrl(url)
      }
    })

    return () => {
      active = false
    }
  }, [remoteAccessStatus?.primaryAccessUrl])

  const updateLanguage = async (language: AppLanguage): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ language })
    setSettings(nextSettings)
    await i18n.changeLanguage(language)
  }

  const updateProviderMode = async (providerMode: AircraftSource): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ providerMode })
    setSettings(nextSettings)
  }

  const updateMapTileProvider = async (mapTileProvider: MapTileProvider): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ mapTileProvider })
    setSettings(nextSettings)
  }

  const updateLanAccess = async (partial: Partial<NonNullable<typeof settings>['lanAccess']>) => {
    if (!settings) return
    const nextSettings = await appClient.updateSettings({
      lanAccess: {
        ...settings.lanAccess,
        ...partial
      }
    })
    setSettings(nextSettings)
    const nextStatus = await appClient.getRemoteAccessStatus()
    setRemoteAccessStatus(nextStatus)
  }

  return (
    <section className="panel settings-panel settings-panel-compact" aria-label={t('settings.title')}>
      <div className="settings-field">
        <label htmlFor="language-select">{t('settings.language')}</label>
        <select
          id="language-select"
          value={settings?.language ?? 'zh-CN'}
          disabled={!runtime.canWrite}
          onChange={(event) => {
            void updateLanguage(event.target.value as AppLanguage)
          }}
        >
          <option value="zh-CN">{t('settings.languageZhCN')}</option>
          <option value="en-US">English</option>
        </select>
      </div>

      <div className="settings-field">
        <label htmlFor="provider-select">{t('settings.provider')}</label>
        <select
          id="provider-select"
          value={settings?.providerMode ?? 'simconnect'}
          disabled={!runtime.canWrite}
          onChange={(event) => {
            void updateProviderMode(event.target.value as AircraftSource)
          }}
        >
          <option value="simconnect">{t('settings.providerSimConnect')}</option>
          <option value="mock">{t('settings.providerMock')}</option>
        </select>
      </div>

      <div className="settings-field">
        <label htmlFor="map-tile-provider-select">{t('settings.mapTileProvider')}</label>
        <select
          id="map-tile-provider-select"
          value={settings?.mapTileProvider ?? 'osm'}
          disabled={!runtime.canWrite}
          onChange={(event) => {
            void updateMapTileProvider(event.target.value as MapTileProvider)
          }}
        >
          <option value="osm">{t('settings.mapTileProviderOsm')}</option>
          <option value="cartoLight">{t('settings.mapTileProviderCartoLight')}</option>
          <option value="osmfr">{t('settings.mapTileProviderOsmFr')}</option>
        </select>
        <span className="settings-note-inline">{t('settings.mapTileProviderHint')}</span>
      </div>

      <div className="settings-field">
        <label>{t('settings.remoteAccess')}</label>
        <div className="settings-note settings-note-card">
          <strong>
            {remoteAccessStatus?.running
              ? t('settings.remoteAccessEnabled')
              : t('settings.remoteAccessDisabled')}
          </strong>
          {remoteAccessStatus?.primaryAccessUrl ? (
            <div className="settings-remote-card">
              <div className="settings-remote-main">
                <button
                  type="button"
                  className="settings-link-button"
                  onClick={() => {
                    void appClient.openExternal(remoteAccessStatus.primaryAccessUrl!)
                  }}
                >
                  {remoteAccessStatus.primaryAccessUrl}
                </button>
                <span>{t('settings.remoteAccessOpenHint')}</span>
              </div>
              {qrCodeUrl ? (
                <div className="settings-qr-panel" aria-label={t('settings.remoteAccessQr')}>
                  <img src={qrCodeUrl} alt={t('settings.remoteAccessQr')} className="settings-qr-image" />
                </div>
              ) : null}
            </div>
          ) : null}
          {runtime.host === 'electron' && settings?.lanAccess ? (
            <>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.lanAccess.enabled}
                  onChange={(event) => {
                    void updateLanAccess({ enabled: event.target.checked })
                  }}
                />
                <span>{t('settings.remoteAccessEnabledToggle')}</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.lanAccess.authEnabled}
                  onChange={(event) => {
                    void updateLanAccess({ authEnabled: event.target.checked })
                  }}
                />
                <span>{t('settings.remoteAccessAuthToggle')}</span>
              </label>
              <div className="settings-inline-row">
                <input
                  className="text-input settings-port-input"
                  type="number"
                  min={1024}
                  max={65535}
                  value={portDraft}
                  onChange={(event) => setPortDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const nextPort = Number(portDraft)
                    if (!Number.isFinite(nextPort) || nextPort < 1024 || nextPort > 65535) {
                      return
                    }
                    void updateLanAccess({ port: nextPort })
                  }}
                >
                  {t('settings.remoteAccessApplyPort')}
                </button>
              </div>
              <span>{t('settings.remoteAccessPort', { port: settings.lanAccess.port })}</span>
              <span>{t('settings.remoteAccessToggleHint')}</span>
              {settings.lanAccess.authEnabled ? (
                <code className="settings-token">{settings.lanAccess.authToken}</code>
              ) : (
                <span>{t('settings.remoteAccessAuthDisabledHint')}</span>
              )}
            </>
          ) : (
            <span>{t('settings.remoteAccessReadonlyHint')}</span>
          )}
        </div>
      </div>

      {!runtime.canWrite ? <p className="settings-note">{t('settings.remoteReadonlyMode')}</p> : null}
    </section>
  )
}
