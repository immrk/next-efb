import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAppClient } from '../client'
import { ChartImagePreview } from '../components/ChartImagePreview'
import { ChartMountDrawer } from '../components/ChartMountDrawer'
import { useAppStore } from '../store/useAppStore'
import { useChartDetailData } from '../hooks/useChartDetailData'
import { useChartLibraryData } from '../hooks/useChartLibraryData'
import { toast } from '../components/ui/use-toast'
import { Card } from '../components/ui/card'
import { LibraryWorkspace } from '../components/LibraryWorkspace'

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
  const runtime = getAppClient().getRuntime()
  const { t } = useTranslation()
  const aircraft = useAppStore((state) => state.aircraft)
  const { charts, importChart, importChartFromUrl } = useChartLibraryData()
  const { chart, asset, points } = useChartDetailData(selectedChartId)
  const [importUrl, setImportUrl] = useState('')
  const [importingUrl, setImportingUrl] = useState(false)

  useEffect(() => {
    if (
      charts.length === 0 ||
      (selectedChartId && charts.some((chart) => chart.id === selectedChartId))
    ) return
    onSelectChart(charts[0].id)
  }, [charts, onSelectChart, selectedChartId])

  const handleImportChart = async () => {
    try {
      const result = await importChart()
      if (result?.chart) {
        onSelectChart(result.chart.id)
        toast.success(t('feedback.imported'))
      }
    } catch (error) {
      let message = t('charts.importFailed')
      if (error instanceof Error) {
        message = `${t('charts.importFailed')}\n${error.message}`
      }
      toast.error(message)
    }
  }

  const handleImportChartFromUrl = async () => {
    const normalizedUrl = importUrl.trim()
    if (!normalizedUrl) return

    setImportingUrl(true)
    try {
      const result = await importChartFromUrl(normalizedUrl)
      if (result?.chart) {
        onSelectChart(result.chart.id)
        setImportUrl('')
        toast.success(t('feedback.imported'))
      }
    } catch (error) {
      let message = t('charts.importUrlFailed')
      if (error instanceof Error) {
        message = `${t('charts.importUrlFailed')}\n${translateChartImportError(t, error.message)}`
      }
      toast.error(message)
    } finally {
      setImportingUrl(false)
    }
  }

  return (
    <LibraryWorkspace
      className="charts-workspace"
      library={<ChartMountDrawer
        mode="docked"
        charts={charts}
        selectedChartId={selectedChartId}
        closable={false}
        showPinButton={false}
        onSelect={onSelectChart}
        onEdit={runtime.canWrite ? onEditChart : undefined}
        onImport={runtime.canManageLocalFiles ? handleImportChart : undefined}
        importUrlValue={importUrl}
        importUrlPending={importingUrl}
        onImportUrlValueChange={setImportUrl}
        onImportFromUrl={runtime.canWrite ? handleImportChartFromUrl : undefined}
      />}
      preview={
        <Card className="charts-panel chart-preview-panel">
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
        </Card>
      }
    />
  )
}

function translateChartImportError(
  t: (key: string) => string,
  message: string
): string {
  if (message.startsWith('REMOTE_DOWNLOAD_FAILED:')) {
    return t('charts.importUrlErrorDownload')
  }

  switch (message) {
    case 'REMOTE_URL_INVALID':
      return t('charts.importUrlErrorInvalid')
    case 'REMOTE_FILE_EMPTY':
      return t('charts.importUrlErrorEmpty')
    case 'REMOTE_FILE_TYPE_UNSUPPORTED':
    case 'PDF_MULTI_PAGE_NOT_SUPPORTED':
      return t('charts.importUrlErrorUnsupported')
    default:
      return message
  }
}
