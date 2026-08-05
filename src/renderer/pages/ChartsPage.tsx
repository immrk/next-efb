import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAppClient } from '../client'
import { ChartImagePreview } from '../components/ChartImagePreview'
import { ChartMountDrawer } from '../components/ChartMountDrawer'
import { useAppStore } from '../store/useAppStore'
import { useChartDetailData } from '../hooks/useChartDetailData'
import { useChartAirportLibraryData } from '../hooks/useChartAirportLibraryData'
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
  const {
    airports,
    charts,
    expandedAirportCode,
    search,
    isLoadingAirports,
    isLoadingCharts,
    setExpandedAirportCode,
    setSearch,
    importChart,
    importChartFromUrl
  } = useChartAirportLibraryData()
  const { chart, asset, points, isLoading: isLoadingChartDetail } = useChartDetailData(selectedChartId)
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
        airports={airports}
        expandedAirportCode={expandedAirportCode}
        isAirportLoading={isLoadingCharts}
        isLoadingAirports={isLoadingAirports}
        searchValue={search}
        selectedChartId={selectedChartId}
        closable={false}
        showPinButton={false}
        onSelect={onSelectChart}
        onEdit={runtime.canWrite ? onEditChart : undefined}
        onExpandedAirportChange={setExpandedAirportCode}
        onSearchValueChange={setSearch}
        onImport={runtime.canManageLocalFiles ? handleImportChart : undefined}
        importUrlValue={importUrl}
        importUrlPending={importingUrl}
        onImportUrlValueChange={setImportUrl}
        onImportFromUrl={runtime.canWrite ? handleImportChartFromUrl : undefined}
      />}
      preview={
        <Card className="charts-panel chart-preview-panel">
          {chart && !isLoadingChartDetail ? (
            <ChartImagePreview
              chartTitle={chart.title}
              asset={asset}
              points={points}
              aircraft={aircraft}
            />
          ) : <ChartPreviewPlaceholder
            airportCount={airports.length}
            chartCount={charts.length}
            expandedAirportCode={expandedAirportCode}
            hasSearch={Boolean(search.trim())}
            isLoadingAirports={isLoadingAirports}
            isLoadingCharts={isLoadingCharts}
            isLoadingChartDetail={isLoadingChartDetail}
          />}
        </Card>
      }
    />
  )
}

export function ChartPreviewPlaceholder({
  airportCount,
  chartCount,
  expandedAirportCode,
  hasSearch,
  isLoadingAirports,
  isLoadingCharts,
  isLoadingChartDetail
}: {
  airportCount: number
  chartCount: number
  expandedAirportCode: string | null
  hasSearch: boolean
  isLoadingAirports: boolean
  isLoadingCharts: boolean
  isLoadingChartDetail: boolean
}) {
  const { t } = useTranslation()
  let title = t('charts.selectChartTitle')
  let description = t('charts.selectChartDescription')

  if (isLoadingAirports || isLoadingCharts || isLoadingChartDetail) {
    title = t('common.loading', { defaultValue: 'Loading...' })
    description = t('charts.loadingDescription')
  } else if (airportCount === 0 && hasSearch) {
    title = t('charts.searchEmpty')
    description = t('charts.searchEmptyDescription')
  } else if (airportCount === 0) {
    title = t('charts.emptyTitle')
    description = t('charts.emptyDescription')
  } else if (!expandedAirportCode) {
    title = t('charts.selectAirportTitle')
    description = t('charts.selectAirportDescription')
  } else if (chartCount === 0) {
    title = hasSearch ? t('charts.searchEmpty') : t('charts.airportEmptyTitle')
    description = hasSearch
      ? t('charts.searchEmptyDescription')
      : t('charts.airportEmptyDescription')
  }

  return (
    <div className="empty-state chart-preview-empty-state" role="status">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
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
