import { useEffect, useState } from 'react'
import type {
  ChartBundleImportInput,
  ChartBundleImportPreview,
  ChartImportResult,
  ChartRecord,
  PickedChartFile,
  StorageSummary
} from '@shared/chart-types'
import { getAppClient } from '../client'
import { finalizePickedChart } from '../utils/chartImport'
import { notifyChartChanged, subscribeChartChanged } from '../utils/chartSync'

export function useChartLibraryData() {
  const appClient = getAppClient()
  const [charts, setCharts] = useState<ChartRecord[]>([])
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null)

  const refresh = () => {
    void appClient.listCharts().then(setCharts)
    void appClient.getStorageSummary().then(setStorageSummary)
  }

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeChartChanged(() => {
      refresh()
    })
    return () => {
      unsubscribe()
    }
  }, [appClient])

  const importPickedChart = async (picked: PickedChartFile | null): Promise<ChartImportResult | null> => {
    const result = await finalizePickedChart(appClient, picked)

    if (result) {
      refresh()
      notifyChartChanged()
    }
    return result
  }

  const importChart = async (): Promise<ChartImportResult | null> => {
    const picked = await appClient.pickChartFile()
    return importPickedChart(picked)
  }

  const importChartFromUrl = async (url: string): Promise<ChartImportResult | null> => {
    const picked = await appClient.importChartFromUrl({ url })
    return importPickedChart(picked)
  }

  const deleteChart = async (chartId: string): Promise<void> => {
    await appClient.deleteChart(chartId)
    refresh()
    notifyChartChanged()
  }

  const pickChartBundleImport = async (): Promise<ChartBundleImportPreview | null> =>
    appClient.pickChartBundleImport()

  const importChartBundle = async (input: ChartBundleImportInput) => {
    const result = await appClient.importChartBundle(input)
    refresh()
    notifyChartChanged()
    return result
  }

  const exportChartBundle = async (chartIds: string[]) =>
    appClient.exportChartBundle({ chartIds })

  return {
    charts,
    storageSummary,
    refresh,
    importChart,
    importChartFromUrl,
    pickChartBundleImport,
    importChartBundle,
    exportChartBundle,
    deleteChart
  }
}
