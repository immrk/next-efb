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
import {
  ChartBundleExportDialog,
  ChartBundleImportDialog
} from '../components/ChartBundleDialogs'
import type { ChartBundleImportPreview } from '@shared/chart-types'

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
    charts,
    importChart,
    importChartFromUrl,
    pickChartBundleImport,
    importChartBundle,
    exportChartBundle
  } = useChartLibraryData()
  const { chart, asset, points } = useChartDetailData(selectedChartId)
  const [importUrl, setImportUrl] = useState('')
  const [importingUrl, setImportingUrl] = useState(false)
  const [bundlePreview, setBundlePreview] = useState<ChartBundleImportPreview | null>(null)
  const [importingBundle, setImportingBundle] = useState(false)
  const [showExportBundle, setShowExportBundle] = useState(false)
  const [exportingBundle, setExportingBundle] = useState(false)

  useEffect(() => {
    if (charts.length === 0 || selectedChartId) return
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

  const handlePickChartBundle = async () => {
    try {
      const preview = await pickChartBundleImport()
      if (preview) setBundlePreview(preview)
    } catch (error) {
      toast.error(translateChartBundleError(t, error))
    }
  }

  const handleImportChartBundle = async (chartIds: string[]) => {
    if (!bundlePreview) return
    setImportingBundle(true)
    try {
      const result = await importChartBundle({
        sessionId: bundlePreview.sessionId,
        chartIds
      })
      setBundlePreview(null)
      if (result.charts[0]) onSelectChart(result.charts[0].id)
      toast.success(
        t('charts.bundleImportSuccess', {
          create: result.createdCount,
          update: result.updatedCount
        })
      )
    } catch (error) {
      toast.error(translateChartBundleError(t, error))
    } finally {
      setImportingBundle(false)
    }
  }

  const handleExportChartBundle = async (chartIds: string[]) => {
    setExportingBundle(true)
    try {
      const result = await exportChartBundle(chartIds)
      if (!result) return
      setShowExportBundle(false)
      toast.success(
        t('charts.bundleExportSuccess', {
          count: result.chartCount,
          path: result.filePath
        })
      )
    } catch (error) {
      toast.error(translateChartBundleError(t, error))
    } finally {
      setExportingBundle(false)
    }
  }

  return (
    <>
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
          onImportBundle={runtime.host === 'electron' ? handlePickChartBundle : undefined}
          onExportBundle={
            runtime.host === 'electron' && charts.length > 0
              ? () => setShowExportBundle(true)
              : undefined
          }
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
      <ChartBundleImportDialog
        preview={bundlePreview}
        pending={importingBundle}
        onCancel={() => setBundlePreview(null)}
        onConfirm={handleImportChartBundle}
      />
      <ChartBundleExportDialog
        open={showExportBundle}
        charts={charts}
        initialChartId={selectedChartId}
        pending={exportingBundle}
        onCancel={() => setShowExportBundle(false)}
        onConfirm={handleExportChartBundle}
      />
    </>
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

function translateChartBundleError(
  t: (key: string) => string,
  error: unknown
): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('CHART_BUNDLE_IMPORT_SESSION_EXPIRED')) {
    return t('charts.bundleErrorExpired')
  }
  if (
    message.includes('CHART_BUNDLE_VERSION_UNSUPPORTED') ||
    message.includes('CHART_BUNDLE_FORMAT_UNSUPPORTED')
  ) {
    return t('charts.bundleErrorVersion')
  }
  if (
    message.includes('CHART_BUNDLE_TOO_LARGE') ||
    message.includes('CHART_BUNDLE_ENTRY_TOO_LARGE')
  ) {
    return t('charts.bundleErrorTooLarge')
  }
  if (message.includes('CHART_ASSET_MISSING')) {
    return t('charts.bundleErrorAssetMissing')
  }
  if (message.includes('CHART_BUNDLE_')) {
    return t('charts.bundleErrorInvalid')
  }
  return `${t('charts.bundleErrorGeneric')}\n${message}`
}
