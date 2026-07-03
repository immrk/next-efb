import type { BrowserWindowConstructorOptions } from 'electron'

export const WINDOW_NAMES = {
  main: 'main',
  setting: 'setting',
  login: 'login'
} as const

export interface WindowConfiguration extends BrowserWindowConstructorOptions {
  devPort: number
}

export const WINDOW_LIST: Record<string, WindowConfiguration> = {
  [WINDOW_NAMES.main]: {
    width: 1200,
    height: 800,
    minWidth: 1100,
    minHeight: 720,
    frame: false,
    titleBarStyle: 'hidden',
    devPort: 11069
  },
  [WINDOW_NAMES.setting]: {
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 560,
    frame: false,
    titleBarStyle: 'hidden',
    devPort: 11070
  },
  [WINDOW_NAMES.login]: {
    width: 500,
    height: 400,
    resizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    devPort: 11071
  }
}
