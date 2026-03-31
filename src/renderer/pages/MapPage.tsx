import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChartRecord } from '@shared/chart-types'
import type { BuildFlightPlanResult, FlightPlanPoint } from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { ChartMountDrawer } from '../components/ChartMountDrawer'
import { FlightPlanDrawer } from '../components/FlightPlanDrawer'
import { MapPanel } from '../components/MapPanel'
import { useChartLibraryData } from '../hooks/useChartLibraryData'

interface MapPageProps {
  onOpenChartLibrary: (chartId: string) => void
  onEditChart: (chartId: string) => void
  onOpenSettings: () => void
}

export function MapPage({ onOpenChartLibrary, onEditChart, onOpenSettings }: MapPageProps) {
  const runtime = getAppClient().getRuntime()
  const { t } = useTranslation()
  const { charts } = useChartLibraryData()
  const georeferencedCharts = useMemo(
    () => charts.filter((chart) => chart.isGeoreferenced),
    [charts]
  )
  const [mountedChartIds, setMountedChartIds] = useState<string[]>([])
  const [activeChartId, setActiveChartId] = useState<string | null>(null)
  const [isChartDrawerOpen, setIsChartDrawerOpen] = useState(false)
  const [isFlightPlanDrawerOpen, setIsFlightPlanDrawerOpen] = useState(false)
  const [flightPlanPoints, setFlightPlanPoints] = useState<FlightPlanPoint[]>([])

  const mountedCharts = useMemo(
    () =>
      mountedChartIds
        .map((chartId) => georeferencedCharts.find((chart) => chart.id === chartId))
        .filter((chart): chart is ChartRecord => Boolean(chart)),
    [georeferencedCharts, mountedChartIds]
  )

  useEffect(() => {
    setMountedChartIds((current) =>
      current.filter((chartId) => georeferencedCharts.some((chart) => chart.id === chartId))
    )
  }, [georeferencedCharts])

  useEffect(() => {
    if (mountedChartIds.length === 0) {
      if (activeChartId !== null) {
        setActiveChartId(null)
      }
      return
    }

    if (!activeChartId || !mountedChartIds.includes(activeChartId)) {
      setActiveChartId(mountedChartIds[mountedChartIds.length - 1] ?? null)
    }
  }, [activeChartId, mountedChartIds])

  const mountChart = (chartId: string) => {
    const chart = charts.find((item) => item.id === chartId)
    if (!chart?.isGeoreferenced) return

    setMountedChartIds((current) => (current.includes(chartId) ? current : [...current, chartId]))
    setActiveChartId(chartId)
  }

  const unmountChart = (chartId: string) => {
    setMountedChartIds((current) => current.filter((id) => id !== chartId))
  }

  const handlePlanBuilt = (result: BuildFlightPlanResult) => {
    setFlightPlanPoints(result.points)
  }

  return (
    <section className="map-workspace">
      <MapPanel
        mountedChartIds={mountedChartIds}
        activeChartId={activeChartId}
        routePoints={flightPlanPoints}
      />

      <section className="chart-dock">
        <div className="chart-dock-main">
          <button
            type="button"
            className="chart-dock-add-button"
            onClick={() => setIsChartDrawerOpen(true)}
            aria-label={t('charts.add')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5V19M5 12H19" />
            </svg>
          </button>
          <button
            type="button"
            className="chart-dock-add-button"
            onClick={() => setIsFlightPlanDrawerOpen(true)}
            aria-label={t('flightPlan.openDrawer')}
            title={t('flightPlan.openDrawer')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7H7L10 13L14 9L17 13H21" />
              <path d="M7 7L9 5M17 13L19 11" />
            </svg>
          </button>

          {mountedCharts.length > 0 ? (
            <div className="chart-dock-bar">
              {mountedCharts.map((chart) => {
                const isActive = chart.id === activeChartId
                return (
                  <article
                    key={chart.id}
                    className={`mounted-chart-card ${isActive ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className="mounted-chart-main"
                      onClick={() => setActiveChartId(chart.id)}
                    >
                      <strong>{`${chart.airportCode ?? '----'} · ${chart.title}`}</strong>
                    </button>
                    <button
                      type="button"
                      className="mounted-chart-remove"
                      onClick={() => unmountChart(chart.id)}
                      aria-label={t('charts.unmountAria', { title: chart.title })}
                    >
                      x
                    </button>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="chart-dock-empty-inline">{t('charts.emptyTitle')}</div>
          )}
        </div>
      </section>

      <ChartMountDrawer
        mode="overlay"
        isOpen={isChartDrawerOpen}
        charts={charts}
        selectedChartId={activeChartId}
        mountedChartIds={mountedChartIds}
        onClose={() => setIsChartDrawerOpen(false)}
        onSelect={onOpenChartLibrary}
        onEdit={runtime.canWrite ? onEditChart : undefined}
        onPin={mountChart}
      />

      <FlightPlanDrawer
        isOpen={isFlightPlanDrawerOpen}
        onClose={() => setIsFlightPlanDrawerOpen(false)}
        onOpenSettings={onOpenSettings}
        onPlanBuilt={handlePlanBuilt}
        onClearPlan={() => setFlightPlanPoints([])}
      />
    </section>
  )
}
