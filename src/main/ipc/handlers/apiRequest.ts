import { ipcMain } from 'electron'
import { wrapAsyncOperation } from '../utils/response.js'
import { getCommon } from '../../service/index.js'

// 获取公共数据
export const setupApiRequestHandlers = (): void => {
  ipcMain.handle('get-common', async (event, args: any) => {
    return wrapAsyncOperation(async () => {
      return getCommon(args)
    })
  })
}