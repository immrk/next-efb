import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  dialog,
  nativeImage,
  session
} from 'electron'
import { join } from 'node:path'
import { WINDOW_NAMES } from '../config/windowConfig'
import { APP_NAME } from '@shared/branding'
import { IPC_CHANNELS } from '@shared/channels'
import type { DesktopWindowState } from '@shared/types'
import { registerIpc } from './ipc/registerIpc'
import { registerTemplateIpc } from './ipc/registerTemplateIpc'
import { windowManager } from './windowManager'
import { FlightStateStore } from './services/state/FlightStateStore'
import { SettingsStore } from './services/config/SettingsStore'
import { SimConnectService } from './services/simconnect/SimConnectService'
import { ChartRepository } from './services/storage/ChartRepository'
import { StorageService } from './services/storage/StorageService'
import { LanServer } from './services/lan/LanServer'
import { NavDataService } from './services/navigation/NavDataService'

let appTray: Tray | null = null
let isQuitting = false
let hasShownSingleInstanceNotice = false
let simConnectService: SimConnectService | null = null
let lanServer: LanServer | null = null

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

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.whenReady().then(initializeApplication)
}

async function initializeApplication(): Promise<void> {
  configureTileRequestHeaders()
  registerTemplateIpc()

  const instance = windowManager.createWindow(WINDOW_NAMES.main, {
    icon: getBrandingAssetPath('app-icon-256.png')
  })
  if (!instance) throw new Error('MAIN_WINDOW_CREATE_FAILED')
  const mainWindow = instance.window

  const settingsStore = new SettingsStore(resolveSystemLanguage(app.getLocale()))
  const flightStateStore = new FlightStateStore()
  simConnectService = new SimConnectService(settingsStore.get())
  const storageService = new StorageService()
  const navDataService = new NavDataService()
  const chartRepository = new ChartRepository(storageService.getSummary())
  lanServer = new LanServer({
    settings: settingsStore.get(),
    rendererRoot: join(import.meta.dirname, '../renderer/window/main'),
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService,
    navDataService
  })

  registerIpc({
    mainWindow,
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService,
    lanServer,
    navDataService
  })

  installMainWindowBehavior(mainWindow)
  ensureTray()
  simConnectService.start()
  await lanServer.start()
  sendWindowState(mainWindow)

  app.on('activate', () => windowManager.showWindow(WINDOW_NAMES.main))
}

app.on('before-quit', () => {
  isQuitting = true
  simConnectService?.stop()
  void lanServer?.stop()
})

app.on('second-instance', () => {
  windowManager.showWindow(WINDOW_NAMES.main)
  const mainWindow = windowManager.getWindow(WINDOW_NAMES.main)?.window
  if (mainWindow) notifyAlreadyRunning(mainWindow)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function installMainWindowBehavior(mainWindow: BrowserWindow): void {
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
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: TILE_REQUEST_URLS },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'User-Agent': userAgent,
          Referer: 'https://nextefb.app/'
        }
      })
    }
  )
}

function ensureTray(): void {
  if (appTray) return
  appTray = new Tray(nativeImage.createFromPath(getBrandingAssetPath('tray-icon-32.png')))
  appTray.setToolTip(APP_NAME)
  appTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `Show ${APP_NAME}`,
        click: () => windowManager.showWindow(WINDOW_NAMES.main)
      },
      {
        label: 'Exit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  appTray.on('click', () => windowManager.showWindow(WINDOW_NAMES.main))
  appTray.on('double-click', () => windowManager.showWindow(WINDOW_NAMES.main))
}

function sendWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  const payload: DesktopWindowState = { isMaximized: window.isMaximized() }
  window.webContents.send(IPC_CHANNELS.windowStateChanged, payload)
}

function notifyAlreadyRunning(mainWindow: BrowserWindow): void {
  if (hasShownSingleInstanceNotice) return
  hasShownSingleInstanceNotice = true
  void dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['OK'],
      defaultId: 0,
      noLink: true,
      title: APP_NAME,
      message: `${APP_NAME} is already running.`,
      detail: 'The existing window has been brought to the front.'
    })
    .finally(() => {
      hasShownSingleInstanceNotice = false
    })
}

function resolveSystemLanguage(locale: string): 'zh-CN' | 'en-US' {
  return locale.trim().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

function getBrandingAssetPath(fileName: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'branding', fileName)
    : join(app.getAppPath(), 'assets', 'branding', fileName)
}
