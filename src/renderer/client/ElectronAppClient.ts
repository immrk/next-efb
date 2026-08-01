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

  getNavMapFeatures(input: Parameters<typeof window.msfsApi.getNavMapFeatures>[0]) {
    return window.msfsApi.getNavMapFeatures(input)
  }

  searchNavMapPoints(input: Parameters<typeof window.msfsApi.searchNavMapPoints>[0]) {
    return window.msfsApi.searchNavMapPoints(input)
  }

  importSimBrief(input: Parameters<typeof window.msfsApi.importSimBrief>[0]) {
    return window.msfsApi.importSimBrief(input)
  }

  getRemoteAccessStatus() {
    return window.msfsApi.getRemoteAccessStatus()
  }

  getAppUpdateState() {
    return window.msfsApi.getAppUpdateState()
  }

  checkForAppUpdate() {
    return window.msfsApi.checkForAppUpdate()
  }

  downloadAndInstallAppUpdate() {
    return window.msfsApi.downloadAndInstallAppUpdate()
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

  pickChartBundleImport() {
    return window.msfsApi.pickChartBundleImport()
  }

  importChartBundle(input: Parameters<typeof window.msfsApi.importChartBundle>[0]) {
    return window.msfsApi.importChartBundle(input)
  }

  exportChartBundle(input: Parameters<typeof window.msfsApi.exportChartBundle>[0]) {
    return window.msfsApi.exportChartBundle(input)
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

  pickChartsDirectory() {
    return window.msfsApi.pickChartsDirectory()
  }

  importChartFromUrl(input: Parameters<typeof window.msfsApi.importChartFromUrl>[0]) {
    return window.msfsApi.importChartFromUrl(input)
  }

  finalizeChartImport(input: Parameters<typeof window.msfsApi.finalizeChartImport>[0]) {
    return window.msfsApi.finalizeChartImport(input)
  }

  deleteChart(chartId: string) {
    return window.msfsApi.deleteChart(chartId)
  }

  getChecklist(checklistId: string) {
    return window.msfsApi.getChecklist(checklistId)
  }

  getChecklistAsset(checklistId: string) {
    return window.msfsApi.getChecklistAsset(checklistId)
  }

  listChecklists() {
    return window.msfsApi.listChecklists()
  }

  pickChecklistFile() {
    return window.msfsApi.pickChecklistFile()
  }

  importChecklistFromUrl(input: Parameters<typeof window.msfsApi.importChecklistFromUrl>[0]) {
    return window.msfsApi.importChecklistFromUrl(input)
  }

  finalizeChecklistImport(input: Parameters<typeof window.msfsApi.finalizeChecklistImport>[0]) {
    return window.msfsApi.finalizeChecklistImport(input)
  }

  deleteChecklist(checklistId: string) {
    return window.msfsApi.deleteChecklist(checklistId)
  }

  updateChecklist(input: Parameters<typeof window.msfsApi.updateChecklist>[0]) {
    return window.msfsApi.updateChecklist(input)
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

  onChecklistsChanged(listener: Parameters<typeof window.msfsApi.onChecklistsChanged>[0]) {
    return window.msfsApi.onChecklistsChanged(listener)
  }

  onSettingsChanged() {
    return () => void 0
  }

  onAppUpdateStateChange(listener: Parameters<typeof window.msfsApi.onAppUpdateStateChange>[0]) {
    return window.msfsApi.onAppUpdateStateChange(listener)
  }
}
