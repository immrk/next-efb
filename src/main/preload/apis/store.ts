import { contextBridge, ipcRenderer } from "electron";

export function exposeStoreAPI() {
  contextBridge.exposeInMainWorld("store", {
    getStore: (key: string) => ipcRenderer.invoke("get-store", key),
    setStore: (key: string, value: any) => ipcRenderer.invoke("set-store", key, value),
  });

  console.log("store API 已暴露");
}