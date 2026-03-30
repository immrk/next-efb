import type { AppClient } from './AppClient'

export class ElectronAppClient implements AppClient {
  getRuntime() {
    return {
      host: 'electron' as const,
      canWrite: true,
      canManageLocalFiles: true
    }
  }

  getSnapshot() {
    return window.msfsApi.getSnapshot()
  }

  getSettings() {
    return window.msfsApi.getSettings()
  }

  getRemoteAccessStatus() {
    return window.msfsApi.getRemoteAccessStatus()
  }

  getChart(chartId: string) {
    return window.msfsApi.getChart(chartId)
  }

  getChartAsset(chartId: string) {
    return window.msfsApi.getChartAsset(chartId)
  }

  getChartReferencePoints(chartId: string) {
    return window.msfsApi.getChartReferencePoints(chartId)
  }

  listCharts() {
    return window.msfsApi.listCharts()
  }

  getStorageSummary() {
    return window.msfsApi.getStorageSummary()
  }

  pickChartFile() {
    return window.msfsApi.pickChartFile()
  }

  finalizeChartImport(input: Parameters<typeof window.msfsApi.finalizeChartImport>[0]) {
    return window.msfsApi.finalizeChartImport(input)
  }

  deleteChart(chartId: string) {
    return window.msfsApi.deleteChart(chartId)
  }

  saveChartReferencePoints(
    chartId: string,
    points: Parameters<typeof window.msfsApi.saveChartReferencePoints>[1]
  ) {
    return window.msfsApi.saveChartReferencePoints(chartId, points)
  }

  updateChart(input: Parameters<typeof window.msfsApi.updateChart>[0]) {
    return window.msfsApi.updateChart(input)
  }

  updateSettings(partial: Parameters<typeof window.msfsApi.updateSettings>[0]) {
    return window.msfsApi.updateSettings(partial)
  }

  openExternal(url: string) {
    return window.msfsApi.openExternal(url)
  }

  onAircraftUpdate(listener: Parameters<typeof window.msfsApi.onAircraftUpdate>[0]) {
    return window.msfsApi.onAircraftUpdate(listener)
  }

  onConnectionUpdate(listener: Parameters<typeof window.msfsApi.onConnectionUpdate>[0]) {
    return window.msfsApi.onConnectionUpdate(listener)
  }

  onChartsChanged() {
    return () => void 0
  }

  onSettingsChanged() {
    return () => void 0
  }
}
