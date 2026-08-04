import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  watch,
  writeFileSync,
  type FSWatcher
} from 'node:fs'
import { basename, extname, join, resolve, sep } from 'node:path'
import type { ChartFileFormat, StorageSummary } from '@shared/chart-types'
import type { DocumentFileFormat } from '@shared/document-types'
import type { AppSettings } from '@shared/types'
import { ensureAppStoragePaths, resolveChartsRootPath } from './AppDataPaths'

export class StorageService {
  private storageSummary: StorageSummary
  private readonly checklistsRoot: string
  private chartLibraryWatcher: FSWatcher | null = null
  private readonly chartLibraryListeners = new Set<() => void>()

  constructor(settings?: AppSettings) {
    const paths = ensureAppStoragePaths()
    const { settingsRoot, databasePath, defaultChartsRoot, legacyDataRoot } = paths
    const chartsRoot = settings
      ? resolveChartsRootPath(settings.storage.chartLibraryPath)
      : paths.chartsRoot
    this.checklistsRoot = join(settingsRoot, 'checklists')

    mkdirSync(settingsRoot, { recursive: true })
    mkdirSync(chartsRoot, { recursive: true })
    mkdirSync(this.checklistsRoot, { recursive: true })

    this.storageSummary = {
      databasePath,
      chartsRoot,
      defaultChartsRoot,
      legacyChartsRoot: join(legacyDataRoot, 'charts')
    }
  }

  getSummary(): StorageSummary {
    return this.storageSummary
  }

  resolveChartsRoot(settings: AppSettings): string {
    return resolveChartsRootPath(settings.storage.chartLibraryPath)
  }

  relocateChartsRoot(nextChartsRoot: string): { previousChartsRoot: string; nextChartsRoot: string } {
    const previousChartsRoot = resolve(this.storageSummary.chartsRoot)
    const normalizedNextChartsRoot = resolve(nextChartsRoot)

    if (samePath(previousChartsRoot, normalizedNextChartsRoot)) {
      return {
        previousChartsRoot,
        nextChartsRoot: normalizedNextChartsRoot
      }
    }

    if (
      isNestedPath(previousChartsRoot, normalizedNextChartsRoot) ||
      isNestedPath(normalizedNextChartsRoot, previousChartsRoot)
    ) {
      throw new Error('CHART_LIBRARY_PATH_CONFLICT')
    }

    const shouldRestartWatcher = this.chartLibraryWatcher !== null
    this.stopChartLibraryWatcher()

    try {
      mkdirSync(normalizedNextChartsRoot, { recursive: true })
      cpSync(previousChartsRoot, normalizedNextChartsRoot, {
        recursive: true,
        force: false,
        errorOnExist: false
      })
      rmSync(previousChartsRoot, { recursive: true, force: true })

      this.storageSummary = {
        ...this.storageSummary,
        chartsRoot: normalizedNextChartsRoot
      }
    } finally {
      if (shouldRestartWatcher) {
        this.startChartLibraryWatcher()
      }
    }

    return {
      previousChartsRoot,
      nextChartsRoot: normalizedNextChartsRoot
    }
  }

  importChartFile(sourcePath: string, chartId: string): { destinationPath: string; fileName: string } {
    const chartDir = join(this.storageSummary.chartsRoot, chartId)
    const extension = extname(sourcePath).toLowerCase()
    const fileName = `source${extension}`
    const destinationPath = join(chartDir, fileName)

    mkdirSync(chartDir, { recursive: true })
    copyFileSync(sourcePath, destinationPath)

    return {
      destinationPath,
      fileName: basename(destinationPath)
    }
  }

  writeChartSourceFile(
    chartId: string,
    fileFormat: ChartFileFormat,
    base64: string
  ): { destinationPath: string; fileName: string } {
    const chartDir = join(this.storageSummary.chartsRoot, chartId)
    const normalizedExtension = fileFormat === 'jpeg' ? 'jpg' : fileFormat
    const fileName = `source.${normalizedExtension}`
    const destinationPath = join(chartDir, fileName)

    mkdirSync(chartDir, { recursive: true })
    writeFileSync(destinationPath, Buffer.from(base64, 'base64'))

    return {
      destinationPath,
      fileName
    }
  }

  readFileBase64(filePath: string): string {
    return readFileSync(filePath).toString('base64')
  }

  writeChartDisplayImage(chartId: string, mimeType: string, base64: string): string {
    const chartDir = join(this.storageSummary.chartsRoot, chartId)
    mkdirSync(chartDir, { recursive: true })
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const destinationPath = join(chartDir, `display.${extension}`)
    writeFileSync(destinationPath, Buffer.from(base64, 'base64'))
    return destinationPath
  }

  deleteChartFiles(chartId: string): void {
    const chartDir = join(this.storageSummary.chartsRoot, chartId)
    rmSync(chartDir, { recursive: true, force: true })
  }

  onChartLibraryChanged(listener: () => void): () => void {
    this.chartLibraryListeners.add(listener)
    this.startChartLibraryWatcher()

    return () => {
      this.chartLibraryListeners.delete(listener)
      if (this.chartLibraryListeners.size === 0) {
        this.stopChartLibraryWatcher()
      }
    }
  }

  importChecklistFile(
    sourcePath: string,
    checklistId: string
  ): { destinationPath: string; fileName: string } {
    return importDocumentFile(this.checklistsRoot, sourcePath, checklistId)
  }

  writeChecklistSourceFile(
    checklistId: string,
    fileFormat: DocumentFileFormat,
    base64: string
  ): { destinationPath: string; fileName: string } {
    return writeDocumentSourceFile(this.checklistsRoot, checklistId, fileFormat, base64)
  }

  deleteChecklistFiles(checklistId: string): void {
    const checklistDir = join(this.checklistsRoot, checklistId)
    rmSync(checklistDir, { recursive: true, force: true })
  }

  private startChartLibraryWatcher(): void {
    if (this.chartLibraryWatcher || this.chartLibraryListeners.size === 0) {
      return
    }

    mkdirSync(this.storageSummary.chartsRoot, { recursive: true })
    try {
      const watcher = watch(this.storageSummary.chartsRoot, { recursive: true }, () => {
        this.chartLibraryListeners.forEach((listener) => listener())
      })
      watcher.on('error', () => {
        if (this.chartLibraryWatcher === watcher) {
          this.stopChartLibraryWatcher()
        }
      })
      this.chartLibraryWatcher = watcher
    } catch {
      this.chartLibraryWatcher = null
    }
  }

  private stopChartLibraryWatcher(): void {
    this.chartLibraryWatcher?.close()
    this.chartLibraryWatcher = null
  }
}

function importDocumentFile(
  root: string,
  sourcePath: string,
  documentId: string
): { destinationPath: string; fileName: string } {
  const documentDir = join(root, documentId)
  const extension = extname(sourcePath).toLowerCase()
  const fileName = `source${extension}`
  const destinationPath = join(documentDir, fileName)

  mkdirSync(documentDir, { recursive: true })
  copyFileSync(sourcePath, destinationPath)

  return {
    destinationPath,
    fileName: basename(destinationPath)
  }
}

function writeDocumentSourceFile(
  root: string,
  documentId: string,
  fileFormat: DocumentFileFormat,
  base64: string
): { destinationPath: string; fileName: string } {
  const documentDir = join(root, documentId)
  const normalizedExtension = fileFormat === 'jpeg' ? 'jpg' : fileFormat
  const fileName = `source.${normalizedExtension}`
  const destinationPath = join(documentDir, fileName)

  mkdirSync(documentDir, { recursive: true })
  writeFileSync(destinationPath, Buffer.from(base64, 'base64'))

  return {
    destinationPath,
    fileName
  }
}

function samePath(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right)
}

function isNestedPath(parent: string, child: string): boolean {
  const normalizedParent = `${normalizePath(parent)}${sep}`
  const normalizedChild = `${normalizePath(child)}${sep}`
  return normalizedChild.startsWith(normalizedParent)
}

function normalizePath(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value
}
