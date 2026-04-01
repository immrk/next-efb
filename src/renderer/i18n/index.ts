import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from '../locales/zh-CN/common.json'
import enUS from '../locales/en-US/common.json'

const systemLanguage = resolveSystemLanguage()

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS }
  },
  lng: systemLanguage,
  fallbackLng: 'en-US',
  interpolation: {
    escapeValue: false
  }
})

export default i18n

function resolveSystemLanguage(): 'zh-CN' | 'en-US' {
  const locale = typeof navigator !== 'undefined' ? navigator.language : ''
  return locale.trim().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}
