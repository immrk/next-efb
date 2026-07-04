/*
 * React 主题管理，统一管理明暗模式。
 * 
 * 使用方式：
 * 1. 在组件中引入 useTheme
 * 2. 使用 isDark 和 themeColor 来获取和设置主题
 * 3. 使用 changeTheme 来切换主题
 * 4. 使用 refreshTheme 来刷新主题
 * 5. 使用 onThemeChange 来监听主题变化
 * 
 * 注意：
 * 1. 引入时会自动监听系统主题变化，并更新 isDark 和 themeColor
 * 2. 切换主题时会自动调用 IPC 写入本地配置
 * 3. 基于 React 和主进程通信，使用 <html class="dark"> 驱动 shadcn 主题
 */
import { useCallback, useEffect, useState } from "react";

/** 统一定义类型，便于在别处复用 */
export type ThemeColor = "light" | "dark" | "system";

/**
 * 负责：
 * 1. 获取存储或系统主题并更新 `isDark`
 * 2. 监听系统主题变化
 * 3. 暴露可写的 `themeColor` 供业务侧手动切换
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [themeColor, setThemeColor] = useState<ThemeColor>("system");

  const applyDarkMode = useCallback((dark: boolean) => {
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const syncTheme = useCallback(async () => {
    try {
      if (!window.system) {
        applyDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
        return;
      }
      const { data } = await window.system.getTheme();
      const nextTheme = (data.storeTheme as ThemeColor) || "system";
      setThemeColor(nextTheme);
      applyDarkMode(nextTheme === "system" ? data.systemTheme === "dark" : nextTheme === "dark");
    } catch (err) {
      console.error("[useTheme] 获取主题失败：", err);
    }
  }, [applyDarkMode]);

  const changeTheme = async (value: ThemeColor) => {
    setThemeColor(value);
    if (!window.system) {
      applyDarkMode(value === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : value === "dark");
      return;
    }
    await window.system.changeTheme(value);
    await syncTheme();
  };

  useEffect(() => {
    void syncTheme();
    window.system?.onChangeTheme(syncTheme);
  }, [syncTheme]);

  return {
    isDark,
    themeColor,
    changeTheme,
    refreshTheme: syncTheme
  };
}
