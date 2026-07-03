import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WINDOW_LIST } from '../config/windowConfig'
import { APP_NAME } from '@shared/branding'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface WindowInstance {
  name: string
  window: BrowserWindow
  isVisible: boolean
}

export class WindowManager {
  private readonly windows = new Map<string, WindowInstance>()

  createWindow(
    windowName: string,
    options: BrowserWindowConstructorOptions = {}
  ): WindowInstance | null {
    const config = WINDOW_LIST[windowName]
    if (!config) return null

    const existing = this.windows.get(windowName)
    if (existing && !existing.window.isDestroyed()) {
      existing.window.show()
      existing.window.focus()
      return existing
    }

    const { devPort: _devPort, ...browserConfig } = config
    const window = new BrowserWindow({
      ...browserConfig,
      ...options,
      title: windowName === 'main' ? APP_NAME : `${APP_NAME} · ${windowName}`,
      webPreferences: {
        preload: join(__dirname, 'main/preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        ...browserConfig.webPreferences,
        ...options.webPreferences
      }
    })

    const instance: WindowInstance = { name: windowName, window, isVisible: true }
    this.windows.set(windowName, instance)
    this.loadWindowContent(window, windowName)
    this.installExternalNavigationGuard(window, windowName)

    window.on('closed', () => this.windows.delete(windowName))
    window.on('show', () => {
      instance.isVisible = true
    })
    window.on('hide', () => {
      instance.isVisible = false
    })

    return instance
  }

  getWindow(windowName: string): WindowInstance | null {
    return this.windows.get(windowName) ?? null
  }

  getAllWindows(): WindowInstance[] {
    return [...this.windows.values()]
  }

  showWindow(windowName: string): void {
    const instance = this.getWindow(windowName) ?? this.createWindow(windowName)
    instance?.window.show()
    instance?.window.focus()
  }

  hideWindow(windowName: string): void {
    this.getWindow(windowName)?.window.hide()
  }

  closeWindow(windowName: string): void {
    this.getWindow(windowName)?.window.close()
  }

  focusWindow(windowName: string): void {
    this.getWindow(windowName)?.window.focus()
  }

  minimizeWindow(windowName: string): void {
    this.getWindow(windowName)?.window.minimize()
  }

  maximizeWindow(windowName: string): void {
    this.getWindow(windowName)?.window.maximize()
  }

  restoreWindow(windowName: string): void {
    this.getWindow(windowName)?.window.restore()
  }

  hasWindow(windowName: string): boolean {
    return Boolean(this.getWindow(windowName))
  }

  isWindowVisible(windowName: string): boolean {
    return this.getWindow(windowName)?.window.isVisible() ?? false
  }

  getVisibleWindowCount(): number {
    return this.getAllWindows().filter((instance) => instance.window.isVisible()).length
  }

  closeAllWindows(): void {
    this.getAllWindows().forEach((instance) => instance.window.close())
  }

  private loadWindowContent(window: BrowserWindow, windowName: string): void {
    if (process.env.NODE_ENV === 'development') {
      void window.loadURL(`http://localhost:${WINDOW_LIST[windowName].devPort}`)
      return
    }

    void window.loadFile(join(__dirname, `renderer/window/${windowName}/index.html`))
  }

  private installExternalNavigationGuard(window: BrowserWindow, windowName: string): void {
    const appUrl =
      process.env.NODE_ENV === 'development'
        ? `http://localhost:${WINDOW_LIST[windowName].devPort}`
        : `file://${join(__dirname, `renderer/window/${windowName}/index.html`).replace(/\\/g, '/')}`

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isExternalUrl(url, appUrl)) void shell.openExternal(url)
      return { action: 'deny' }
    })

    window.webContents.on('will-navigate', (event, url) => {
      if (!isExternalUrl(url, appUrl)) return
      event.preventDefault()
      void shell.openExternal(url)
    })
  }
}

function isExternalUrl(targetUrl: string, appUrl: string): boolean {
  try {
    const target = new URL(targetUrl)
    const appLocation = new URL(appUrl)
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(target.protocol)) return false
    return appLocation.protocol === 'file:' ? target.protocol !== 'file:' : target.origin !== appLocation.origin
  } catch {
    return false
  }
}

export const windowManager = new WindowManager()
