/*
 * React 语言管理，统一管理语言设置和系统跟随
 * 
 * 使用方式：
 * 1. 在组件中引入 useLanguage
 * 2. 使用 currentLanguage 来获取当前语言
 * 3. 使用 changeLanguage 来切换语言
 * 4. 使用 refreshLanguage 来刷新语言
 * 5. 使用 onLanguageChange 来监听语言变化
 * 
 * 注意：
 * 1. 引入时会自动监听系统语言变化，并更新 currentLanguage
 * 2. 切换语言时会自动调用 IPC 写入本地配置
 * 3. 基于 react-i18next 和主进程通信，实现语言管理
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isAppLanguage, resolveAppLanguage, type AppLanguage } from "@shared/i18n";

/** 统一定义类型，便于在别处复用 */
export type LanguageType = "system" | AppLanguage;

/**
 * 负责：
 * 1. 获取存储或系统语言并更新 `currentLanguage`
 * 2. 监听系统语言变化
 * 3. 暴露可写的 `currentLanguage` 供业务侧手动切换
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<LanguageType>("system");

  const syncLanguage = useCallback(async () => {
    try {
      if (!window.system) return;
      const { data } = await window.system.getLanguage();
      const nextLanguage = (data.storeLanguage as LanguageType) || "system";
      const resolvedLanguage = nextLanguage === "system"
        ? resolveAppLanguage(data.systemLanguage)
        : isAppLanguage(nextLanguage) ? nextLanguage : resolveAppLanguage(data.systemLanguage);
      setCurrentLanguage(nextLanguage);
      localStorage.setItem("locale", resolvedLanguage);
      await i18n.changeLanguage(resolvedLanguage);
    } catch (err) {
      console.error("[useLanguage] 获取语言失败：", err);
    }
  }, [i18n]);

  const changeLanguage = async (value: LanguageType) => {
    setCurrentLanguage(value);
    if (!window.system) {
      const fallbackLanguage = value === "system"
        ? resolveAppLanguage(navigator.languages?.length ? navigator.languages : navigator.language)
        : value;
      localStorage.setItem("locale", fallbackLanguage);
      await i18n.changeLanguage(fallbackLanguage);
      return;
    }
    await window.system.changeLanguage(value);
    await syncLanguage();
  };

  useEffect(() => {
    void syncLanguage();
    const removeLanguageListener = window.system?.onChangeLanguage((language) => {
      const resolvedLanguage = resolveAppLanguage(language);
      setCurrentLanguage(resolvedLanguage);
      localStorage.setItem("locale", resolvedLanguage);
      void i18n.changeLanguage(resolvedLanguage);
    });
    return removeLanguageListener;
  }, [i18n, syncLanguage]);

  return {
    currentLanguage,
    changeLanguage,
    refreshLanguage: syncLanguage
  };
}
