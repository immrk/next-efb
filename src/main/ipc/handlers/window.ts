import { ipcMain } from 'electron'
import { windowManager } from '../../windowManager.js'
import { WindowInstance, WindowCreateOptions } from '../types/index.js'
import { wrapAsyncOperation, createSuccessResponse } from '../utils/response.js'

/**
 * 窗口管理相关的IPC处理器
 */
export const setupWindowHandlers = (): void => {
  // 创建窗口
  ipcMain.handle('window:create', async (event, windowName: string, options?: WindowCreateOptions) => {
    return wrapAsyncOperation(async () => {
      const instance = windowManager.createWindow(windowName, options)
      if (instance) {
        // 只返回可序列化的数据，不包含 BrowserWindow 实例
        const serializableInstance: WindowInstance = {
          name: instance.name,
          isVisible: instance.isVisible
        }
        return serializableInstance
      } else {
        throw new Error('窗口创建失败')
      }
    })
  })

  // 显示窗口
  ipcMain.handle('window:show', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      windowManager.showWindow(windowName)
      return undefined
    })
  })

  // 隐藏窗口
  ipcMain.handle('window:hide', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      windowManager.hideWindow(windowName)
      return undefined
    })
  })

  // 关闭窗口
  ipcMain.handle('window:close', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      windowManager.closeWindow(windowName)
      return undefined
    })
  })

  // 聚焦窗口
  ipcMain.handle('window:focus', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      windowManager.focusWindow(windowName)
      return undefined
    })
  })

  // 最小化窗口
  ipcMain.handle('window:minimize', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      windowManager.minimizeWindow(windowName)
      return undefined
    })
  })

  // 最大化窗口
  ipcMain.handle('window:maximize', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      windowManager.maximizeWindow(windowName)
      return undefined
    })
  })

  // 恢复窗口
  ipcMain.handle('window:restore', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      windowManager.restoreWindow(windowName)
      return undefined
    })
  })

  // 检查窗口是否存在
  ipcMain.handle('window:has', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      return windowManager.hasWindow(windowName)
    })
  })

  // 检查窗口是否可见
  ipcMain.handle('window:isVisible', async (event, windowName: string) => {
    return wrapAsyncOperation(async () => {
      return windowManager.isWindowVisible(windowName)
    })
  })

  // 获取所有窗口
  ipcMain.handle('window:getAll', async () => {
    return wrapAsyncOperation(async () => {
      const windows = windowManager.getAllWindows()
      // 只返回可序列化的数据，不包含 BrowserWindow 实例
      const serializableWindows: WindowInstance[] = windows.map(instance => ({
        name: instance.name,
        isVisible: instance.isVisible
      }))
      return serializableWindows
    })
  })

  // 获取可见窗口数量
  ipcMain.handle('window:getVisibleCount', async () => {
    return wrapAsyncOperation(async () => {
      return windowManager.getVisibleWindowCount()
    })
  })
} 