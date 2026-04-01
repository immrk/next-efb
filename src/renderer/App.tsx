import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { AppRoute } from '@shared/types'
import type { FlightPlanSelection } from '@shared/flight-plan-types'
import { AppSidebar } from './components/AppSidebar'
import { useDesktopData } from './hooks/useDesktopData'
import { ChartDetailPage } from './pages/ChartDetailPage'
import { ChartsPage } from './pages/ChartsPage'
import { MapPage } from './pages/MapPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  const { t } = useTranslation()
  useDesktopData()
  const [route, setRoute] = useState<AppRoute>('map')
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [detailChartId, setDetailChartId] = useState<string | null>(null)
  const [chartDetailBackRoute, setChartDetailBackRoute] = useState<'map' | 'charts'>('charts')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [flightPlanSelection, setFlightPlanSelection] = useState<FlightPlanSelection | null>(null)
  const isFullBleedRoute =
    route === 'map' || route === 'charts' || route === 'chartDetail' || route === 'settings'

  return (
    <main className={`product-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <AppSidebar
        route={route === 'chartDetail' ? 'charts' : route}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        onNavigate={(nextRoute) => {
          if (nextRoute !== 'chartDetail') {
            setRoute(nextRoute)
          }
        }}
      />
      <section className={`app-shell ${isFullBleedRoute ? 'app-shell-fullbleed' : ''}`}>
        {isFullBleedRoute ? null : (
          <header className="topbar">
            <span>{t('app.subtitle')}</span>
          </header>
        )}

        <section className={`route-view ${route === 'map' ? 'active' : ''}`}>
          <MapPage
            flightPlanSelection={flightPlanSelection}
            onOpenChartLibrary={(chartId) => {
              setSelectedChartId(chartId ?? null)
              setRoute('charts')
            }}
            onEditChart={(chartId) => {
              setSelectedChartId(chartId)
              setDetailChartId(chartId)
              setChartDetailBackRoute('map')
              setRoute('chartDetail')
            }}
            onOpenSettings={() => setRoute('settings')}
            onFlightPlanSelectionChange={setFlightPlanSelection}
          />
        </section>

        <section className={`route-view ${route === 'charts' ? 'active' : ''}`}>
          <ChartsPage
            selectedChartId={selectedChartId}
            onSelectChart={setSelectedChartId}
            onEditChart={(chartId) => {
              setSelectedChartId(chartId)
              setDetailChartId(chartId)
              setChartDetailBackRoute('charts')
              setRoute('chartDetail')
            }}
          />
        </section>

        <section className={`route-view ${route === 'settings' ? 'active' : ''}`}>
          <SettingsPage />
        </section>

        {route === 'chartDetail' && detailChartId ? (
          <section className={`route-view ${route === 'chartDetail' ? 'active' : ''}`}>
            <ChartDetailPage
              chartId={detailChartId}
              onBack={() => setRoute(chartDetailBackRoute)}
              onSaved={() => void 0}
              onDeleted={() => {
                setSelectedChartId(null)
                setDetailChartId(null)
                setRoute(chartDetailBackRoute)
              }}
            />
          </section>
        ) : null}
      </section>
    </main>
  )
}
