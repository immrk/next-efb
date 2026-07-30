import { setupWindowHandlers } from './handlers/window.js'
import { setupAppHandlers } from './handlers/app.js'
import { setupSystemHandlers } from './handlers/system.js'
import { setupI18nHandlers } from './handlers/i18n.js'
import { setupStoreHandlers } from './handlers/store.js'
import { setupApiRequestHandlers } from './handlers/apiRequest.js'
import { setupAuthHandlers } from './handlers/auth.js'

/**
 * 设置所有IPC处理器
 * 这是IPC模块的主入口，统一管理所有IPC通信
 */
export const setupIpcHandlers = (): void => {
  console.log('正在设置IPC处理器...')
  
  // 设置窗口管理相关的IPC处理器
  setupWindowHandlers()
  
  // 设置应用生命周期相关的IPC处理器
  setupAppHandlers()
  
  // 设置系统相关的IPC处理器
  setupSystemHandlers()
  
  // 设置i18n相关的IPC处理器
  setupI18nHandlers()
  
  // 设置store相关的IPC处理器
  setupStoreHandlers()

  // 设置API请求相关的IPC处理器
  setupApiRequestHandlers()

  // 设置auth相关的IPC处理器
  setupAuthHandlers()
  
  console.log('IPC处理器设置完成')
}

// 导出类型定义，供其他模块使用
export * from './types/index.js'
export * from './utils/response.js'
