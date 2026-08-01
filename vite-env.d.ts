/// <reference types="vite/client" />

// 为 import.meta.env 添加类型定义
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_MOCK: string
  // 可以在这里添加更多环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 系统 API 类型定义
interface SystemAPI {
  changeTheme: (theme: string) => Promise<any>
  getTheme: () => Promise<{ data: { storeTheme: string | undefined; systemTheme: string } }>
  onChangeTheme: (callback: (theme: string) => void) => () => void
  // 语言管理相关方法
  changeLanguage: (language: string) => Promise<any>
  getLanguage: () => Promise<{ data: { storeLanguage: string | undefined; systemLanguage: string } }>
  onChangeLanguage: (callback: (language: string) => void) => () => void
}

// 窗口管理 API 类型定义
interface WindowManagerAPI {
  createWindow: (windowName: string, options?: any) => Promise<{ success: boolean; data?: any; error?: string }>
  showWindow: (windowName: string) => Promise<{ success: boolean; error?: string }>
  hideWindow: (windowName: string) => Promise<{ success: boolean; error?: string }>
  closeWindow: (windowName: string) => Promise<{ success: boolean; error?: string }>
  focusWindow: (windowName: string) => Promise<{ success: boolean; error?: string }>
  minimizeWindow: (windowName: string) => Promise<{ success: boolean; error?: string }>
  maximizeWindow: (windowName: string) => Promise<{ success: boolean; error?: string }>
  restoreWindow: (windowName: string) => Promise<{ success: boolean; error?: string }>
  hasWindow: (windowName: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
  isWindowVisible: (windowName: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
  getAllWindows: () => Promise<{ success: boolean; data?: any[]; error?: string }>
  getVisibleWindowCount: () => Promise<{ success: boolean; data?: number; error?: string }>
  onWindowStateChanged: (callback: (event: unknown, data: any) => void) => void
  removeWindowStateListener: () => void
}

// 版本信息 API 类型定义
interface VersionsAPI {
  node: () => string
  chrome: () => string
  electron: () => string
  ping: () => Promise<string>
}

// Store API 类型定义
interface StoreAPI {
  getStore: (key: string) => Promise<any>
  setStore: (key: string, value: any) => Promise<void>
}

// API请求 API 类型定义
interface ApiRequestAPI {
  getCommon: (args: any) => Promise<any>
}

// Auth API 类型定义
interface AuthAPI {
  login: (data: any) => Promise<any>
  logout: () => Promise<any>
  getToken: () => Promise<any>
  tokenRefresh: (data: any) => Promise<any>
  onTokenChange: (callback: (token: string) => void) => void
  removeTokenChangeListener: () => void
  onLogout: (callback: () => void) => void
  removeLogoutListener: () => void
}

// 扩展 Window 接口
interface Window {
  system: SystemAPI
  windowManager: WindowManagerAPI
  versions: VersionsAPI
  store: StoreAPI
  apiRequest: ApiRequestAPI
  auth: AuthAPI
}
