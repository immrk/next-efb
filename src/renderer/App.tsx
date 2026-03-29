import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { AppRoute } from '@shared/types'
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

  const renderPage = () => {
    switch (route) {
      case 'chartDetail':
        return selectedChartId ? (
          <ChartDetailPage
            chartId={selectedChartId}
            onBack={() => setRoute('charts')}
            onSaved={() => void 0}
          />
        ) : (
          <ChartsPage
            onOpenChart={(chartId) => {
              setSelectedChartId(chartId)
              setRoute('chartDetail')
            }}
          />
        )
      case 'charts':
        return (
          <ChartsPage
            onOpenChart={(chartId) => {
              setSelectedChartId(chartId)
              setRoute('chartDetail')
            }}
          />
        )
      case 'settings':
        return <SettingsPage />
      case 'map':
      default:
        return <MapPage />
    }
  }

  return (
    <main className="product-shell">
      <AppSidebar
        route={route === 'chartDetail' ? 'charts' : route}
        onNavigate={(nextRoute) => {
          if (nextRoute !== 'chartDetail') {
            setRoute(nextRoute)
          }
        }}
      />
      <section className="app-shell">
        <header className="topbar">
          <span>{t('app.subtitle')}</span>
        </header>
        {renderPage()}
      </section>
    </main>
  )
}
