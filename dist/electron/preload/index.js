"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  aircraftSnapshot: "aircraft:snapshot",
  aircraftUpdate: "aircraft:update",
  windowAction: "window:action",
  windowStateGet: "window:state:get",
  windowStateChanged: "window:state:changed",
  chartAsset: "chart:asset",
  chartDelete: "chart:delete",
  chartFinalizeImport: "chart:finalize-import",
  chartGet: "chart:get",
  chartImport: "chart:pick-file",
  chartReferenceGet: "chart:reference:get",
  chartReferenceSave: "chart:reference:save",
  chartUpdate: "chart:update",
  chartsList: "charts:list",
  storageSummary: "storage:summary",
  connectionUpdate: "connection:update",
  settingsGet: "settings:get",
  settingsUpdate: "settings:update",
  navDataStatus: "nav-data:status",
  navDataPickSqlite: "nav-data:pick-sqlite",
  navAirportsSearch: "nav-data:airports:search",
  navAirportProcedures: "nav-data:airport:procedures",
  navBuildPlan: "nav-data:plan:build",
  simbriefImport: "simbrief:import",
  remoteAccessStatus: "remote-access:status",
  openExternal: "system:open-external",
  devAction: "dev:action"
};
const api = {
  getSnapshot: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.aircraftSnapshot),
  getSettings: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  getNavDataStatus: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.navDataStatus),
  pickNavSqliteFile: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.navDataPickSqlite),
  searchNavAirports: async (query) => electron.ipcRenderer.invoke(IPC_CHANNELS.navAirportsSearch, query),
  getNavAirportProcedures: async (airportIdent) => electron.ipcRenderer.invoke(IPC_CHANNELS.navAirportProcedures, airportIdent),
  buildFlightPlan: async (input) => electron.ipcRenderer.invoke(IPC_CHANNELS.navBuildPlan, input),
  importSimBrief: async (input) => electron.ipcRenderer.invoke(IPC_CHANNELS.simbriefImport, input),
  getChart: async (chartId) => electron.ipcRenderer.invoke(IPC_CHANNELS.chartGet, chartId),
  getChartAsset: async (chartId) => electron.ipcRenderer.invoke(IPC_CHANNELS.chartAsset, chartId),
  getChartReferencePoints: async (chartId) => electron.ipcRenderer.invoke(IPC_CHANNELS.chartReferenceGet, chartId),
  pickChartFile: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.chartImport),
  listCharts: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.chartsList),
  getStorageSummary: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.storageSummary),
  finalizeChartImport: async (input) => electron.ipcRenderer.invoke(IPC_CHANNELS.chartFinalizeImport, input),
  deleteChart: async (chartId) => electron.ipcRenderer.invoke(IPC_CHANNELS.chartDelete, chartId),
  saveChartReferencePoints: async (chartId, points) => electron.ipcRenderer.invoke(IPC_CHANNELS.chartReferenceSave, chartId, points),
  updateChart: async (input) => electron.ipcRenderer.invoke(IPC_CHANNELS.chartUpdate, input),
  updateSettings: async (partial) => electron.ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, partial),
  getRemoteAccessStatus: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.remoteAccessStatus),
  openExternal: async (url) => electron.ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  performWindowAction: async (action) => electron.ipcRenderer.invoke(IPC_CHANNELS.windowAction, action),
  getWindowState: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.windowStateGet),
  onWindowStateChange: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    electron.ipcRenderer.on(IPC_CHANNELS.windowStateChanged, wrapped);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.windowStateChanged, wrapped);
  },
  performDevAction: async (action) => electron.ipcRenderer.invoke(IPC_CHANNELS.devAction, action),
  onAircraftUpdate: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    electron.ipcRenderer.on(IPC_CHANNELS.aircraftUpdate, wrapped);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.aircraftUpdate, wrapped);
  },
  onConnectionUpdate: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    electron.ipcRenderer.on(IPC_CHANNELS.connectionUpdate, wrapped);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.connectionUpdate, wrapped);
  }
};
electron.contextBridge.exposeInMainWorld("msfsApi", api);
