import { contextBridge, ipcMain, ipcRenderer } from "electron";
import { wrapAsyncOperation } from "../utils/response.js";
import Store from 'electron-store'

const store = new Store()

export const setupStoreHandlers = (): void => {
  ipcMain.handle("get-store", async (event, key: string) => {
    return wrapAsyncOperation(async () => {
      return store.get(key);
    });
  });

  ipcMain.handle("set-store", async (event, key: string, value: any) => {
    return wrapAsyncOperation(async () => {
      store.set(key, value);
      return undefined;
    });
  });
};