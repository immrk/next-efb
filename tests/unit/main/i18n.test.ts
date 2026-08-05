import { describe, expect, it } from 'vitest'
import {
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  isAppLanguage,
  resolveAppLanguage
} from '../../../src/shared/i18n'

describe('shared locale resolution', () => {
  it('exposes the production locale set with English as the fallback', () => {
    expect(APP_LANGUAGES).toEqual(['en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR'])
    expect(DEFAULT_APP_LANGUAGE).toBe('en-US')
  })

  it.each([
    ['en-GB', 'en-US'],
    ['zh', 'zh-CN'],
    ['zh-Hans-SG', 'zh-CN'],
    ['zh-Hant', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['ja', 'ja-JP'],
    ['ja-JP', 'ja-JP'],
    ['ko', 'ko-KR'],
    ['ko_KR', 'ko-KR']
  ] as const)('maps %s to %s', (systemLocale, expected) => {
    expect(resolveAppLanguage(systemLocale)).toBe(expected)
  })

  it('uses the first supported browser locale and falls back to English', () => {
    expect(resolveAppLanguage(['fr-FR', 'ja-JP', 'en-US'])).toBe('ja-JP')
    expect(resolveAppLanguage('fr-FR')).toBe('en-US')
    expect(resolveAppLanguage(undefined)).toBe('en-US')
  })

  it('only accepts canonical supported locale identifiers as persisted values', () => {
    expect(isAppLanguage('zh-TW')).toBe(true)
    expect(isAppLanguage('zh-HK')).toBe(false)
    expect(isAppLanguage('system')).toBe(false)
  })
})
