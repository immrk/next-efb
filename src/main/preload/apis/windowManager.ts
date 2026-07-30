import { contextBridge, ipcRenderer } from 'electron'

/**
 * 窗口管理 API
 * 提供窗口的创建、显示、隐藏、关闭等操作
 */
export function exposeWindowManagerAPI() {
  contextBridge.exposeInMainWorld('windowManager', {
    // 创建窗口
    createWindow: (windowName: string, options?: any) => 
      ipcRenderer.invoke('window:create', windowName, options),
    
    // 显示窗口
    showWindow: (windowName: string) => 
      ipcRenderer.invoke('window:show', windowName),
    
    // 隐藏窗口
    hideWindow: (windowName: string) => 
      ipcRenderer.invoke('window:hide', windowName),
    
    // 关闭窗口
    closeWindow: (windowName: string) => 
      ipcRenderer.invoke('window:close', windowName),
    
    // 聚焦窗口
    focusWindow: (windowName: string) => 
      ipcRenderer.invoke('window:focus', windowName),
    
    // 最小化窗口
    minimizeWindow: (windowName: string) => 
      ipcRenderer.invoke('window:minimize', windowName),
    
    // 最大化窗口
    maximizeWindow: (windowName: string) => 
      ipcRenderer.invoke('window:maximize', windowName),
    
    // 恢复窗口
    restoreWindow: (windowName: string) => 
      ipcRenderer.invoke('window:restore', windowName),
    
    // 检查窗口是否存在
    hasWindow: (windowName: string) => 
      ipcRenderer.invoke('window:has', windowName),
    
    // 检查窗口是否可见
    isWindowVisible: (windowName: string) => 
      ipcRenderer.invoke('window:isVisible', windowName),
    
    // 获取所有窗口
    getAllWindows: () => 
      ipcRenderer.invoke('window:getAll'),
    
    // 获取可见窗口数量
    getVisibleWindowCount: () => 
      ipcRenderer.invoke('window:getVisibleCount'),
    
    // 监听窗口状态变化
    onWindowStateChanged: (callback: (data: any) => void) => 
      ipcRenderer.on('window:stateChanged', callback),
    
    // 移除窗口状态变化监听
    removeWindowStateListener: () => 
      ipcRenderer.removeAllListeners('window:stateChanged')
  })

  console.log('windowManager API 已暴露')
} 