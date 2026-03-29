import { useTranslation } from 'react-i18next'
import { SettingsPanel } from '../components/SettingsPanel'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <>
      <header className="hero page-hero">
        <div>
          <p className="eyebrow">{t('nav.settings')}</p>
          <h1>{t('pages.settings.title')}</h1>
          <p className="hero-copy">{t('pages.settings.subtitle')}</p>
        </div>
      </header>

      <section className="settings-layout">
        <SettingsPanel />
      </section>
    </>
  )
}
