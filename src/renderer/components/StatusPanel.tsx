import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'

function formatNumber(value: number | undefined, digits = 0): string {
  if (typeof value !== 'number') return '--'
  return value.toFixed(digits)
}

export function StatusPanel() {
  const { t } = useTranslation()
  const aircraft = useAppStore((state) => state.aircraft)

  return (
    <section className="panel status-panel">
      <div className="panel-header">
        <h2>{t('status.title')}</h2>
        <p>{t('status.subtitle')}</p>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>{t('status.altitude')}</span>
          <strong>{formatNumber(aircraft?.altitudeFt)} ft</strong>
        </article>
        <article className="stat-card">
          <span>{t('status.heading')}</span>
          <strong>{formatNumber(aircraft?.headingDeg)} deg</strong>
        </article>
        <article className="stat-card">
          <span>{t('status.speed')}</span>
          <strong>{formatNumber(aircraft?.groundSpeedKts, 1)} kts</strong>
        </article>
        <article className="stat-card">
          <span>{t('status.source')}</span>
          <strong>{aircraft?.source ?? '--'}</strong>
        </article>
      </div>
    </section>
  )
}
