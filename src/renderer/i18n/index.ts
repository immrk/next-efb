import { createI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN/common.json'
import enUS from '../locales/en-US/common.json'

const systemLanguage = resolveSystemLanguage()

const i18n = createI18n({
  legacy: false,
  locale: systemLanguage,
  fallbackLocale: 'en-US',
  flatJson: true,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export default i18n

function resolveSystemLanguage(): 'zh-CN' | 'en-US' {
  const locale = typeof navigator !== 'undefined' ? navigator.language : ''
  return locale.trim().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}
