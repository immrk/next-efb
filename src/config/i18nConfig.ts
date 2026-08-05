import { APP_LANGUAGES } from '../shared/i18n.js'

export const i18nConfig = {
  locales: ['system', ...APP_LANGUAGES] as const,
  defaultLocale: 'system',
}
