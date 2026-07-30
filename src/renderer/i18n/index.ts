import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import nextEfbZhCN from '../locales/zh-CN/common.json'
import nextEfbEnUS from '../locales/en-US/common.json'

export const SUPPORT_LOCALES = ['zh-CN', 'en-US'] as const

function getLocale(): string {
  const saved = localStorage.getItem('locale')
  if (saved && SUPPORT_LOCALES.includes(saved as (typeof SUPPORT_LOCALES)[number])) return saved
  return navigator.language.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
}

i18n
  .use(initReactI18next)
  .init({
    lng: getLocale(),
    fallbackLng: 'zh-CN',
    resources: {
      'zh-CN': { translation: { ...zhCN, ...nextEfbZhCN } },
      'en-US': { translation: { ...enUS, ...nextEfbEnUS } },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n
