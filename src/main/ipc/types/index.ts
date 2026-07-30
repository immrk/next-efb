// IPC 响应类型
export interface IpcResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// 窗口相关类型
export interface WindowInstance {
  name: string
  isVisible: boolean
}

// 窗口创建选项
export interface WindowCreateOptions {
  [key: string]: any
}

// 应用相关类型
export interface AppInfo {
  version: string
  name: string
  platform: string
} 