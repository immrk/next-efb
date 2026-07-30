import { BrowserWindow, ipcMain } from 'electron'
import { setLanguage, getCurrentLanguage, getSupportedLanguages, t } from '../../i18n/index.js'
import { createMenu } from '../../menu.js'
import { windowManager } from '../../windowManager.js'
import type { SupportedLanguages } from '../../i18n/index.js'

/**
 * 设置i18n相关的IPC处理器
 */
export const setupI18nHandlers = (): void => {
  // 获取当前语言
  ipcMain.handle('i18n:getCurrentLanguage', () => {
    return getCurrentLanguage()
  })

  // 获取支持的语言列表
  ipcMain.handle('i18n:getSupportedLanguages', () => {
    return getSupportedLanguages()
  })

  // 设置语言
  ipcMain.handle('i18n:setLanguage', async (event, language: SupportedLanguages) => {
      await setLanguage(language)
      
      // 重新创建菜单以应用新语言
      createMenu(windowManager)
      
      // 通知所有渲染进程语言已更改
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('i18n:languageChanged', language)
        }
      })
      
      return undefined
  })

  // 获取翻译文本
  ipcMain.handle('i18n:translate', (event, key: string, options?: any) => {
    return t(key, options)
  })
} 