import type { ChartRepository } from './ChartRepository.js'
import type { StorageService } from './StorageService.js'

export function reconcileChartLibrary(
  chartRepository: Pick<ChartRepository, 'reconcileMissingCharts'>,
  storageService: Pick<StorageService, 'deleteChartFiles'>,
  onChanged?: () => void
): string[] {
  const removedChartIds = chartRepository.reconcileMissingCharts()
  removedChartIds.forEach((chartId) => storageService.deleteChartFiles(chartId))
  if (removedChartIds.length > 0) onChanged?.()
  return removedChartIds
}
