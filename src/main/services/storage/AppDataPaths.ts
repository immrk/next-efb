import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

function resolveInstallRoot(): string {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim()
  if (portableDir) {
    return portableDir
  }

  return app.isPackaged ? dirname(process.execPath) : process.cwd()
}

export function ensureDataRootDir(): string {
  const dataRoot = join(resolveInstallRoot(), 'data')
  mkdirSync(dataRoot, { recursive: true })
  return dataRoot
}
