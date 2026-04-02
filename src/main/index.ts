import { Menu, Tray, app, nativeImage, BrowserWindow, session, dialog } from 'electron'
import { join } from 'node:path'
import { IPC_CHANNELS } from '@shared/channels'
import { APP_NAME } from '@shared/branding'
import type { DesktopWindowState } from '@shared/types'
import { registerIpc } from './ipc/registerIpc'
import { FlightStateStore } from './services/state/FlightStateStore'
import { SettingsStore } from './services/config/SettingsStore'
import { SimConnectService } from './services/simconnect/SimConnectService'
import { ChartRepository } from './services/storage/ChartRepository'
import { StorageService } from './services/storage/StorageService'
import { LanServer } from './services/lan/LanServer'
import { NavDataService } from './services/navigation/NavDataService'

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let isQuitting = false
let hasShownSingleInstanceNotice = false
const DEV_LOAD_RETRY_MS = 1200
const DEV_LOAD_MAX_ATTEMPTS = 12
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

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  if (process.env.ELECTRON_RENDERER_URL) {
    let lastError: unknown

    for (let attempt = 1; attempt <= DEV_LOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        await window.loadURL(process.env.ELECTRON_RENDERER_URL)
        return
      } catch (error) {
        lastError = error
        if (attempt < DEV_LOAD_MAX_ATTEMPTS) {
          await delay(DEV_LOAD_RETRY_MS)
        }
      }
    }

    throw lastError
  }

  await window.loadFile(join(__dirname, '../../renderer/index.html'))
}

async function createWindow(): Promise<void> {
  const settingsStore = new SettingsStore(resolveSystemLanguage(app.getLocale()))
  const flightStateStore = new FlightStateStore()
  const simConnectService = new SimConnectService(settingsStore.get())
  const storageService = new StorageService()
  const navDataService = new NavDataService()
  const chartRepository = new ChartRepository(storageService.getSummary())
  const lanServer = new LanServer({
    settings: settingsStore.get(),
    rendererRoot: join(__dirname, '../../renderer'),
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService,
    navDataService
  })

  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#102033',
    icon: getBrandingAssetPath('app-icon-256.png'),
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('maximize', () => sendWindowState(mainWindow))
  mainWindow.on('unmaximize', () => sendWindowState(mainWindow))

  ensureTray()
  sendWindowState(mainWindow)

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

  simConnectService.start()
  await lanServer.start()
  await loadRenderer(mainWindow)
  sendWindowState(mainWindow)
}

function resolveSystemLanguage(locale: string): 'zh-CN' | 'en-US' {
  return locale.trim().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
app.whenReady().then(async () => {
  configureTileRequestHeaders()

  app.on('before-quit', () => {
    isQuitting = true
  })

  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})
}

app.on('second-instance', () => {
  showMainWindow()
  notifyAlreadyRunning()
})

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function sendWindowState(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) {
    return
  }

  const payload: DesktopWindowState = {
    isMaximized: window.isMaximized()
  }

  window.webContents.send(IPC_CHANNELS.windowStateChanged, payload)
}

function ensureTray(): void {
  if (appTray) {
    return
  }

  appTray = new Tray(createTrayIcon())
  appTray.setToolTip(APP_NAME)
  appTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `Show ${APP_NAME}`,
        click: () => showMainWindow()
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
  appTray.on('double-click', () => showMainWindow())
  appTray.on('click', () => showMainWindow())
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
  sendWindowState(mainWindow)
}

function notifyAlreadyRunning(): void {
  if (!mainWindow || mainWindow.isDestroyed() || hasShownSingleInstanceNotice) {
    return
  }

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

function createTrayIcon() {
  return nativeImage.createFromPath(getBrandingAssetPath('tray-icon-32.png'))
}

function getBrandingAssetPath(fileName: string): string {
  return join(app.getAppPath(), 'assets', 'branding', fileName)
}
