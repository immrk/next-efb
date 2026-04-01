import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppLanguage, AppSettings } from '@shared/types'
import { ensureDataRootDir } from '../storage/AppDataPaths'

const DEFAULT_SETTINGS_BASE: AppSettings = {
  language: 'en-US',
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
  private readonly defaultLanguage: AppLanguage
  private settings: AppSettings

  constructor(defaultLanguage: AppLanguage) {
    const baseDir = ensureDataRootDir()
    mkdirSync(baseDir, { recursive: true })
    this.filePath = join(baseDir, 'settings.json')
    this.defaultLanguage = defaultLanguage
    this.settings = this.withDefaultLanguage(DEFAULT_SETTINGS_BASE)
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
      this.settings = this.withDefaultLanguage(DEFAULT_SETTINGS_BASE)
      writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
      return this.settings
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        ...this.withDefaultLanguage(DEFAULT_SETTINGS_BASE),
        ...parsed,
        navData: {
          ...DEFAULT_SETTINGS_BASE.navData,
          ...parsed.navData
        },
        simbrief: {
          ...DEFAULT_SETTINGS_BASE.simbrief,
          ...parsed.simbrief
        },
        lanAccess: {
          ...DEFAULT_SETTINGS_BASE.lanAccess,
          ...parsed.lanAccess,
          allowWrite: true
        }
      } as AppSettings
    } catch {
      return this.withDefaultLanguage(DEFAULT_SETTINGS_BASE)
    }
  }

  private withDefaultLanguage(settings: AppSettings): AppSettings {
    return {
      ...settings,
      language: this.defaultLanguage
    }
  }
}

function createAuthToken(): string {
  return randomBytes(24).toString('hex')
}
