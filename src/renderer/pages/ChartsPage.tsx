import { useTranslation } from 'react-i18next'
import { useChartLibraryData } from '../hooks/useChartLibraryData'

interface ChartsPageProps {
  onOpenChart: (chartId: string) => void
}

export function ChartsPage({ onOpenChart }: ChartsPageProps) {
  const { t } = useTranslation()
  const { charts, storageSummary, importChart, deleteChart } = useChartLibraryData()

  return (
    <>
      <header className="hero page-hero">
        <div>
          <p className="eyebrow">{t('nav.charts')}</p>
          <h1>{t('pages.charts.title')}</h1>
          <p className="hero-copy">{t('pages.charts.subtitle')}</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={async () => {
            try {
              const result = await importChart()
              if (result?.chart) {
                onOpenChart(result.chart.id)
              }
            } catch (error) {
              let message = t('charts.importFailed')

              if (error instanceof Error) {
                if (error.message === 'PDF_MULTI_PAGE_NOT_SUPPORTED') {
                  message = t('charts.multiPagePdfNotSupported')
                } else if (error.message === 'PDF_TO_IMAGE_FAILED') {
                  message = t('charts.pdfRasterizeFailed')
                } else if (error.message === 'CANVAS_CONTEXT_UNAVAILABLE') {
                  message = t('charts.canvasUnavailable')
                } else {
                  message = `${t('charts.importFailed')}\n${error.message}`
                }
              }

              window.alert(message)
            }
          }}
        >
          {t('charts.importAction')}
        </button>
      </header>

      <section className="charts-layout">
        <section className="panel charts-panel">
          <div className="panel-header">
            <h2>{t('charts.libraryTitle')}</h2>
            <p>{t('charts.librarySubtitle')}</p>
          </div>

          {charts.length === 0 ? (
            <div className="empty-state">
              <strong>{t('charts.emptyTitle')}</strong>
              <p>{t('charts.emptyDescription')}</p>
            </div>
          ) : (
            <div className="chart-list">
              {charts.map((chart) => (
                <article key={chart.id} className="chart-card">
                  <button
                    type="button"
                    className="chart-card chart-card-button"
                    onClick={() => onOpenChart(chart.id)}
                  >
                    <strong>{chart.title}</strong>
                    <span>{chart.airportCode ?? '----'}</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void deleteChart(chart.id)}
                  >
                    {t('charts.deleteAction')}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel charts-panel">
          <div className="panel-header">
            <h2>{t('charts.importTitle')}</h2>
            <p>{t('charts.importSubtitle')}</p>
          </div>

          <div className="checklist-card">
            <div>{t('charts.stepUpload')}</div>
            <div>{t('charts.stepMetadata')}</div>
            <div>{t('charts.stepReference')}</div>
            <div>{t('charts.stepViewer')}</div>
          </div>
        </section>

        <section className="panel charts-panel full-span">
          <div className="panel-header">
            <h2>{t('charts.storageTitle')}</h2>
            <p>{t('charts.storageSubtitle')}</p>
          </div>

          <div className="storage-grid">
            <article className="stat-card">
              <span>{t('charts.storageDatabase')}</span>
              <strong>{storageSummary?.databasePath ?? '--'}</strong>
            </article>
            <article className="stat-card">
              <span>{t('charts.storageChartsRoot')}</span>
              <strong>{storageSummary?.chartsRoot ?? '--'}</strong>
            </article>
          </div>
        </section>
      </section>
    </>
  )
}
