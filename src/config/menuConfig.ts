import { MenuItemConstructorOptions, BrowserWindow } from 'electron'

// 菜单配置接口
export interface MenuConfig {
  label: string
  submenu: MenuItemConstructorOptions[]
}

// 开发者工具菜单项
export const devToolsMenuItem: MenuItemConstructorOptions = {
  label: '开发者工具',
  accelerator: process.platform === 'darwin' ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
  click: (_menuItem, browserWindow) => {
    if (browserWindow && browserWindow instanceof BrowserWindow) {
      browserWindow.webContents.toggleDevTools()
    }
  }
}

// 关于菜单项
export const aboutMenuItem: MenuItemConstructorOptions = {
  label: '关于',
  click: () => {
    console.log('关于应用')
  }
}

// Help菜单配置
export const helpMenuConfig: MenuConfig = {
  label: 'Help',
  submenu: [
    devToolsMenuItem,
    { type: 'separator' as const },
    aboutMenuItem
  ]
}

// 文件菜单配置
export const fileMenuConfig: MenuConfig = {
  label: '文件',
  submenu: [
    {
      label: '新建主窗口',
      accelerator: 'CmdOrCtrl+N',
      click: () => {
        console.log('创建新主窗口')
        // 这里需要通过全局变量或事件来创建窗口
        // 暂时使用 console.log 提示
        console.log('请通过窗口管理界面创建新窗口')
      }
    },
    {
      label: '打开设置窗口',
      accelerator: 'CmdOrCtrl+,',
      click: () => {
        console.log('打开设置窗口')
        // 这里需要通过全局变量或事件来创建窗口
        // 暂时使用 console.log 提示
        console.log('请通过窗口管理界面创建设置窗口')
      }
    },
    { type: 'separator' as const },
    process.platform === 'darwin' ? { role: 'close' as const } : { role: 'quit' as const }
  ]
}

// 编辑菜单配置
export const editMenuConfig: MenuConfig = {
  label: '编辑',
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
}

// 视图菜单配置
export const viewMenuConfig: MenuConfig = {
  label: '视图',
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
}

// 窗口菜单配置
export const windowMenuConfig: MenuConfig = {
  label: '窗口',
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
}

// 获取所有菜单配置
export const getAllMenuConfigs = (): MenuConfig[] => {
  return [
    fileMenuConfig,
    editMenuConfig,
    viewMenuConfig,
    windowMenuConfig,
    helpMenuConfig
  ]
} 