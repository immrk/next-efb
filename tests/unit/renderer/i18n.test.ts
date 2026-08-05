import { afterAll, describe, expect, it } from 'vitest'
import i18n from '../../../src/renderer/i18n'

describe('renderer translations', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  it.each([
    ['en-US', 'Charts aligned. Flights connected.'],
    ['zh-CN', '航图精准就位，飞行全程相连。'],
    ['zh-TW', '航圖精準就位，飛行全程相連。'],
    ['ja-JP', 'チャートを正確に、フライトをシームレスに。'],
    ['ko-KR', '차트는 정확하게, 비행은 끊김 없이.']
  ] as const)('loads the localized product slogan for %s', async (language, expected) => {
    await i18n.changeLanguage(language)
    expect(i18n.t('app.subtitle')).toBe(expected)
  })

  it('falls back to English when a supported locale has no translation', async () => {
    await i18n.changeLanguage('ja-JP')
    expect(i18n.t('update.title')).toBe('Application Update')
  })
})
