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

const THEME_STORAGE_KEY = "nextefb-theme";
const THEME_CHANGE_EVENT = "nextefb:theme-change";

function isThemeColor(value: unknown): value is ThemeColor {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): ThemeColor {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeColor(storedTheme) ? storedTheme : "dark";
  } catch {
    return "dark";
  }
}

function resolveDarkMode(theme: ThemeColor): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function persistTheme(theme: ThemeColor): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in hardened webviews; the active theme still applies.
  }
}

const initialTheme = readStoredTheme();
document.documentElement.classList.toggle("dark", resolveDarkMode(initialTheme));

/**
 * 负责：
 * 1. 获取存储或系统主题并更新 `isDark`
 * 2. 监听系统主题变化
 * 3. 暴露可写的 `themeColor` 供业务侧手动切换
 */
export function useTheme() {
  const [themeColor, setThemeColor] = useState<ThemeColor>(initialTheme);
  const [isDark, setIsDark] = useState(() => resolveDarkMode(initialTheme));

  const applyTheme = useCallback((theme: ThemeColor) => {
    const dark = resolveDarkMode(theme);
    setThemeColor(theme);
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
    persistTheme(theme);
  }, []);

  const syncTheme = useCallback(async () => {
    try {
      if (!window.system) {
        applyTheme(readStoredTheme());
        return;
      }
      const { data } = await window.system.getTheme();
      const nextTheme = isThemeColor(data.storeTheme) ? data.storeTheme : "dark";
      applyTheme(nextTheme);
    } catch (err) {
      console.error("[useTheme] 获取主题失败：", err);
      applyTheme(readStoredTheme());
    }
  }, [applyTheme]);

  const changeTheme = useCallback(async (value: ThemeColor) => {
    applyTheme(value);
    window.dispatchEvent(new CustomEvent<ThemeColor>(THEME_CHANGE_EVENT, { detail: value }));
    if (window.system) {
      await window.system.changeTheme(value);
    }
  }, [applyTheme]);

  useEffect(() => {
    void syncTheme();
    const removeSystemListener = window.system?.onChangeTheme((value) => {
      applyTheme(isThemeColor(value) ? value : "dark");
    });
    const handleLocalThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<ThemeColor>).detail;
      if (isThemeColor(nextTheme)) applyTheme(nextTheme);
    };
    window.addEventListener(THEME_CHANGE_EVENT, handleLocalThemeChange);

    return () => {
      if (typeof removeSystemListener === "function") removeSystemListener();
      window.removeEventListener(THEME_CHANGE_EVENT, handleLocalThemeChange);
    };
  }, [applyTheme, syncTheme]);

  useEffect(() => {
    if (themeColor !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => applyTheme("system");
    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, [applyTheme, themeColor]);

  return {
    isDark,
    themeColor,
    changeTheme,
    refreshTheme: syncTheme
  };
}
