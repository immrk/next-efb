import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import router from '../src/renderer/window/main/router'

describe('template architecture', () => {
  it('maps every original feature page to a template sidebar tab or nested tab page', () => {
    const paths = router.getRoutes().map((route) => route.path)
    expect(paths).toEqual(
      expect.arrayContaining(['/map', '/charts', '/charts/:chartId', '/settings'])
    )
  })

  it('uses the template main/preload/window directory layout', () => {
    const expected = [
      'src/config/windowConfig.ts',
      'src/main/main.ts',
      'src/main/preload/index.ts',
      'src/renderer/window/main/App.vue',
      'src/renderer/window/main/components/LeftBar.vue',
      'src/renderer/window/main/components/TitleBar.vue',
      'src/renderer/window/main/router/index.ts',
      'src/renderer/window/login/components/LoginBox.vue'
    ]
    expect(expected.every((file) => existsSync(resolve(process.cwd(), file)))).toBe(true)
  })

  it('keeps UI colors semantic and contains no custom font sizes', () => {
    const files = [
      'src/renderer/styles.css',
      'src/renderer/window/main/App.vue',
      'src/renderer/window/main/components/LeftBar.vue',
      'src/renderer/window/main/components/TitleBar.vue',
      'src/renderer/window/main/components/LoginDialog.vue',
      'src/renderer/window/main/components/UserPopover.vue',
      'src/renderer/window/login/components/LoginBox.vue',
      'src/renderer/window/main/views/MapView.vue',
      'src/renderer/window/main/views/ChartsView.vue',
      'src/renderer/window/main/views/ChartDetailView.vue',
      'src/renderer/window/main/views/SettingsView.vue'
    ]
    const source = files
      .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(source).not.toMatch(/\brgba?\s*\(/i)
    expect(source).not.toMatch(/font-size\s*:/i)
    expect(source).not.toMatch(/font-family\s*:/i)
  })

  it('does not retain the former React UI stack', () => {
    const manifest = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    expect(manifest).not.toMatch(/"react(?:-dom|-leaflet|-i18next)?"/)
    expect(manifest).not.toContain('@radix-ui')
    expect(manifest).not.toContain('sonner')
  })

  it('uses vue-i18n placeholders in every locale', () => {
    const locales = [
      'src/renderer/locales/zh-CN/common.json',
      'src/renderer/locales/en-US/common.json'
    ]
      .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
      .join('\n')
    expect(locales).not.toContain('{{')
    expect(locales).not.toContain('}}')
  })
})
