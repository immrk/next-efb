import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSettings } from '../../helpers/factories'

const electronState = vi.hoisted(() => ({
  home: ''
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => {
      if (name !== 'home') throw new Error(`Unexpected Electron path: ${name}`)
      return electronState.home
    }
  }
}))

import {
  ensureAppStoragePaths,
  getDefaultChartsRoot,
  resolveChartsRootPath
} from '../../../src/main/services/storage/AppDataPaths'
import { SettingsStore } from '../../../src/main/services/config/SettingsStore'
import { StorageService } from '../../../src/main/services/storage/StorageService'

describe('settings and local storage services', () => {
  let testRoot: string

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), 'nextefb-storage-'))
    electronState.home = testRoot
    vi.stubEnv('PORTABLE_EXECUTABLE_DIR', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('creates default app paths under the user home', () => {
    const paths = ensureAppStoragePaths()
    expect(paths.isPortable).toBe(false)
    expect(paths.settingsRoot).toBe(join(testRoot, 'NextEFB'))
    expect(paths.chartsRoot).toBe(join(testRoot, 'NextEFB', 'charts'))
    expect(paths.databasePath).toBe(join(testRoot, 'NextEFB', 'app.db'))
    expect(existsSync(paths.settingsRoot)).toBe(true)
    expect(existsSync(paths.chartsRoot)).toBe(true)
    expect(getDefaultChartsRoot()).toBe(join(testRoot, 'NextEFB', 'charts'))
    expect(resolveChartsRootPath('  .\\custom-charts  ')).toBe(resolve('.\\custom-charts'))
  })

  it('uses and initializes portable storage when requested', () => {
    const portableRoot = join(testRoot, 'portable')
    vi.stubEnv('PORTABLE_EXECUTABLE_DIR', portableRoot)

    const paths = ensureAppStoragePaths()
    expect(paths.isPortable).toBe(true)
    expect(paths.settingsRoot).toBe(join(portableRoot, 'data'))
    expect(paths.chartsRoot).toBe(join(portableRoot, 'data', 'charts'))
  })

  it('persists settings and deeply merges nested values', () => {
    const store = new SettingsStore('zh-CN')
    expect(store.get()).toMatchObject({
      language: 'zh-CN',
      providerMode: 'simconnect',
      mapTileProvider: 'cartoLight',
      lanAccess: { enabled: true, allowWrite: true }
    })

    const next = store.update({
      language: 'en-US',
      navData: { sqlitePath: 'nav.db', autoDetect: false },
      lanAccess: { port: 40_000 } as never
    })

    expect(next).toMatchObject({
      language: 'en-US',
      navData: { sqlitePath: 'nav.db', autoDetect: false },
      lanAccess: {
        enabled: true,
        port: 40_000,
        allowWrite: true
      }
    })

    const reloaded = new SettingsStore('zh-CN')
    expect(reloaded.get()).toMatchObject({
      language: 'en-US',
      navData: { sqlitePath: 'nav.db', autoDetect: false }
    })
  })

  it('recovers from malformed settings and enforces writable LAN access', () => {
    const paths = ensureAppStoragePaths()
    const settingsPath = join(paths.settingsRoot, 'settings.json')
    writeFileSync(settingsPath, '{not-json', 'utf8')
    expect(new SettingsStore('en-US').get().language).toBe('en-US')

    writeFileSync(
      settingsPath,
      JSON.stringify({
        language: 'zh-CN',
        lanAccess: { enabled: false, allowWrite: false }
      }),
      'utf8'
    )
    expect(new SettingsStore('en-US').get().lanAccess.allowWrite).toBe(true)
  })

  it('imports, reads, writes, relocates and deletes chart files', () => {
    const source = join(testRoot, 'source.PNG')
    writeFileSync(source, Buffer.from('source-bytes'))
    const storage = new StorageService()

    const imported = storage.importChartFile(source, 'chart-a')
    expect(imported.fileName).toBe('source.png')
    expect(readFileSync(imported.destinationPath, 'utf8')).toBe('source-bytes')
    expect(storage.readFileBase64(imported.destinationPath)).toBe(
      Buffer.from('source-bytes').toString('base64')
    )

    const written = storage.writeChartSourceFile(
      'chart-b',
      'jpeg',
      Buffer.from('jpeg-bytes').toString('base64')
    )
    expect(written.fileName).toBe('source.jpg')

    const displayPath = storage.writeChartDisplayImage(
      'chart-b',
      'image/jpeg',
      Buffer.from('display').toString('base64')
    )
    expect(displayPath.endsWith('display.jpg')).toBe(true)

    const previousRoot = storage.getSummary().chartsRoot
    const nextRoot = join(testRoot, 'relocated')
    expect(storage.relocateChartsRoot(nextRoot)).toEqual({
      previousChartsRoot: resolve(previousRoot),
      nextChartsRoot: resolve(nextRoot)
    })
    expect(existsSync(join(nextRoot, 'chart-a', 'source.png'))).toBe(true)
    expect(existsSync(previousRoot)).toBe(false)

    storage.deleteChartFiles('chart-a')
    expect(existsSync(join(nextRoot, 'chart-a'))).toBe(false)
    expect(storage.relocateChartsRoot(nextRoot).nextChartsRoot).toBe(resolve(nextRoot))
  })

  it('stores checklist sources separately from the chart library', () => {
    const source = join(testRoot, 'normal-procedures.pdf')
    writeFileSync(source, Buffer.from('checklist-pdf'))
    const storage = new StorageService()

    const imported = storage.importChecklistFile(source, 'checklist-a')
    expect(imported.fileName).toBe('source.pdf')
    expect(readFileSync(imported.destinationPath, 'utf8')).toBe('checklist-pdf')
    expect(imported.destinationPath).not.toContain(storage.getSummary().chartsRoot)

    const written = storage.writeChecklistSourceFile(
      'checklist-b',
      'jpeg',
      Buffer.from('checklist-image').toString('base64')
    )
    expect(written.fileName).toBe('source.jpg')
    expect(readFileSync(written.destinationPath, 'utf8')).toBe('checklist-image')

    storage.deleteChecklistFiles('checklist-a')
    expect(existsSync(imported.destinationPath)).toBe(false)
  })

  it('rejects chart library paths nested in either direction', () => {
    const storage = new StorageService()
    const current = storage.getSummary().chartsRoot

    expect(() => storage.relocateChartsRoot(join(current, 'nested'))).toThrow(
      'CHART_LIBRARY_PATH_CONFLICT'
    )
    expect(() => storage.relocateChartsRoot(resolve(current, '..'))).toThrow(
      'CHART_LIBRARY_PATH_CONFLICT'
    )
  })

  it('resolves a configured chart library from settings', () => {
    const storage = new StorageService()
    const configured = join(testRoot, 'configured')
    expect(
      storage.resolveChartsRoot(
        createSettings({ storage: { chartLibraryPath: configured } })
      )
    ).toBe(resolve(configured))
  })
})
