import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { app } from 'electron'
import { APP_NAME } from '@shared/branding'
import type { AppSettings } from '@shared/types'

export interface AppStoragePaths {
  settingsRoot: string
  databasePath: string
  chartsRoot: string
  defaultChartsRoot: string
  legacyDataRoot: string
  isPortable: boolean
}

function resolveInstallRoot(): string {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim()
  if (portableDir) {
    return portableDir
  }

  return app.isPackaged ? dirname(process.execPath) : process.cwd()
}

function getLegacyDataRoot(): string {
  return join(resolveInstallRoot(), 'data')
}

function resolveSettingsRoot(isPortable: boolean): string {
  if (isPortable) {
    return getLegacyDataRoot()
  }

  return join(app.getPath('home'), APP_NAME)
}

export function getDefaultChartsRoot(): string {
  return join(app.getPath('home'), APP_NAME, 'charts')
}

export function resolveChartsRootPath(chartLibraryPath: string | null | undefined): string {
  const normalizedPath = chartLibraryPath?.trim()
  return normalizedPath ? resolve(normalizedPath) : getDefaultChartsRoot()
}

export function ensureAppStoragePaths(): AppStoragePaths {
  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR?.trim())
  const settingsRoot = resolveSettingsRoot(isPortable)
  const legacyDataRoot = getLegacyDataRoot()
  const defaultChartsRoot = isPortable ? join(getLegacyDataRoot(), 'charts') : getDefaultChartsRoot()

  mkdirSync(settingsRoot, { recursive: true })

  if (!isPortable) {
    migrateLegacySettingsAndDatabase(settingsRoot, legacyDataRoot)
  }

  const configuredChartsRoot = isPortable ? null : readConfiguredChartsRoot(settingsRoot)
  const chartsRoot = isPortable
    ? join(getLegacyDataRoot(), 'charts')
    : resolveChartsRootPath(configuredChartsRoot)
  const paths: AppStoragePaths = {
    settingsRoot,
    databasePath: join(settingsRoot, 'app.db'),
    chartsRoot,
    defaultChartsRoot,
    legacyDataRoot,
    isPortable
  }

  mkdirSync(chartsRoot, { recursive: true })

  if (!isPortable) {
    migrateLegacyCharts(paths)
  }

  return paths
}

export function ensureDataRootDir(): string {
  return ensureAppStoragePaths().settingsRoot
}

function migrateLegacySettingsAndDatabase(settingsRoot: string, legacyDataRoot: string): void {
  if (!existsSync(legacyDataRoot)) {
    return
  }

  const legacySettingsPath = join(legacyDataRoot, 'settings.json')
  const legacyDatabasePath = join(legacyDataRoot, 'app.db')
  const legacyDatabaseWalPath = join(legacyDataRoot, 'app.db-wal')
  const legacyDatabaseShmPath = join(legacyDataRoot, 'app.db-shm')
  const nextSettingsPath = join(settingsRoot, 'settings.json')
  const nextDatabasePath = join(settingsRoot, 'app.db')
  const nextDatabaseWalPath = `${nextDatabasePath}-wal`
  const nextDatabaseShmPath = `${nextDatabasePath}-shm`

  if (existsSync(legacySettingsPath) && !existsSync(nextSettingsPath)) {
    copyFileSync(legacySettingsPath, nextSettingsPath)
  }

  if (existsSync(legacyDatabasePath) && !existsSync(nextDatabasePath)) {
    copyFileSync(legacyDatabasePath, nextDatabasePath)
  }

  if (existsSync(legacyDatabaseWalPath) && !existsSync(nextDatabaseWalPath)) {
    copyFileSync(legacyDatabaseWalPath, nextDatabaseWalPath)
  }

  if (existsSync(legacyDatabaseShmPath) && !existsSync(nextDatabaseShmPath)) {
    copyFileSync(legacyDatabaseShmPath, nextDatabaseShmPath)
  }

}

function migrateLegacyCharts(paths: AppStoragePaths): void {
  const legacyChartsRoot = join(paths.legacyDataRoot, 'charts')
  if (!existsSync(legacyChartsRoot) || existsSync(join(paths.chartsRoot, '.migrated'))) {
    return
  }

  cpSync(legacyChartsRoot, paths.chartsRoot, {
    recursive: true,
    force: false,
    errorOnExist: false
  })
  writeFileSync(join(paths.chartsRoot, '.migrated'), new Date().toISOString(), 'utf-8')
}

function readConfiguredChartsRoot(settingsRoot: string): string | null {
  const settingsPath = join(settingsRoot, 'settings.json')
  if (!existsSync(settingsPath)) {
    return null
  }

  try {
    const raw = readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return parsed.storage?.chartLibraryPath?.trim() || null
  } catch {
    return null
  }
}
