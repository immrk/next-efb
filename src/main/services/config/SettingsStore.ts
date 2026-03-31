import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings } from '@shared/types'
import { ensureDataRootDir } from '../storage/AppDataPaths'

const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh-CN',
  followAircraft: true,
  refreshIntervalMs: 500,
  providerMode: 'simconnect',
  mapTileProvider: 'osm',
  navData: {
    sqlitePath: null,
    autoDetect: true
  },
  simbrief: {
    username: '',
    userId: ''
  },
  lanAccess: {
    enabled: false,
    port: 31831,
    authEnabled: false,
    authToken: createAuthToken(),
    allowWrite: true
  }
}

export class SettingsStore {
  private readonly filePath: string
  private settings: AppSettings = DEFAULT_SETTINGS

  constructor() {
    const baseDir = ensureDataRootDir()
    mkdirSync(baseDir, { recursive: true })
    this.filePath = join(baseDir, 'settings.json')
    this.settings = this.load()
  }

  get(): AppSettings {
    return this.settings
  }

  update(partial: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...partial,
      navData: {
        ...this.settings.navData,
        ...partial.navData
      },
      simbrief: {
        ...this.settings.simbrief,
        ...partial.simbrief
      },
      lanAccess: {
        ...this.settings.lanAccess,
        ...partial.lanAccess
      }
    }
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
    return this.settings
  }

  private load(): AppSettings {
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8')
      return DEFAULT_SETTINGS
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        navData: {
          ...DEFAULT_SETTINGS.navData,
          ...parsed.navData
        },
        simbrief: {
          ...DEFAULT_SETTINGS.simbrief,
          ...parsed.simbrief
        },
        lanAccess: {
          ...DEFAULT_SETTINGS.lanAccess,
          ...parsed.lanAccess,
          allowWrite: true
        }
      } as AppSettings
    } catch {
      return DEFAULT_SETTINGS
    }
  }
}

function createAuthToken(): string {
  return randomBytes(24).toString('hex')
}
