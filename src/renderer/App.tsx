import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import type { AppRoute } from '@shared/types'
import type { BuildFlightPlanInput } from '@shared/flight-plan-types'
import { AppSidebar } from './components/AppSidebar'
import { DesktopTitleBar } from './components/DesktopTitleBar'
import { SafeAreaTopInset } from './components/SafeAreaTopInset'
import { getAppClient } from './client'
import { useDesktopData } from './hooks/useDesktopData'
import { ChartDetailPage } from './pages/ChartDetailPage'
import { ChartsPage } from './pages/ChartsPage'
import { MapPage } from './pages/MapPage'
import { SettingsPage } from './pages/SettingsPage'
import { persistStoredFlightPlanDraft, readStoredFlightPlanDraft } from './utils/flightPlanPersistence'

export function App() {
  const { t } = useTranslation()
  const runtime = getAppClient().getRuntime()
  useDesktopData()
  const [route, setRoute] = useState<AppRoute>('map')
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [detailChartId, setDetailChartId] = useState<string | null>(null)
  const [chartDetailBackRoute, setChartDetailBackRoute] = useState<'map' | 'charts'>('charts')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [flightPlanDraft, setFlightPlanDraft] = useState<BuildFlightPlanInput>(() =>
    readStoredFlightPlanDraft()
  )

  useEffect(() => {
    persistStoredFlightPlanDraft(flightPlanDraft)
  }, [flightPlanDraft])
  const isFullBleedRoute =
    route === 'map' || route === 'charts' || route === 'chartDetail' || route === 'settings'
  const showDesktopTitleBar = runtime.host === 'electron'
  const appShellClassName = [
    'app-shell',
    isFullBleedRoute ? 'app-shell-fullbleed' : '',
    route === 'map' ? 'app-shell-map' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={`desktop-shell ${showDesktopTitleBar ? 'desktop-shell-with-titlebar' : ''}`}>
      {showDesktopTitleBar ? <DesktopTitleBar /> : null}

      <div className={`product-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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
        <section className={appShellClassName}>
          {isFullBleedRoute ? null : (
            <header className="topbar">
              <span>{t('app.subtitle')}</span>
            </header>
          )}

          <section className={`route-view ${route === 'map' ? 'active' : ''}`}>
            <MapPage
              flightPlanDraft={flightPlanDraft}
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
              onFlightPlanDraftChange={setFlightPlanDraft}
            />
          </section>

          <section className={`route-view route-view-with-safe-area ${route === 'charts' ? 'active' : ''}`}>
            <SafeAreaTopInset className="route-safe-area-top" />
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

          <section className={`route-view route-view-with-safe-area ${route === 'settings' ? 'active' : ''}`}>
            <SafeAreaTopInset className="route-safe-area-top" />
            <SettingsPage />
          </section>

          {route === 'chartDetail' && detailChartId ? (
            <section className={`route-view route-view-with-safe-area ${route === 'chartDetail' ? 'active' : ''}`}>
              <SafeAreaTopInset className="route-safe-area-top" />
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
      </div>
    </main>
  )
}
