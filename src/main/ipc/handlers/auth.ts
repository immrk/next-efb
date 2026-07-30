import { ipcMain, BrowserWindow } from 'electron'
import { wrapAsyncOperation } from '../utils/response.js'
import Store from 'electron-store'

const store = new Store()

export const setupAuthHandlers = (): void => {
  ipcMain.handle('auth:login', async (event, data: any) => {
    // 登陆成功后，存储用户信息，并抛出token更新事件
    return wrapAsyncOperation(async () => {
      // 存储用户信息
      store.set('userdata', data)
      // 向所有渲染进程发送token更新事件
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('auth:tokenChange', data.accessToken)
        }
      })
      return undefined
    })
  })

  ipcMain.handle('auth:getToken', async () => {
    return wrapAsyncOperation(async () => {
      return store.get('userdata')
    })
  })

  ipcMain.handle('auth:tokenRefresh', async (event, data: any) => {
    return wrapAsyncOperation(async () => {
      return store.get('userdata')
    })
  })

  ipcMain.handle('auth:logout', async (event, data: any) => {
    return wrapAsyncOperation(async () => {
      store.delete('userdata')
      // 向所有渲染进程发送token更新事件
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('auth:tokenChange', '')
        }
      })
      return undefined
    })
  })
}