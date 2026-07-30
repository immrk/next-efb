import { contextBridge, ipcRenderer } from 'electron'

/**
 * 版本信息 API
 * 暴露 Node.js、Chrome 和 Electron 版本信息
 */
export function exposeVersionsAPI() {
  contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    ping: () => ipcRenderer.invoke('ping')
    // 除函数之外，我们也可以暴露变量
  })

  console.log('versions API 已暴露')
} 