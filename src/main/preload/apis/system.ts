import { contextBridge, ipcRenderer } from "electron";

export function exposeSystemAPI() {
  contextBridge.exposeInMainWorld("system", {
    changeTheme: (theme: string) => ipcRenderer.invoke("system:changeTheme", theme),
    getTheme: () => ipcRenderer.invoke("system:getTheme"),
    onChangeTheme: (callback: (theme: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, theme: string) => {
        callback(theme);
      };
      ipcRenderer.on("system:changeTheme", listener);
      return () => ipcRenderer.removeListener("system:changeTheme", listener);
    },
    changeLanguage: (language: string) => ipcRenderer.invoke("system:changeLanguage", language),
    getLanguage: () => ipcRenderer.invoke("system:getLanguage"),
    onChangeLanguage: (callback: (language: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, language: string) => {
        callback(language);
      };
      ipcRenderer.on("system:changeLanguage", listener);
      return () => ipcRenderer.removeListener("system:changeLanguage", listener);
    },
  });

  console.log("system API 已暴露");
}
