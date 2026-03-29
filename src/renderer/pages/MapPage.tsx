import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChartRecord } from '@shared/chart-types'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { MapPanel } from '../components/MapPanel'
import { StatusPanel } from '../components/StatusPanel'
import { useChartLibraryData } from '../hooks/useChartLibraryData'

export function MapPage() {
  const { t } = useTranslation()
  const { charts } = useChartLibraryData()
  const georeferencedCharts = useMemo(
    () => charts.filter((chart) => chart.isGeoreferenced),
    [charts]
  )
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedChartId && georeferencedCharts.length > 0) {
      setSelectedChartId(georeferencedCharts[0].id)
    }
  }, [georeferencedCharts, selectedChartId])

  return (
    <>
      <header className="hero page-hero">
        <div>
          <p className="eyebrow">{t('nav.map')}</p>
          <h1>{t('pages.map.title')}</h1>
          <p className="hero-copy">{t('pages.map.subtitle')}</p>
        </div>
        <div className="map-toolbar">
          <div className="settings-field compact-field">
            <label>{t('map.overlaySelector')}</label>
            <select
              value={selectedChartId ?? ''}
              onChange={(event) => setSelectedChartId(event.target.value || null)}
            >
              <option value="">{t('map.overlayNone')}</option>
              {georeferencedCharts.map((chart: ChartRecord) => (
                <option key={chart.id} value={chart.id}>
                  {chart.title}
                </option>
              ))}
            </select>
          </div>
          <ConnectionBadge />
        </div>
      </header>

      <section className="content-grid">
        <MapPanel selectedChartId={selectedChartId} />
        <StatusPanel />
      </section>
    </>
  )
}
