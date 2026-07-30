import { ipcMain, app } from 'electron'
import { AppInfo } from '../types/index.js'
import { wrapAsyncOperation } from '../utils/response.js'

/**
 * 应用生命周期相关的IPC处理器
 */
export const setupAppHandlers = (): void => {
  // 获取应用信息
  ipcMain.handle('app:getInfo', async () => {
    return wrapAsyncOperation(async (): Promise<AppInfo> => {
      return {
        version: app.getVersion(),
        name: app.getName(),
        platform: process.platform
      }
    })
  })

  // 退出应用
  ipcMain.handle('app:quit', async () => {
    return wrapAsyncOperation(async () => {
      app.quit()
      return undefined
    })
  })

  // 重启应用
  ipcMain.handle('app:relaunch', async () => {
    return wrapAsyncOperation(async () => {
      app.relaunch()
      app.quit()
      return undefined
    })
  })

  // 获取应用路径
  ipcMain.handle('app:getPath', async (event, name: string) => {
    return wrapAsyncOperation(async () => {
      return app.getPath(name as any)
    })
  })

  // 设置应用路径
  ipcMain.handle('app:setPath', async (event, name: string, path: string) => {
    return wrapAsyncOperation(async () => {
      app.setPath(name as any, path)
      return undefined
    })
  })

  // 检查应用是否就绪
  ipcMain.handle('app:isReady', async () => {
    return wrapAsyncOperation(async () => {
      return app.isReady()
    })
  })

  // 基础 ping 测试
  ipcMain.handle('ping', () => 'pong')
} 