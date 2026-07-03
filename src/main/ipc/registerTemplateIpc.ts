import { BrowserWindow, ipcMain } from 'electron'
import Store from 'electron-store'
import { windowManager } from '../windowManager'

interface MockUser {
  email: string
  username: string
  avatar: string
  accessToken: string
  refreshToken: string
}

const store = new Store<{ userdata?: MockUser }>()

export function registerTemplateIpc(): void {
  ipcMain.handle('window:create', (_event, windowName: string, options?: Electron.BrowserWindowConstructorOptions) =>
    wrap(() => {
      const instance = windowManager.createWindow(windowName, options)
      if (!instance) throw new Error('WINDOW_CREATE_FAILED')
      return { name: instance.name, isVisible: instance.isVisible }
    })
  )
  ipcMain.handle('window:show', (_event, name: string) => wrap(() => windowManager.showWindow(name)))
  ipcMain.handle('window:hide', (_event, name: string) => wrap(() => windowManager.hideWindow(name)))
  ipcMain.handle('window:close', (_event, name: string) => wrap(() => windowManager.closeWindow(name)))
  ipcMain.handle('window:focus', (_event, name: string) => wrap(() => windowManager.focusWindow(name)))
  ipcMain.handle('window:minimize', (_event, name: string) => wrap(() => windowManager.minimizeWindow(name)))
  ipcMain.handle('window:maximize', (_event, name: string) => wrap(() => windowManager.maximizeWindow(name)))
  ipcMain.handle('window:restore', (_event, name: string) => wrap(() => windowManager.restoreWindow(name)))
  ipcMain.handle('window:has', (_event, name: string) => wrap(() => windowManager.hasWindow(name)))
  ipcMain.handle('window:isVisible', (_event, name: string) =>
    wrap(() => windowManager.isWindowVisible(name))
  )
  ipcMain.handle('window:getAll', () =>
    wrap(() =>
      windowManager.getAllWindows().map((instance) => ({
        name: instance.name,
        isVisible: instance.isVisible
      }))
    )
  )
  ipcMain.handle('window:getVisibleCount', () =>
    wrap(() => windowManager.getVisibleWindowCount())
  )

  ipcMain.handle('auth:login', (_event, data: MockUser) =>
    wrap(() => {
      store.set('userdata', data)
      broadcastAuthChange(data)
    })
  )
  ipcMain.handle('auth:getToken', () => wrap(() => store.get('userdata') ?? null))
  ipcMain.handle('auth:tokenRefresh', () => wrap(() => store.get('userdata') ?? null))
  ipcMain.handle('auth:logout', () =>
    wrap(() => {
      store.delete('userdata')
      broadcastAuthChange(null)
    })
  )
}

function broadcastAuthChange(user: MockUser | null): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) window.webContents.send('auth:tokenChange', user)
  })
}

async function wrap<T>(operation: () => T | Promise<T>) {
  try {
    return { success: true, data: await operation() }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
