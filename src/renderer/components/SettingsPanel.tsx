import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getAppClient } from '../client'
import i18n from '../i18n'
import type { AppLanguage, AircraftSource, RemoteAccessStatus } from '@shared/types'
import type { NavDataStatus } from '@shared/flight-plan-types'
import type { StorageSummary } from '@shared/chart-types'
import { useAppStore } from '../store/useAppStore'
import { toast } from './ui/use-toast'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'

export function SettingsPanel() {
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const { t } = useTranslation()
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const [remoteAccessStatus, setRemoteAccessStatus] = useState<RemoteAccessStatus | null>(null)
  const [navDataStatus, setNavDataStatus] = useState<NavDataStatus | null>(null)
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null)
  const [portDraft, setPortDraft] = useState('31831')
  const [navPathDraft, setNavPathDraft] = useState('')
  const [chartsPathDraft, setChartsPathDraft] = useState('')
  const [simbriefUsernameDraft, setSimbriefUsernameDraft] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isMobileAccess, setIsMobileAccess] = useState(false)
  const [isSavingChartsPath, setIsSavingChartsPath] = useState(false)
  const isChinese = (settings?.language ?? i18n.language).toLowerCase().startsWith('zh')

  useEffect(() => {
    const refreshRemoteAccessStatus = () => {
      void appClient.getRemoteAccessStatus().then(setRemoteAccessStatus)
    }
    const refreshNavDataStatus = () => {
      void appClient.getNavDataStatus().then(setNavDataStatus)
    }
    const refreshStorageSummary = () => {
      void appClient.getStorageSummary().then(setStorageSummary)
    }

    refreshRemoteAccessStatus()
    refreshNavDataStatus()
    refreshStorageSummary()
    const offSettings = appClient.onSettingsChanged(() => {
      refreshRemoteAccessStatus()
      refreshNavDataStatus()
      refreshStorageSummary()
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
    setChartsPathDraft(settings?.storage.chartLibraryPath ?? storageSummary?.chartsRoot ?? '')
    setSimbriefUsernameDraft(settings?.simbrief.username ?? '')
  }, [settings?.navData.sqlitePath, settings?.storage.chartLibraryPath, settings?.simbrief.username, storageSummary?.chartsRoot])

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

  useEffect(() => {
    if (typeof window === 'undefined' || runtime.host === 'electron') {
      return
    }

    const widthQuery = window.matchMedia('(max-width: 900px)')
    const pointerQuery = window.matchMedia('(pointer: coarse)')
    const mobileUserAgentPattern =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

    const syncMobileAccess = () => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const isMobileViewport = viewportWidth <= 900 || widthQuery.matches
      const isTouchFirstDevice = pointerQuery.matches
      const isMobileUserAgent = mobileUserAgentPattern.test(window.navigator.userAgent)

      setIsMobileAccess(isMobileViewport || isTouchFirstDevice || isMobileUserAgent)
    }

    syncMobileAccess()
    widthQuery.addEventListener('change', syncMobileAccess)
    pointerQuery.addEventListener('change', syncMobileAccess)
    window.addEventListener('resize', syncMobileAccess)
    window.visualViewport?.addEventListener('resize', syncMobileAccess)

    return () => {
      widthQuery.removeEventListener('change', syncMobileAccess)
      pointerQuery.removeEventListener('change', syncMobileAccess)
      window.removeEventListener('resize', syncMobileAccess)
      window.visualViewport?.removeEventListener('resize', syncMobileAccess)
    }
  }, [runtime.host])

  const updateLanguage = async (language: AppLanguage): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ language })
    setSettings(nextSettings)
    await i18n.changeLanguage(language)
  }

  const updateProviderMode = async (providerMode: AircraftSource): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ providerMode })
    setSettings(nextSettings)
  }

  const updateChartOpacity = async (chartOpacity: number): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ chartOpacity })
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
    toast.success(t('feedback.saved'))
  }

  const saveChartLibraryPath = async (chartLibraryPath: string | null) => {
    setIsSavingChartsPath(true)

    try {
      const normalizedPath = chartLibraryPath?.trim() || null
      const nextSettings = await appClient.updateSettings({
        storage: {
          chartLibraryPath: normalizedPath
        }
      })
      setSettings(nextSettings)
      const nextSummary = await appClient.getStorageSummary()
      setStorageSummary(nextSummary)
      setChartsPathDraft(nextSettings.storage.chartLibraryPath ?? nextSummary.chartsRoot)
      toast.success(t('feedback.saved'))
    } finally {
      setIsSavingChartsPath(false)
    }
  }

  const saveSimBriefSettings = async () => {
    const nextSettings = await appClient.updateSettings({
      simbrief: {
        username: simbriefUsernameDraft.trim(),
        userId: ''
      }
    })
    setSettings(nextSettings)
    toast.success(t('feedback.saved'))
  }

  return (
    <Card className="settings-panel settings-panel-compact" aria-label={t('settings.title')}>
      <div className="settings-field">
        <label htmlFor="language-select">{t('settings.language')}</label>
        <Select
          value={settings?.language ?? 'zh-CN'}
          disabled={!runtime.canWrite}
          onValueChange={(value) => {
            void updateLanguage(value as AppLanguage)
          }}
        >
          <SelectTrigger id="language-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh-CN">{t('settings.languageZhCN')}</SelectItem>
            <SelectItem value="en-US">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {runtime.isDev && !isMobileAccess ? (
        <div className="settings-field">
          <label htmlFor="provider-select">{t('settings.provider')}</label>
          <Select
            value={settings?.providerMode ?? 'simconnect'}
            disabled={!runtime.canWrite}
            onValueChange={(value) => {
              void updateProviderMode(value as AircraftSource)
            }}
          >
            <SelectTrigger id="provider-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simconnect">{t('settings.providerSimConnect')}</SelectItem>
              <SelectItem value="mock">{t('settings.providerMock')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="settings-field">
        <label htmlFor="chart-opacity-range">{t('settings.chartOpacity')}</label>
        <div className="settings-note settings-note-card">
          <Slider
            id="chart-opacity-range"
            className="settings-chart-opacity-range"
            min={20}
            max={100}
            step={5}
            value={[settings?.chartOpacity ?? 100]}
            disabled={!runtime.canWrite}
            onValueChange={([value]) => {
              void updateChartOpacity(value)
            }}
          />
          <div className="settings-inline-row settings-chart-opacity-row">
            <span className="settings-note-inline">{t('settings.chartOpacityHint')}</span>
            <strong>{`${settings?.chartOpacity ?? 100}%`}</strong>
          </div>
        </div>
      </div>

      {!isMobileAccess ? (
        <div className="settings-field">
          <label>{t('settings.navDataTitle')}</label>
          <div className="settings-note settings-note-card">
            <span>{t('settings.navDataDefaultPath', { path: navDataStatus?.defaultPath ?? '-' })}</span>
            <span>
              {t('settings.navDataActivePath', { path: navDataStatus?.activePath ?? t('settings.navDataMissing') })}
            </span>
            <div className="settings-inline-row">
              <Input
                value={navPathDraft}
                onChange={(event) => setNavPathDraft(event.target.value)}
                placeholder={t('settings.navDataPathPlaceholder')}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const picked = await appClient.pickNavSqliteFile()
                  if (!picked) return
                  setNavPathDraft(picked)
                  await saveNavDataPath(picked)
                }}
              >
                {t('settings.navDataBrowse')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void saveNavDataPath(navPathDraft)
                }}
              >
                {t('settings.navDataSave')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setNavPathDraft('')
                  void saveNavDataPath('')
                }}
              >
                {t('settings.navDataClear')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!isMobileAccess ? (
        <div className="settings-field">
          <label>
            {t('settings.chartLibraryTitle', {
              defaultValue: isChinese ? '航图库路径' : 'Chart Library Path'
            })}
          </label>
          <div className="settings-note settings-note-card">
            <span>
              {t('settings.chartLibraryDefaultPath', {
                defaultValue: isChinese ? '默认路径：{{path}}' : 'Default path: {{path}}',
                path: storageSummary?.defaultChartsRoot ?? '-'
              })}
            </span>
            <span>
              {t('settings.chartLibraryActivePath', {
                defaultValue: isChinese ? '当前路径：{{path}}' : 'Current path: {{path}}',
                path: storageSummary?.chartsRoot ?? '-'
              })}
            </span>
            <span className="settings-note-inline">
              {t('settings.chartLibraryHint', {
                defaultValue: isChinese
                  ? '保存新路径后，已有航图文件会自动迁移到新位置。'
                  : 'Saving a new path will move existing chart files to the new location.'
              })}
            </span>
            <div className="settings-inline-row">
              <Input
                value={chartsPathDraft}
                onChange={(event) => setChartsPathDraft(event.target.value)}
                placeholder={storageSummary?.defaultChartsRoot ?? ''}
                disabled={!runtime.canWrite || isSavingChartsPath}
              />
              {runtime.host === 'electron' ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSavingChartsPath}
                onClick={async () => {
                  const picked = await appClient.pickChartsDirectory()
                  if (!picked) return
                  setChartsPathDraft(picked)
                }}
              >
                {t('settings.chartLibraryBrowse', { defaultValue: isChinese ? '浏览' : 'Browse' })}
              </Button>
            ) : null}
            <Button
                type="button"
                variant="secondary"
                disabled={!runtime.canWrite || isSavingChartsPath}
                onClick={() => {
                void saveChartLibraryPath(chartsPathDraft)
              }}
            >
              {t('settings.chartLibrarySave', { defaultValue: isChinese ? '保存路径' : 'Save Path' })}
            </Button>
            <Button
                type="button"
                variant="secondary"
                disabled={!runtime.canWrite || isSavingChartsPath}
                onClick={() => {
                void saveChartLibraryPath(null)
              }}
            >
              {t('settings.chartLibraryReset', { defaultValue: isChinese ? '恢复默认' : 'Use Default' })}
            </Button>
          </div>
        </div>
        </div>
      ) : null}

      <div className="settings-field">
        <label>{t('settings.simbriefTitle')}</label>
        <div className="settings-note settings-note-card">
          <Input
            value={simbriefUsernameDraft}
            onChange={(event) => setSimbriefUsernameDraft(event.target.value)}
            placeholder={t('settings.simbriefUsername')}
          />
          <div className="settings-inline-row">
            <Button type="button" variant="secondary" onClick={saveSimBriefSettings}>
              {t('settings.simbriefSave')}
            </Button>
          </div>
        </div>
      </div>

      {!isMobileAccess ? (
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
                  <Button
                    type="button"
                    variant="ghost"
                    className="settings-link-button"
                    onClick={() => {
                      void appClient.openExternal(remoteAccessStatus.primaryAccessUrl!)
                    }}
                  >
                    {remoteAccessStatus.primaryAccessUrl}
                  </Button>
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
                  <Switch
                    checked={settings.lanAccess.enabled}
                    onCheckedChange={(checked) => {
                      void updateLanAccess({ enabled: checked })
                    }}
                  />
                  <span>{t('settings.remoteAccessEnabledToggle')}</span>
                </label>
                <label className="settings-toggle">
                  <Switch
                    checked={settings.lanAccess.authEnabled}
                    onCheckedChange={(checked) => {
                      void updateLanAccess({ authEnabled: checked })
                    }}
                  />
                  <span>{t('settings.remoteAccessAuthToggle')}</span>
                </label>
                <div className="settings-inline-row">
                  <Input
                    className="settings-port-input"
                    type="number"
                    min={1024}
                    max={65535}
                    value={portDraft}
                    onChange={(event) => setPortDraft(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const nextPort = Number(portDraft)
                      if (!Number.isFinite(nextPort) || nextPort < 1024 || nextPort > 65535) {
                        return
                      }
                      void updateLanAccess({ port: nextPort })
                    }}
                  >
                    {t('settings.remoteAccessApplyPort')}
                  </Button>
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
      ) : null}

      {!runtime.canWrite ? <p className="settings-note">{t('settings.remoteReadonlyMode')}</p> : null}
    </Card>
  )
}
