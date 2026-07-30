import { BrowserWindow, app } from 'electron'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { WINDOW_NAMES, WINDOW_LIST } from '../config/windowConfig.js'
import { setupContextMenu } from './menu.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface WindowInstance {
  name: string
  window: BrowserWindow
  isVisible: boolean
}

export class WindowManager {
  private windows: Map<string, WindowInstance> = new Map()

  /**
   * 创建窗口
   * @param windowName 窗口名称
   * @param options 窗口选项
   * @returns 创建的窗口实例
   */
  createWindow(windowName: string, options?: any): WindowInstance | null {
    // 检查窗口配置是否存在
    const config = WINDOW_LIST[windowName]
    if (!config) {
      console.error(`窗口配置不存在: ${windowName}`)
      return null
    }

    // 检查窗口是否已存在
    if (this.windows.has(windowName)) {
      console.log(`窗口已存在: ${windowName} 显示窗口`)
      this.windows.get(windowName)?.window.show()
      return this.windows.get(windowName) || null
    }

    // 合并配置和选项
    // 在开发环境中，preload 脚本路径需要指向编译后的文件
    const isDev = process.env.NODE_ENV === 'development'
    
    // 修复 preload 脚本路径
    let preloadPath: string
    // 注意：打包后 __dirname 指向 dist 目录，所以需要加上 main 子目录
    preloadPath = path.join(__dirname, './main/preload/index.js')
    
    console.log('Preload 脚本路径:', preloadPath)
    console.log("运行环境:", process.env.NODE_ENV)
    console.log('是否为开发环境:', isDev)

    // 若隐藏系统标题栏，windows系统需要手动将窗口控件重新加入（mac不用）
    const titleBarOverlay = process.platform !== 'darwin' ? {
      color: 'rgba(255, 255, 255, 0)',
      symbolColor: '#6a7ade',
      height: 30,
    } : false
    console.log('titleBarOverlay:', titleBarOverlay)
    
    const windowOptions = {
      ...config,
      ...options,
      titleBarOverlay: titleBarOverlay,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        sandbox: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        ...options?.webPreferences
      }
    }

    // 创建窗口
    const window = new BrowserWindow(windowOptions)
    
    // 加载页面
    this.loadWindowContent(window, windowName)

    // 设置上下文菜单
    setupContextMenu(window)

    // 监听窗口关闭事件
    window.on('closed', () => {
      this.windows.delete(windowName)
      console.log(`窗口已关闭: ${windowName}`)
    })

    // 监听窗口显示/隐藏事件
    window.on('show', () => {
      const instance = this.windows.get(windowName)
      if (instance) {
        instance.isVisible = true
      }
    })

    window.on('hide', () => {
      const instance = this.windows.get(windowName)
      if (instance) {
        instance.isVisible = false
      }
    })

    // 创建窗口实例
    const windowInstance: WindowInstance = {
      name: windowName,
      window,
      isVisible: true
    }

    this.windows.set(windowName, windowInstance)
    console.log(`窗口已创建: ${windowName}`)

    return windowInstance
  }

  /**
   * 加载窗口内容
   * @param window 浏览器窗口
   * @param windowName 窗口名称
   */
  private loadWindowContent(window: BrowserWindow, windowName: string): void {
    
    // 检查是否为开发环境（通过检查是否存在开发服务器）
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // 开发环境：使用主端口，通过查询参数区分窗口
      const port = WINDOW_LIST[windowName].devPort
      const url = `http://localhost:${port}?window=${windowName}`
      console.log(`尝试加载窗口 ${windowName} 到: ${url}`)

      // 打开开发者工具
      window.webContents.openDevTools()
      
      // 添加错误处理
      window.loadURL(url).catch((error) => {
        console.error(`加载窗口 ${windowName} 失败:`, error)
        // 如果开发服务器没有运行，尝试加载本地文件
        const htmlPath = path.join(__dirname, `../renderer/window/${windowName}/index.html`)
        console.log(`尝试加载本地文件: ${htmlPath}`)
        window.loadFile(htmlPath).catch((fileError) => {
          console.error(`加载本地文件也失败:`, fileError)
        })
      })
    } else {
      // 生产环境：加载对应的HTML文件
      const htmlPath = path.join(__dirname, `./renderer/window/${windowName}/index.html`)
      window.loadFile(htmlPath)
    }
  }

  /**
   * 获取窗口实例
   * @param windowName 窗口名称
   * @returns 窗口实例
   */
  getWindow(windowName: string): WindowInstance | null {
    return this.windows.get(windowName) || null
  }

  /**
   * 获取所有窗口
   * @returns 所有窗口实例
   */
  getAllWindows(): WindowInstance[] {
    return Array.from(this.windows.values())
  }

  /**
   * 显示窗口
   * @param windowName 窗口名称
   */
  showWindow(windowName: string): void {
    const instance = this.windows.get(windowName)
    if (instance) {
      instance.window.show()
      instance.isVisible = true
    } else {
      // 如果窗口不存在，则创建它
      this.createWindow(windowName)
    }
  }

  /**
   * 隐藏窗口
   * @param windowName 窗口名称
   */
  hideWindow(windowName: string): void {
    const instance = this.windows.get(windowName)
    if (instance) {
      instance.window.hide()
      instance.isVisible = false
    }
  }

  /**
   * 关闭窗口
   * @param windowName 窗口名称
   */
  closeWindow(windowName: string): void {
    const instance = this.windows.get(windowName)
    if (instance) {
      instance.window.close()
    }
  }

  /**
   * 聚焦窗口
   * @param windowName 窗口名称
   */
  focusWindow(windowName: string): void {
    const instance = this.windows.get(windowName)
    if (instance) {
      instance.window.focus()
    }
  }

  /**
   * 最小化窗口
   * @param windowName 窗口名称
   */
  minimizeWindow(windowName: string): void {
    const instance = this.windows.get(windowName)
    if (instance) {
      instance.window.minimize()
    }
  }

  /**
   * 最大化窗口
   * @param windowName 窗口名称
   */
  maximizeWindow(windowName: string): void {
    const instance = this.windows.get(windowName)
    if (instance) {
      instance.window.maximize()
    }
  }

  /**
   * 恢复窗口
   * @param windowName 窗口名称
   */
  restoreWindow(windowName: string): void {
    const instance = this.windows.get(windowName)
    if (instance) {
      instance.window.restore()
    }
  }

  /**
   * 检查窗口是否存在
   * @param windowName 窗口名称
   * @returns 是否存在
   */
  hasWindow(windowName: string): boolean {
    return this.windows.has(windowName)
  }

  /**
   * 检查窗口是否可见
   * @param windowName 窗口名称
   * @returns 是否可见
   */
  isWindowVisible(windowName: string): boolean {
    const instance = this.windows.get(windowName)
    return instance ? instance.isVisible : false
  }

  /**
   * 关闭所有窗口
   */
  closeAllWindows(): void {
    this.windows.forEach((instance) => {
      instance.window.close()
    })
  }

  /**
   * 获取可见窗口数量
   * @returns 可见窗口数量
   */
  getVisibleWindowCount(): number {
    return Array.from(this.windows.values()).filter(instance => instance.isVisible).length
  }
}

// 创建全局窗口管理器实例
export const windowManager = new WindowManager()
