import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChartImagePreview } from '../components/ChartImagePreview'
import { ChartMountDrawer } from '../components/ChartMountDrawer'
import { useAppStore } from '../store/useAppStore'
import { useChartDetailData } from '../hooks/useChartDetailData'
import { useChartLibraryData } from '../hooks/useChartLibraryData'

interface ChartsPageProps {
  selectedChartId: string | null
  onSelectChart: (chartId: string) => void
  onEditChart: (chartId: string) => void
}

export function ChartsPage({
  selectedChartId,
  onSelectChart,
  onEditChart
}: ChartsPageProps) {
  const { t } = useTranslation()
  const aircraft = useAppStore((state) => state.aircraft)
  const { charts, importChart } = useChartLibraryData()
  const { chart, asset, points } = useChartDetailData(selectedChartId)

  useEffect(() => {
    if (charts.length === 0 || selectedChartId) return
    onSelectChart(charts[0].id)
  }, [charts, onSelectChart, selectedChartId])

  const handleImportChart = async () => {
    try {
      const result = await importChart()
      if (result?.chart) {
        onSelectChart(result.chart.id)
      }
    } catch (error) {
      let message = t('charts.importFailed')
      if (error instanceof Error) {
        message = `${t('charts.importFailed')}\n${error.message}`
      }
      window.alert(message)
    }
  }

  return (
    <section className="charts-workspace">
      <ChartMountDrawer
        mode="docked"
        charts={charts}
        selectedChartId={selectedChartId}
        closable={false}
        showPinButton={false}
        onSelect={onSelectChart}
        onEdit={onEditChart}
        onImport={handleImportChart}
      />

      <section className="chart-preview-pane">
        <section className="panel charts-panel chart-preview-panel">
          {chart ? (
            <ChartImagePreview
              chartTitle={chart.title}
              asset={asset}
              points={points}
              aircraft={aircraft}
            />
          ) : (
            <div className="empty-state">
              <strong>{t('charts.emptyTitle')}</strong>
              <p>{t('charts.emptyDescription')}</p>
            </div>
          )}
        </section>
      </section>
    </section>
  )
}
