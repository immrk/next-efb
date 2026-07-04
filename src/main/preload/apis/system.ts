import { contextBridge, ipcRenderer } from "electron";

export function exposeSystemAPI() {
  contextBridge.exposeInMainWorld("system", {
    changeTheme: (theme: string) => ipcRenderer.invoke("system:changeTheme", theme),
    getTheme: () => ipcRenderer.invoke("system:getTheme"),
    onChangeTheme: (callback: (theme: string) => void) => {
      ipcRenderer.on("system:changeTheme", (event, theme: string) => {
        callback(theme);
      });
    },
    changeLanguage: (language: string) => ipcRenderer.invoke("system:changeLanguage", language),
    getLanguage: () => ipcRenderer.invoke("system:getLanguage"),
    onChangeLanguage: (callback: (language: string) => void) => {
      ipcRenderer.on("system:changeLanguage", (event, language: string) => {
        callback(language);
      });
    },
  });

  console.log("system API 已暴露");
}