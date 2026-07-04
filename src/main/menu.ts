import { Menu, MenuItemConstructorOptions, BrowserWindow, app } from 'electron'
import { getAllMenuConfigs } from '../config/menuConfig.js'
import { WindowManager } from './windowManager.js'
import { t } from './i18n/index.js'

// 创建主菜单模板
const createMainMenuTemplate = (windowManager: WindowManager): MenuItemConstructorOptions[] => {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    // macOS 应用菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    
    // 文件菜单
    {
      label: t('menu.file'),
      submenu: [
        {
          label: t('menu.newMainWindow'),
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            console.log('创建新主窗口')
            windowManager.createWindow('main')
          }
        },
        {
          label: t('menu.openSettingWindow'),
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            console.log('打开设置窗口')
            windowManager.createWindow('setting')
          }
        },
        { type: 'separator' as const },
        process.platform === 'darwin' ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    
    // 编辑菜单
    {
      label: t('menu.edit'),
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(process.platform === 'darwin' ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    
    // 视图菜单
    {
      label: t('menu.view'),
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    
    // 窗口菜单
    {
      label: t('menu.window'),
      submenu: [
        { role: 'minimize' as const },
        { role: 'close' as const },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'quit' as const }
        ])
      ]
    },
    
    // Help菜单
    {
      label: t('menu.help'),
      submenu: [
        {
          label: t('menu.developerTools'),
          accelerator: process.platform === 'darwin' ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
          click: (_menuItem, browserWindow) => {
            if (browserWindow && browserWindow instanceof BrowserWindow) {
              browserWindow.webContents.toggleDevTools()
            }
          }
        },
        { type: 'separator' as const },
        {
          label: t('menu.about'),
          click: () => {
            console.log('关于应用')
          }
        }
      ]
    }
  ]

  return template
}

// 创建主菜单
export const createMenu = (windowManager: WindowManager): void => {
  const template = createMainMenuTemplate(windowManager)
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// 创建右键上下文菜单
export const createContextMenu = (): Menu => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: t('menu.copy'),
      role: 'copy' as const
    },
    {
      label: t('menu.paste'),
      role: 'paste' as const
    },
    { type: 'separator' as const },
    {
      label: t('menu.developerTools'),
      click: (menuItem, browserWindow) => {
        if (browserWindow && browserWindow instanceof BrowserWindow) {
          browserWindow.webContents.toggleDevTools()
        }
      }
    }
  ])
  
  return contextMenu
}

// 为特定窗口设置上下文菜单
export const setupContextMenu = (window: BrowserWindow): void => {
  const contextMenu = createContextMenu()
  
  window.webContents.on('context-menu', (event, params) => {
    contextMenu.popup({ window })
  })
} 