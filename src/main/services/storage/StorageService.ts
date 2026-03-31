import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { ChartFileFormat, StorageSummary } from '@shared/chart-types'
import { ensureDataRootDir } from './AppDataPaths'

export class StorageService {
  private readonly storageSummary: StorageSummary

  constructor() {
    const root = ensureDataRootDir()
    const chartsRoot = join(root, 'charts')

    mkdirSync(root, { recursive: true })
    mkdirSync(chartsRoot, { recursive: true })

    this.storageSummary = {
      databasePath: join(root, 'app.db'),
      chartsRoot
    }
  }

  getSummary(): StorageSummary {
    return this.storageSummary
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
}
