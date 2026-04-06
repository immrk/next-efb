import { randomUUID } from 'node:crypto'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/channels'
import type { AppSettings, DesktopDevAction, DesktopWindowAction, DesktopWindowState } from '@shared/types'
import type {
  BuildFlightPlanInput,
  BuildFlightPlanResult,
  NavAirportOption,
  NavAirportProcedures,
  NavDataStatus,
  SimBriefImportInput,
  SimBriefImportResult
} from '@shared/flight-plan-types'
import type { NavMapFeatureCollection, NavMapQueryInput } from '@shared/nav-map-types'
import type {
  ChartAssetPayload,
  ChartImportResult,
  ChartRecord,
  FinalizeChartImportInput,
  PickedChartFile,
  ChartUpdateInput,
  GeoReferencePoint
} from '@shared/chart-types'
import { FlightStateStore } from '../services/state/FlightStateStore'
import { SettingsStore } from '../services/config/SettingsStore'
import { SimConnectService } from '../services/simconnect/SimConnectService'
import { ChartRepository } from '../services/storage/ChartRepository'
import { StorageService } from '../services/storage/StorageService'
import { LanServer } from '../services/lan/LanServer'
import { NavDataService } from '../services/navigation/NavDataService'

interface RegisterIpcOptions {
  mainWindow: BrowserWindow
  flightStateStore: FlightStateStore
  settingsStore: SettingsStore
  simConnectService: SimConnectService
  chartRepository: ChartRepository
  storageService: StorageService
  lanServer: LanServer
  navDataService: NavDataService
}

export function registerIpc(options: RegisterIpcOptions): void {
  const {
    mainWindow,
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService,
    lanServer,
    navDataService
  } = options

  simConnectService.onAircraftState((state) => {
    flightStateStore.setAircraftState(state)
    lanServer.broadcastAircraftState(state)
    mainWindow.webContents.send(IPC_CHANNELS.aircraftUpdate, state)
  })

  simConnectService.onConnectionState((state) => {
    flightStateStore.setConnectionState(state)
    lanServer.broadcastConnectionState(state)
    mainWindow.webContents.send(IPC_CHANNELS.connectionUpdate, state)
  })

  ipcMain.handle(IPC_CHANNELS.aircraftSnapshot, () => {
    return {
      aircraft: flightStateStore.getAircraftState(),
      connection: flightStateStore.getConnectionState()
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsGet, () => settingsStore.get())
  ipcMain.handle(IPC_CHANNELS.navDataStatus, (): NavDataStatus => navDataService.getStatus(settingsStore.get()))
  ipcMain.handle(IPC_CHANNELS.navDataPickSqlite, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })
  ipcMain.handle(IPC_CHANNELS.navAirportsSearch, (_event, query: string): NavAirportOption[] =>
    navDataService.searchAirports(settingsStore.get(), query)
  )
  ipcMain.handle(
    IPC_CHANNELS.navAirportProcedures,
    (_event, airportIdent: string): NavAirportProcedures =>
      navDataService.getAirportProcedures(settingsStore.get(), airportIdent)
  )
  ipcMain.handle(
    IPC_CHANNELS.navBuildPlan,
    (_event, input: BuildFlightPlanInput): BuildFlightPlanResult =>
      navDataService.buildFlightPlan(settingsStore.get(), input)
  )
  ipcMain.handle(
    IPC_CHANNELS.navMapFeatures,
    (_event, input: NavMapQueryInput): NavMapFeatureCollection =>
      navDataService.getMapFeatures(settingsStore.get(), input)
  )
  ipcMain.handle(
    IPC_CHANNELS.simbriefImport,
    async (_event, input: SimBriefImportInput): Promise<SimBriefImportResult> =>
      navDataService.importFromSimBrief({
        username: input.username ?? settingsStore.get().simbrief.username,
        userId: input.userId ?? settingsStore.get().simbrief.userId
      })
  )
  ipcMain.handle(IPC_CHANNELS.remoteAccessStatus, () => lanServer.getStatus())
  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url: string) => {
    await shell.openExternal(url)
    return true
  })
  ipcMain.handle(IPC_CHANNELS.windowStateGet, (): DesktopWindowState => getWindowState(mainWindow))
  ipcMain.handle(IPC_CHANNELS.windowAction, (_event, action: DesktopWindowAction): DesktopWindowState => {
    performWindowAction(mainWindow, action)
    return getWindowState(mainWindow)
  })
  ipcMain.handle(IPC_CHANNELS.devAction, (_event, action: DesktopDevAction): boolean => {
    performDevAction(mainWindow, action)
    return true
  })
  ipcMain.handle(IPC_CHANNELS.chartsList, () => chartRepository.listCharts())
  ipcMain.handle(IPC_CHANNELS.storageSummary, () => storageService.getSummary())
  ipcMain.handle(IPC_CHANNELS.chartGet, (_event, chartId: string) => chartRepository.getChart(chartId))
  ipcMain.handle(IPC_CHANNELS.chartReferenceGet, (_event, chartId: string) =>
    chartRepository.listReferencePoints(chartId)
  )
  ipcMain.handle(
    IPC_CHANNELS.chartReferenceSave,
    (_event, chartId: string, points: GeoReferencePoint[]) => {
      const saved = chartRepository.saveReferencePoints(chartId, points)
      lanServer.broadcastChartChanged()
      return saved
    }
  )
  ipcMain.handle(IPC_CHANNELS.chartUpdate, (_event, input: ChartUpdateInput) => {
    const updated = chartRepository.updateChart(input)
    lanServer.broadcastChartChanged()
    return updated
  })
  ipcMain.handle(IPC_CHANNELS.chartAsset, (_event, chartId: string): ChartAssetPayload | null => {
    const chart = chartRepository.getChart(chartId)
    if (!chart) return null

    const displayPath = chart.previewImagePath ?? chart.sourceFilePath
    return {
      chartId,
      fileFormat: chart.fileFormat,
      mimeType: getMimeType(chart),
      base64: storageService.readFileBase64(displayPath),
      filePath: displayPath
    }
  })
  ipcMain.handle(IPC_CHANNELS.chartImport, async (): Promise<PickedChartFile | null> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Charts', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const sourcePath = result.filePaths[0]
    const fileFormat = getFileFormat(sourcePath)

    return {
      sourcePath,
      fileName: sourcePath.split(/[/\\]/).pop() ?? 'chart',
      fileFormat,
      mimeType: getMimeTypeByFormat(fileFormat),
      base64: storageService.readFileBase64(sourcePath)
    }
  })
  ipcMain.handle(
    IPC_CHANNELS.chartFinalizeImport,
    (_event, input: FinalizeChartImportInput): ChartImportResult => {
      const chartId = randomUUID()
      const imported = input.sourcePath
        ? storageService.importChartFile(input.sourcePath, chartId)
        : input.sourceFileBase64 && input.sourceFileFormat
          ? storageService.writeChartSourceFile(chartId, input.sourceFileFormat, input.sourceFileBase64)
          : null

      if (!imported) {
        throw new Error('CHART_SOURCE_REQUIRED')
      }

      const sourceFormat = getFileFormat(imported.destinationPath)
      const displayPath =
        input.displayImageBase64 && input.displayImageMimeType
          ? storageService.writeChartDisplayImage(
              chartId,
              input.displayImageMimeType,
              input.displayImageBase64
            )
          : imported.destinationPath
      const displayFormat = getFileFormat(displayPath)
      const now = Date.now()

      const chart: ChartRecord = {
        id: chartId,
        title: input.title,
        airportCode: null,
        chartType: 'general',
        titleMode: 'manual',
        boundApproachProcedureId: null,
        sourceFilePath: imported.destinationPath,
        previewImagePath: displayPath,
        fileFormat: displayFormat,
        width: null,
        height: null,
        isGeoreferenced: false,
        createdAt: now,
        updatedAt: now
      }

      void sourceFormat

      return {
        chart: (() => {
          const created = chartRepository.createChart(chart)
          lanServer.broadcastChartChanged()
          return created
        })()
      }
    }
  )
  ipcMain.handle(IPC_CHANNELS.chartDelete, (_event, chartId: string) => {
    chartRepository.deleteChart(chartId)
    storageService.deleteChartFiles(chartId)
    lanServer.broadcastChartChanged()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, async (_event, partial: Partial<AppSettings>) => {
    const nextSettings = settingsStore.update(partial)
    simConnectService.reconfigure(nextSettings)
    await lanServer.reconfigure(nextSettings)
    lanServer.broadcastSettingsChanged()
    return nextSettings
  })
}

function getWindowState(window: BrowserWindow): DesktopWindowState {
  return {
    isMaximized: window.isMaximized()
  }
}

function performWindowAction(window: BrowserWindow, action: DesktopWindowAction): void {
  switch (action) {
    case 'minimize':
      window.minimize()
      break
    case 'toggle-maximize':
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
      break
    case 'close-to-tray':
      window.hide()
      break
    case 'show':
      if (window.isMinimized()) {
        window.restore()
      }
      window.show()
      window.focus()
      break
  }
}

function performDevAction(window: BrowserWindow, action: DesktopDevAction): void {
  switch (action) {
    case 'toggle-devtools':
      window.webContents.toggleDevTools()
      break
    case 'reload':
      window.webContents.reload()
      break
  }
}

function getDefaultTitle(filePath: string): string {
  const fileName = filePath.split(/[/\\]/).pop() ?? 'chart'
  return fileName.replace(/\.[^.]+$/, '')
}

function getFileFormat(filePath: string): ChartRecord['fileFormat'] {
  const ext = filePath.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'jpg') return 'jpg'
  if (ext === 'jpeg') return 'jpeg'
  return 'png'
}

function getMimeType(chart: ChartRecord): string {
  return getMimeTypeByFormat(chart.fileFormat)
}

function getMimeTypeByFormat(fileFormat: ChartRecord['fileFormat']): string {
  switch (fileFormat) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
    default:
      return 'image/png'
  }
}

function _legacyGetMimeType(chart: ChartRecord): string {
  switch (chart.fileFormat) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
    default:
      return 'image/png'
  }
}
