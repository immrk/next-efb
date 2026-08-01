import path from 'path'
import { fileURLToPath } from 'url'
import i18next, { InitOptions, TOptions } from 'i18next'
import Backend from 'i18next-fs-backend'
import { i18nConfig } from '../../config/i18nConfig.js'
import {
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  isAppLanguage,
  resolveAppLanguage,
  type AppLanguage
} from '../../shared/i18n.js'
import Store from 'electron-store'
import { app } from 'electron'

/* -------------------------------------------------------------------------- */
/*  Paths & Constants                                                         */
/* -------------------------------------------------------------------------- */
export type SupportedLanguages = typeof i18nConfig.locales[number]

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ⽀持的语⾔列表，如需新增，请在此处维护后再补充 locale JSON
export const SUPPORTED_LANGUAGES: typeof i18nConfig.locales = i18nConfig.locales
const DEFAULT_LANGUAGE: AppLanguage = DEFAULT_APP_LANGUAGE

/** 把语⾔写⼊进程环境变量，避免系统语⾔影响 i18next */
const patchProcessEnv = (lng: AppLanguage) => {
  Object.assign(process.env, {
    LANG: lng,
    LANGUAGE: lng,
    LC_ALL: lng,
  })
}

// 初始化 store
const store = new Store()

/* -------------------------------------------------------------------------- */
/*  Core Init                                                                 */
/* -------------------------------------------------------------------------- */

let initialized = false

export const initMainI18n = async (): Promise<void> => {
  if (initialized) return // 避免重复初始化

  // 获取 store 中的语言
  const storedLanguage = store.get('language')
  const lng = storedLanguage === 'system' || storedLanguage === undefined
    ? resolveAppLanguage(app.getLocale())
    : isAppLanguage(storedLanguage)
      ? storedLanguage
      : DEFAULT_LANGUAGE
  patchProcessEnv(lng)

  const options: InitOptions = {
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: APP_LANGUAGES,
    load: 'currentOnly',
    ns: ['menu'],
    defaultNS: 'menu',
    backend: {
      // 注意：打包后 __dirname 指向 dist 目录，所以需要加上 main 子目录
      loadPath: path.join(__dirname, './main/i18n/locales/{{lng}}.json'),
      addPath: path.join(__dirname, './main/i18n/locales/{{lng}}.json'),
    },
    interpolation: { escapeValue: false },
    debug: process.env.NODE_ENV === 'development',
    initImmediate: false,
  }

  await i18next.use(Backend).init(options)
  initialized = true
}

/* -------------------------------------------------------------------------- */
/*  Helpers & Public API                                                      */
/* -------------------------------------------------------------------------- */

export const t = (key: string, options?: TOptions): string =>
  (options ? i18next.t(key, options as never) : i18next.t(key)) as string

export const setLanguage = async (
  language: SupportedLanguages,
): Promise<AppLanguage> => {
  const resolvedLanguage = language === 'system'
    ? resolveAppLanguage(app.getLocale())
    : isAppLanguage(language)
      ? language
      : DEFAULT_LANGUAGE
  store.set(
    'language',
    language === 'system' || isAppLanguage(language) ? language : DEFAULT_LANGUAGE
  )
  patchProcessEnv(resolvedLanguage)
  await i18next.changeLanguage(resolvedLanguage)
  return resolvedLanguage
}

export const getCurrentLanguage = (): AppLanguage =>
  isAppLanguage(i18next.resolvedLanguage) ? i18next.resolvedLanguage : DEFAULT_LANGUAGE

export const getSupportedLanguages = (): SupportedLanguages[] => [...SUPPORTED_LANGUAGES]

export const isLanguageSupported = (lng: string): lng is SupportedLanguages =>
  SUPPORTED_LANGUAGES.includes(lng as SupportedLanguages)
