"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  aircraftSnapshot: "aircraft:snapshot",
  aircraftUpdate: "aircraft:update",
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
  remoteAccessStatus: "remote-access:status",
  openExternal: "system:open-external"
};
const api = {
  getSnapshot: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.aircraftSnapshot),
  getSettings: async () => electron.ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
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
