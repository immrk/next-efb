import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  isAppLanguage,
  resolveAppLanguage,
  type AppLanguage
} from '@shared/i18n'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import zhTW from './locales/zh-TW.json'
import jaJP from './locales/ja-JP.json'
import koKR from './locales/ko-KR.json'
import nextEfbZhCN from '../locales/zh-CN/common.json'
import nextEfbEnUS from '../locales/en-US/common.json'
import nextEfbZhTW from '../locales/zh-TW/common.json'
import nextEfbJaJP from '../locales/ja-JP/common.json'
import nextEfbKoKR from '../locales/ko-KR/common.json'

export const SUPPORT_LOCALES = APP_LANGUAGES

function getLocale(): AppLanguage {
  const saved = localStorage.getItem('locale')
  if (isAppLanguage(saved)) return saved
  return resolveAppLanguage(navigator.languages?.length ? navigator.languages : navigator.language)
}

i18n
  .use(initReactI18next)
  .init({
    lng: getLocale(),
    fallbackLng: DEFAULT_APP_LANGUAGE,
    supportedLngs: SUPPORT_LOCALES,
    load: 'currentOnly',
    resources: {
      'en-US': { translation: { ...enUS, ...nextEfbEnUS } },
      'zh-CN': { translation: { ...zhCN, ...nextEfbZhCN } },
      'zh-TW': { translation: { ...zhTW, ...nextEfbZhTW } },
      'ja-JP': { translation: { ...jaJP, ...nextEfbJaJP } },
      'ko-KR': { translation: { ...koKR, ...nextEfbKoKR } },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n
