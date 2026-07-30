import { useTranslation } from 'react-i18next'
import { SettingsPanel } from '../components/SettingsPanel'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <section className="settings-page-full" aria-label={t('pages.settings.title')}>
      <section className="settings-layout settings-layout-full">
        <SettingsPanel />
      </section>
    </section>
  )
}
