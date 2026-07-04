import { contextBridge, ipcRenderer } from "electron";

export function exposeApiRequestAPI() {
  contextBridge.exposeInMainWorld("apiRequest", {
    getCommon: (args: any) => ipcRenderer.invoke("get-common", args),
  });

  console.log("apiRequest API 已暴露");
}