import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '@shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh-CN',
  followAircraft: true,
  refreshIntervalMs: 500,
  providerMode: 'simconnect'
}

export class SettingsStore {
  private readonly filePath: string
  private settings: AppSettings = DEFAULT_SETTINGS

  constructor() {
    const baseDir = app.getPath('userData')
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
      ...partial
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
      return {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(raw)
      } as AppSettings
    } catch {
      return DEFAULT_SETTINGS
    }
  }
}
