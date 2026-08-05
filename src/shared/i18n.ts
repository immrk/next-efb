export const APP_LANGUAGES = ['en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR'] as const

export type AppLanguage = (typeof APP_LANGUAGES)[number]

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'en-US'

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && APP_LANGUAGES.includes(value as AppLanguage)
}

/**
 * Resolve browser and operating-system locale identifiers to a supported app locale.
 * Unknown locales intentionally fall back to English.
 */
export function resolveAppLanguage(
  locales: string | readonly string[] | null | undefined
): AppLanguage {
  const candidates = typeof locales === 'string' ? [locales] : locales ?? []

  for (const candidate of candidates) {
    const normalized = candidate.trim().replaceAll('_', '-').toLowerCase()
    if (!normalized) continue

    if (normalized === 'zh-hant' || normalized.startsWith('zh-hant-') || /^zh-(tw|hk|mo)(-|$)/.test(normalized)) {
      return 'zh-TW'
    }
    if (
      normalized === 'zh-hans' ||
      normalized.startsWith('zh-hans-') ||
      normalized === 'zh' ||
      /^zh-(cn|sg)(-|$)/.test(normalized)
    ) {
      return 'zh-CN'
    }
    if (normalized === 'ja' || normalized.startsWith('ja-')) {
      return 'ja-JP'
    }
    if (normalized === 'ko' || normalized.startsWith('ko-')) {
      return 'ko-KR'
    }
    if (normalized === 'en' || normalized.startsWith('en-')) {
      return 'en-US'
    }
  }

  return DEFAULT_APP_LANGUAGE
}
