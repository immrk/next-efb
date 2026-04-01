import type { AppClient } from './AppClient'

export class ElectronAppClient implements AppClient {
  getRuntime() {
    return {
      host: 'electron' as const,
      canWrite: true,
      canManageLocalFiles: true,
      isDev: import.meta.env.DEV
    }
  }

  getSnapshot() {
    return window.msfsApi.getSnapshot()
  }

  getSettings() {
    return window.msfsApi.getSettings()
  }

  getNavDataStatus() {
    return window.msfsApi.getNavDataStatus()
  }

  pickNavSqliteFile() {
    return window.msfsApi.pickNavSqliteFile()
  }

  searchNavAirports(query: string) {
    return window.msfsApi.searchNavAirports(query)
  }

  getNavAirportProcedures(airportIdent: string) {
    return window.msfsApi.getNavAirportProcedures(airportIdent)
  }

  buildFlightPlan(input: Parameters<typeof window.msfsApi.buildFlightPlan>[0]) {
    return window.msfsApi.buildFlightPlan(input)
  }

  importSimBrief(input: Parameters<typeof window.msfsApi.importSimBrief>[0]) {
    return window.msfsApi.importSimBrief(input)
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

  getWindowState() {
    return window.msfsApi.getWindowState()
  }

  performWindowAction(action: Parameters<typeof window.msfsApi.performWindowAction>[0]) {
    return window.msfsApi.performWindowAction(action)
  }

  performDevAction(action: Parameters<typeof window.msfsApi.performDevAction>[0]) {
    return window.msfsApi.performDevAction(action)
  }

  onWindowStateChange(listener: Parameters<typeof window.msfsApi.onWindowStateChange>[0]) {
    return window.msfsApi.onWindowStateChange(listener)
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
