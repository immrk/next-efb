export const IPC_CHANNELS = {
  aircraftSnapshot: 'aircraft:snapshot',
  aircraftUpdate: 'aircraft:update',
  chartAsset: 'chart:asset',
  chartDelete: 'chart:delete',
  chartFinalizeImport: 'chart:finalize-import',
  chartGet: 'chart:get',
  chartImport: 'chart:pick-file',
  chartReferenceGet: 'chart:reference:get',
  chartReferenceSave: 'chart:reference:save',
  chartUpdate: 'chart:update',
  chartsList: 'charts:list',
  storageSummary: 'storage:summary',
  connectionUpdate: 'connection:update',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update'
} as const
