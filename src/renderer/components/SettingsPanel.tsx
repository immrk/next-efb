import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import type { AppLanguage, AircraftSource } from '@shared/types'
import { useAppStore } from '../store/useAppStore'

export function SettingsPanel() {
  const { t } = useTranslation()
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)

  const updateLanguage = async (language: AppLanguage): Promise<void> => {
    const nextSettings = await window.msfsApi.updateSettings({ language })
    setSettings(nextSettings)
    await i18n.changeLanguage(language)
  }

  const updateProviderMode = async (providerMode: AircraftSource): Promise<void> => {
    const nextSettings = await window.msfsApi.updateSettings({ providerMode })
    setSettings(nextSettings)
  }

  return (
    <section className="panel settings-panel settings-panel-compact" aria-label={t('settings.title')}>
      <div className="settings-field">
        <label htmlFor="language-select">{t('settings.language')}</label>
        <select
          id="language-select"
          value={settings?.language ?? 'zh-CN'}
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
          onChange={(event) => {
            void updateProviderMode(event.target.value as AircraftSource)
          }}
        >
          <option value="simconnect">{t('settings.providerSimConnect')}</option>
          <option value="mock">{t('settings.providerMock')}</option>
        </select>
      </div>
    </section>
  )
}
