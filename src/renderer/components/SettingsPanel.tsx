import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getAppClient } from '../client'
import i18n from '../i18n'
import type { AppLanguage, AircraftSource, MapTileProvider, RemoteAccessStatus } from '@shared/types'
import type { NavDataStatus } from '@shared/flight-plan-types'
import { useAppStore } from '../store/useAppStore'

export function SettingsPanel() {
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const { t } = useTranslation()
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const [remoteAccessStatus, setRemoteAccessStatus] = useState<RemoteAccessStatus | null>(null)
  const [navDataStatus, setNavDataStatus] = useState<NavDataStatus | null>(null)
  const [portDraft, setPortDraft] = useState('31831')
  const [navPathDraft, setNavPathDraft] = useState('')
  const [simbriefUsernameDraft, setSimbriefUsernameDraft] = useState('')
  const [simbriefUserIdDraft, setSimbriefUserIdDraft] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  useEffect(() => {
    const refreshRemoteAccessStatus = () => {
      void appClient.getRemoteAccessStatus().then(setRemoteAccessStatus)
    }
    const refreshNavDataStatus = () => {
      void appClient.getNavDataStatus().then(setNavDataStatus)
    }

    refreshRemoteAccessStatus()
    refreshNavDataStatus()
    const offSettings = appClient.onSettingsChanged(() => {
      refreshRemoteAccessStatus()
      refreshNavDataStatus()
    })
    return () => {
      offSettings()
    }
  }, [appClient])

  useEffect(() => {
    setPortDraft(String(settings?.lanAccess.port ?? 31831))
  }, [settings?.lanAccess.port])

  useEffect(() => {
    setNavPathDraft(settings?.navData.sqlitePath ?? '')
    setSimbriefUsernameDraft(settings?.simbrief.username ?? '')
    setSimbriefUserIdDraft(settings?.simbrief.userId ?? '')
  }, [settings?.navData.sqlitePath, settings?.simbrief.userId, settings?.simbrief.username])

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

  const saveNavDataPath = async (sqlitePath: string) => {
    const nextSettings = await appClient.updateSettings({
      navData: {
        autoDetect: true,
        sqlitePath: sqlitePath.trim() || null
      }
    })
    setSettings(nextSettings)
    const nextStatus = await appClient.getNavDataStatus()
    setNavDataStatus(nextStatus)
  }

  const saveSimBriefSettings = async () => {
    const nextSettings = await appClient.updateSettings({
      simbrief: {
        username: simbriefUsernameDraft.trim(),
        userId: simbriefUserIdDraft.trim()
      }
    })
    setSettings(nextSettings)
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
        <label>{t('settings.navDataTitle')}</label>
        <div className="settings-note settings-note-card">
          <span>{t('settings.navDataDefaultPath', { path: navDataStatus?.defaultPath ?? '-' })}</span>
          <span>
            {t('settings.navDataActivePath', { path: navDataStatus?.activePath ?? t('settings.navDataMissing') })}
          </span>
          <div className="settings-inline-row">
            <input
              className="text-input"
              value={navPathDraft}
              onChange={(event) => setNavPathDraft(event.target.value)}
              placeholder={t('settings.navDataPathPlaceholder')}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const picked = await appClient.pickNavSqliteFile()
                if (!picked) return
                setNavPathDraft(picked)
                await saveNavDataPath(picked)
              }}
            >
              {t('settings.navDataBrowse')}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void saveNavDataPath(navPathDraft)
              }}
            >
              {t('settings.navDataSave')}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setNavPathDraft('')
                void saveNavDataPath('')
              }}
            >
              {t('settings.navDataClear')}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-field">
        <label>{t('settings.simbriefTitle')}</label>
        <div className="settings-note settings-note-card">
          <input
            className="text-input"
            value={simbriefUsernameDraft}
            onChange={(event) => setSimbriefUsernameDraft(event.target.value)}
            placeholder={t('settings.simbriefUsername')}
          />
          <input
            className="text-input"
            value={simbriefUserIdDraft}
            onChange={(event) => setSimbriefUserIdDraft(event.target.value)}
            placeholder={t('settings.simbriefUserId')}
          />
          <div className="settings-inline-row">
            <button type="button" className="secondary-button" onClick={saveSimBriefSettings}>
              {t('settings.simbriefSave')}
            </button>
          </div>
        </div>
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
