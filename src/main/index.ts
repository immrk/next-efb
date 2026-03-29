import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc/registerIpc'
import { FlightStateStore } from './services/state/FlightStateStore'
import { SettingsStore } from './services/config/SettingsStore'
import { SimConnectService } from './services/simconnect/SimConnectService'
import { ChartRepository } from './services/storage/ChartRepository'
import { StorageService } from './services/storage/StorageService'

let mainWindow: BrowserWindow | null = null
const DEV_LOAD_RETRY_MS = 1200
const DEV_LOAD_MAX_ATTEMPTS = 12

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

  await window.loadFile(join(__dirname, '../../dist-renderer/index.html'))
}

async function createWindow(): Promise<void> {
  const settingsStore = new SettingsStore()
  const flightStateStore = new FlightStateStore()
  const simConnectService = new SimConnectService(settingsStore.get())
  const storageService = new StorageService()
  const chartRepository = new ChartRepository(storageService.getSummary())

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#102033',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  registerIpc({
    mainWindow,
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService
  })

  simConnectService.start()
  await loadRenderer(mainWindow)
}

app.whenReady().then(async () => {
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
