import type { BrowserWindowConstructorOptions } from 'electron'

export const WINDOW_NAMES = {
  main: 'main',
  login: 'login'
} as const

export const MAIN_WINDOW_CONFIG: BrowserWindowConstructorOptions = {
  width: 1440,
  height: 920,
  minWidth: 1100,
  minHeight: 720,
  frame: false,
  titleBarStyle: 'hidden',
  titleBarOverlay: false,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false
  }
}
