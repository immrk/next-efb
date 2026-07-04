import { ipcMain, shell, clipboard, nativeTheme, BrowserWindow, app } from 'electron'
import { wrapAsyncOperation } from '../utils/response.js'
import Store from 'electron-store'
import { createMenu } from '../../menu.js'
import { windowManager } from '../../windowManager.js'
import { setLanguage, SupportedLanguages } from '../../i18n/index.js'

const store = new Store()

/**
 * 系统相关的IPC处理器
 */
export const setupSystemHandlers = (): void => {
  // 打开外部链接
  ipcMain.handle('system:openExternal', async (event, url: string) => {
    return wrapAsyncOperation(async () => {
      await shell.openExternal(url)
      return undefined
    })
  })

  // 打开文件
  ipcMain.handle('system:openPath', async (event, path: string) => {
    return wrapAsyncOperation(async () => {
      await shell.openPath(path)
      return undefined
    })
  })

  // 显示文件在文件管理器中
  ipcMain.handle('system:showItemInFolder', async (event, path: string) => {
    return wrapAsyncOperation(async () => {
      shell.showItemInFolder(path)
      return undefined
    })
  })

  // 复制到剪贴板
  ipcMain.handle('system:writeText', async (event, text: string) => {
    return wrapAsyncOperation(async () => {
      clipboard.writeText(text)
      return undefined
    })
  })

  // 从剪贴板读取
  ipcMain.handle('system:readText', async () => {
    return wrapAsyncOperation(async () => {
      return clipboard.readText()
    })
  })

  // 获取系统主题
  ipcMain.handle('system:getTheme', async () => {
    return wrapAsyncOperation(async () => {
      // 获取store中的主题
      const storeTheme = store.get('theme')
      const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      return {
        storeTheme: storeTheme,
        systemTheme: systemTheme
      }
    })
  })

  // 主题切换
  ipcMain.handle('system:changeTheme', async (event, theme: string) => {
    return wrapAsyncOperation(async () => {
      store.set('theme', theme)
      
      // 向所有渲染进程发送主题变化事件
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('system:changeTheme', theme)
        }
      })
      
      return undefined
    })
  })

  // 获取系统信息
  ipcMain.handle('system:getInfo', async () => {
    return wrapAsyncOperation(async () => {
      return {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome,
        electronVersion: process.versions.electron
      }
    })
  })

  // 获取内存使用情况
  ipcMain.handle('system:getMemoryInfo', async () => {
    return wrapAsyncOperation(async () => {
      return process.getSystemMemoryInfo()
    })
  })

  // 获取系统语言
  ipcMain.handle('system:getLanguage', async () => {
    return wrapAsyncOperation(async () => {
      // 获取store中的语言
      const storeLanguage = store.get('language')
      const systemLanguage = app.getLocale() as string
      return {
        storeLanguage: storeLanguage,
        systemLanguage: systemLanguage
      }
    })
  })

  // 语言切换
  ipcMain.handle('system:changeLanguage', async (event, language: string) => {
    return wrapAsyncOperation(async () => {
      store.set('language', language)
      if (language === 'system') {
        language = app.getLocale() as string
      } else {
        await setLanguage(language as SupportedLanguages)
      }

      // 重新创建菜单以应用新语言
      createMenu(windowManager)
      
      // 向所有渲染进程发送语言变化事件
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('system:changeLanguage', language)
        }
      })
      
      return undefined
    })
  })
} 