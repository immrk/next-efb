import { contextBridge, ipcRenderer } from "electron";

export function exposeAuthAPI() {
  contextBridge.exposeInMainWorld("auth", {
    login: (data: any) => ipcRenderer.invoke("auth:login", data),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getToken: (args: any) => ipcRenderer.invoke("auth:getToken", args),
    tokenRefresh: (args: any) => ipcRenderer.invoke("auth:tokenRefresh", args),
    onTokenChange: (callback: (token: string) => void) => {
      ipcRenderer.on("auth:tokenChange", (event, token: string) => {
        callback(token);
      });
    },
    removeTokenChangeListener: () => {
      ipcRenderer.removeAllListeners("auth:tokenChange");
    },
    onLogout: (callback: () => void) => {
      ipcRenderer.on("auth:logout", () => {
        callback();
      });
    },
    removeLogoutListener: () => {
      ipcRenderer.removeAllListeners("auth:logout");
    },
  });

  console.log("auth API 已暴露");
}