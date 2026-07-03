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
      'forge.config.ts',
      'nodemon.json',
      'tsup.config.ts',
      'vite.config.ts',
      'scripts/dev.js',
      'scripts/main.js',
      'scripts/rendererBuild.js',
      'src/config/windowConfig.ts',
      'src/main/main.ts',
      'src/main/windowManager.ts',
      'src/main/preload/index.ts',
      'src/renderer/window/main/App.vue',
      'src/renderer/window/main/index.html',
      'src/renderer/window/main/components/LeftBar.vue',
      'src/renderer/window/main/components/TitleBar.vue',
      'src/renderer/window/main/router/index.ts',
      'src/renderer/window/login/components/LoginBox.vue',
      'src/renderer/window/login/index.html',
      'src/renderer/window/setting/index.html'
    ]
    expect(expected.every((file) => existsSync(resolve(process.cwd(), file)))).toBe(true)
  })

  it('uses the template build, development, debug, and packaging commands', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    ) as {
      main: string
      type: string
      config: { forge: string }
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }
    const tasks = JSON.parse(
      readFileSync(resolve(process.cwd(), '.vscode/tasks.json'), 'utf8')
    ) as {
      tasks: Array<{ label: string; dependsOrder?: string }>
    }

    expect(manifest.main).toBe('./dist/main/main.js')
    expect(manifest.type).toBe('module')
    expect(manifest.config.forge).toBe('./forge.config.ts')
    expect(manifest.scripts).toMatchObject({
      watch: 'nodemon',
      dev: 'node scripts/dev.js',
      'build:renderer': 'node scripts/rendererBuild.js',
      start: 'electron ./dist/main/main.js',
      'forge:start': 'electron-forge start',
      package: 'electron-forge package',
      tsup: 'tsup',
      'build:main': 'node scripts/main.js'
    })
    expect(manifest.devDependencies).toHaveProperty('@electron-forge/cli')
    expect(manifest.devDependencies).toHaveProperty('tsup')
    expect(manifest.devDependencies).toHaveProperty('nodemon')
    expect(manifest.devDependencies).not.toHaveProperty('electron-vite')
    expect(manifest.devDependencies).not.toHaveProperty('electron-builder')
    expect(tasks.tasks.find((task) => task.label === 'build-all')?.dependsOrder).toBe(
      'sequence'
    )
  })

  it('contains no former electron-vite or electron-builder configuration', () => {
    expect(existsSync(resolve(process.cwd(), 'electron.vite.config.ts'))).toBe(false)
    expect(existsSync(resolve(process.cwd(), 'scripts/after-pack.cjs'))).toBe(false)
    expect(existsSync(resolve(process.cwd(), 'scripts/clean-release.mjs'))).toBe(false)

    const sources = ['package.json', 'README.md', 'src/main/services/lan/LanServer.ts']
      .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
      .join('\n')
    expect(sources).not.toMatch(/electron-vite|electron-builder|build:bundle|pack:dir/)
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
