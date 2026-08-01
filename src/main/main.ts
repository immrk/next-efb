import { app, BrowserWindow, Menu, Tray, dialog, nativeImage, session, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME } from '../shared/branding.js'
import { IPC_CHANNELS } from '../shared/channels.js'
import type { DesktopWindowState } from '../shared/types.js'
import { resolveAppLanguage, type AppLanguage } from '../shared/i18n.js'
import { WINDOW_NAMES } from '../config/windowConfig.js'
import { createMenu } from './menu.js'
import { setupIpcHandlers } from './ipc/index.js'
import { registerIpc } from './ipc/registerIpc.js'
import { initMainI18n, setLanguage, t } from './i18n/index.js'
import { SettingsStore } from './services/config/SettingsStore.js'
import { LanServer } from './services/lan/LanServer.js'
import { NavDataService } from './services/navigation/NavDataService.js'
import { SimConnectService } from './services/simconnect/SimConnectService.js'
import { FlightStateStore } from './services/state/FlightStateStore.js'
import { ChartRepository } from './services/storage/ChartRepository.js'
import { ChecklistRepository } from './services/storage/ChecklistRepository.js'
import { StorageService } from './services/storage/StorageService.js'
import { AppUpdateService } from './services/updates/AppUpdateService.js'
import { VatsimDataService } from './services/vatsim/VatsimDataService.js'
import { windowManager } from './windowManager.js'
import '../utils/logger.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TILE_REQUEST_URLS = [
  'https://server.arcgisonline.com/*',
  'https://tile.openstreetmap.org/*',
  'https://a.tile.openstreetmap.org/*',
  'https://b.tile.openstreetmap.org/*',
  'https://c.tile.openstreetmap.org/*',
  'https://a.tile.openstreetmap.fr/*',
  'https://b.tile.openstreetmap.fr/*',
  'https://c.tile.openstreetmap.fr/*',
  'https://a.basemaps.cartocdn.com/*',
  'https://b.basemaps.cartocdn.com/*',
  'https://c.basemaps.cartocdn.com/*',
  'https://d.basemaps.cartocdn.com/*'
]
const APP_TILE_REFERER = 'https://nextefb.app/'

let appTray: Tray | null = null
let activeVatsimDataService: VatsimDataService | null = null
let isQuitting = false
let hasShownSingleInstanceNotice = false
const appUpdateService = new AppUpdateService({
  beforeInstall: () => {
    isQuitting = true
  }
})

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

app.whenReady().then(async () => {
  await initMainI18n()
  configureTileRequestHeaders()
  setupIpcHandlers()
  createMenu(windowManager)
  await createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow()
    } else {
      showMainWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  activeVatsimDataService?.stop()
  activeVatsimDataService = null
})

app.on('second-instance', () => {
  showMainWindow()
  notifyAlreadyRunning()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

async function createMainWindow(): Promise<void> {
  const instance = windowManager.createWindow(WINDOW_NAMES.main, {
    title: APP_NAME,
    minWidth: 1100,
    minHeight: 720,
    icon: getBrandingAssetPath('app-icon-256.png')
  })
  const mainWindow = instance?.window
  if (!mainWindow) {
    throw new Error('Unable to create the main window.')
  }

  const settingsStore = new SettingsStore(resolveAppLanguage(app.getLocale()))
  await applyAppLanguage(settingsStore.get().language)
  const flightStateStore = new FlightStateStore()
  const simConnectService = new SimConnectService(settingsStore.get())
  const storageService = new StorageService()
  const navDataService = new NavDataService()
  activeVatsimDataService?.stop()
  const vatsimDataService = new VatsimDataService({
    navDataService,
    getSettings: () => settingsStore.get()
  })
  activeVatsimDataService = vatsimDataService
  const chartRepository = new ChartRepository(storageService.getSummary())
  const checklistRepository = new ChecklistRepository(storageService.getSummary().databasePath)
  const lanServer = new LanServer({
    settings: settingsStore.get(),
    rendererRoot: join(__dirname, '../renderer/window/main'),
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    checklistRepository,
    storageService,
    navDataService,
    vatsimDataService,
    onLanguageChanged: applyAppLanguage
  })

  attachWindowGuards(mainWindow)
  appUpdateService.attachWindow(mainWindow)
  ensureTray()
  registerIpc({
    mainWindow,
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    checklistRepository,
    storageService,
    lanServer,
    navDataService,
    vatsimDataService,
    appUpdateService,
    onLanguageChanged: applyAppLanguage
  })

  vatsimDataService.start()
  simConnectService.start()
  await lanServer.start()
  sendWindowState(mainWindow)
  appUpdateService.scheduleInitialCheck()
}

function attachWindowGuards(mainWindow: BrowserWindow): void {
  const appUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:11069'
    : `file://${join(__dirname, '../renderer/window/main/index.html').replace(/\\/g, '/')}`

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url, appUrl)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url, appUrl)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow.hide()
  })
  mainWindow.on('maximize', () => sendWindowState(mainWindow))
  mainWindow.on('unmaximize', () => sendWindowState(mainWindow))
}

function configureTileRequestHeaders(): void {
  const userAgent = `${APP_NAME}/${app.getVersion()} (Electron ${process.versions.electron})`
  app.userAgentFallback = userAgent
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: TILE_REQUEST_URLS }, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'User-Agent': userAgent,
        Referer: APP_TILE_REFERER
      }
    })
  })
}

function ensureTray(): void {
  if (appTray) return
  appTray = new Tray(nativeImage.createFromPath(getBrandingAssetPath('tray-icon-32.png')))
  appTray.setToolTip(APP_NAME)
  refreshTrayContextMenu()
  appTray.on('click', showMainWindow)
  appTray.on('double-click', showMainWindow)
}

function refreshTrayContextMenu(): void {
  if (!appTray) return
  appTray.setContextMenu(Menu.buildFromTemplate([
    { label: t('app.trayShow', { appName: APP_NAME }), click: showMainWindow },
    {
      label: t('app.trayExit'),
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ]))
}

function showMainWindow(): void {
  const mainWindow = windowManager.getWindow(WINDOW_NAMES.main)?.window
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  sendWindowState(mainWindow)
}

function notifyAlreadyRunning(): void {
  const mainWindow = windowManager.getWindow(WINDOW_NAMES.main)?.window
  if (!mainWindow || mainWindow.isDestroyed() || hasShownSingleInstanceNotice) return
  hasShownSingleInstanceNotice = true
  void dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: [t('app.dialogOk')],
    defaultId: 0,
    noLink: true,
    title: APP_NAME,
    message: t('app.alreadyRunning', { appName: APP_NAME }),
    detail: t('app.alreadyRunningDetail')
  }).finally(() => {
    hasShownSingleInstanceNotice = false
  })
}

function sendWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  const payload: DesktopWindowState = { isMaximized: window.isMaximized() }
  window.webContents.send(IPC_CHANNELS.windowStateChanged, payload)
}

function getBrandingAssetPath(fileName: string): string {
  return join(app.getAppPath(), 'assets', 'branding', fileName)
}

async function applyAppLanguage(language: AppLanguage): Promise<void> {
  await setLanguage(language)
  createMenu(windowManager)
  refreshTrayContextMenu()
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('system:changeLanguage', language)
    }
  })
}

function isExternalUrl(targetUrl: string, appUrl: string): boolean {
  if (!isSupportedExternalUrl(targetUrl)) return false
  try {
    const target = new URL(targetUrl)
    const appLocation = new URL(appUrl)
    return appLocation.protocol === 'file:'
      ? target.protocol !== 'file:'
      : target.origin !== appLocation.origin
  } catch {
    return false
  }
}

function isSupportedExternalUrl(url: string): boolean {
  try {
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}
