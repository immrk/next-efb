import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import type {
  ChartBundleExportResult,
  ChartBundleImportInput,
  ChartBundleImportPreview,
  ChartBundleImportResult,
  ChartFileFormat,
  ChartRecord,
  ChartTitleMode,
  ChartType,
  GeoReferencePoint,
  StorageSummary
} from '@shared/chart-types'
import type {
  NavAirportProcedures,
  NavProcedureOption
} from '@shared/flight-plan-types'
import type { AppSettings } from '@shared/types'
import type { NavDataService } from '../navigation/NavDataService'
import {
  type ChartRepositoryImportEntry,
  ChartRepository
} from './ChartRepository'
import { createZipArchive, readZipArchive } from './ZipArchive'

const BUNDLE_FORMAT = 'nextefb.chart-bundle'
const BUNDLE_SCHEMA_VERSION = 1
const MANIFEST_PATH = 'manifest.json'
const MAX_ARCHIVE_SIZE = 256 * 1024 * 1024
const MAX_ENTRY_SIZE = 128 * 1024 * 1024
const MAX_TOTAL_SIZE = 512 * 1024 * 1024
const MAX_ENTRIES = 500
const MAX_CHARTS = 200
const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 2
const VALID_CHART_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/
const VALID_HASH = /^[a-f0-9]{64}$/

interface ChartBundleServiceOptions {
  chartRepository: ChartRepository
  getStorageSummary: () => StorageSummary
  navDataService: Pick<NavDataService, 'getAirportProcedures'>
}

interface BundleAsset {
  path: string
  format: ChartFileFormat
  size: number
  sha256: string
}

interface BundleProcedureBinding {
  sourceId: string
  name: string | null
  procedureType: NavProcedureOption['procedureType'] | null
  runwayName: string | null
}

interface BundleGeoPoint {
  index: 1 | 2
  mapLat: number
  mapLon: number
  chartX: number
  chartY: number
}

interface BundleChart {
  id: string
  title: string
  airportCode: string | null
  chartType: ChartType
  titleMode: ChartTitleMode
  width: number | null
  height: number | null
  createdAt: number
  updatedAt: number
  assets: {
    source: BundleAsset
    preview: BundleAsset | null
  }
  georeference: {
    points: BundleGeoPoint[]
  }
  bindings: {
    runways: string[]
    procedures: BundleProcedureBinding[]
  }
}

interface BundleManifest {
  format: typeof BUNDLE_FORMAT
  schemaVersion: typeof BUNDLE_SCHEMA_VERSION
  bundleId: string
  exportedAt: number
  producer: {
    name: 'NextEFB'
    version: string
  }
  charts: BundleChart[]
}

interface ResolvedBindings {
  runwayNames: string[]
  procedureIds: string[]
}

interface LoadedChart {
  manifest: BundleChart
  sourceData: Buffer
  previewData: Buffer | null
  preview: ChartBundleImportPreview['charts'][number]
}

interface ImportSession {
  id: string
  createdAt: number
  fileName: string
  manifest: BundleManifest
  charts: LoadedChart[]
}

export class ChartBundleService {
  private readonly chartRepository: ChartRepository
  private readonly getStorageSummary: () => StorageSummary
  private readonly navDataService: Pick<NavDataService, 'getAirportProcedures'>
  private readonly sessions = new Map<string, ImportSession>()

  constructor(options: ChartBundleServiceOptions) {
    this.chartRepository = options.chartRepository
    this.getStorageSummary = options.getStorageSummary
    this.navDataService = options.navDataService
  }

  exportBundle(
    destinationPath: string,
    chartIds: string[],
    settings: AppSettings,
    appVersion: string
  ): ChartBundleExportResult {
    const ids = uniqueChartIds(chartIds)
    if (ids.length === 0) {
      throw new Error('CHART_BUNDLE_SELECTION_REQUIRED')
    }
    if (ids.length > MAX_CHARTS) {
      throw new Error('CHART_BUNDLE_TOO_MANY_CHARTS')
    }

    const entries: Array<{ name: string; data: Buffer }> = []
    const charts: BundleChart[] = []
    for (const [index, chartId] of ids.entries()) {
      const chart = this.chartRepository.getChart(chartId)
      if (!chart) {
        throw new Error(`CHART_NOT_FOUND:${chartId}`)
      }

      const sourceData = readRequiredAsset(chart.sourceFilePath, chart.id)
      const sourceFormat = inferFormat(chart.sourceFilePath, chart.fileFormat)
      const chartFolder = `charts/${String(index + 1).padStart(3, '0')}-${hashText(chart.id).slice(0, 12)}`
      const sourcePath = `${chartFolder}/source.${fileExtension(sourceFormat)}`
      entries.push({ name: sourcePath, data: sourceData })
      const sourceAsset = createAssetManifest(sourcePath, sourceFormat, sourceData)

      let previewAsset: BundleAsset | null = null
      const previewPathOnDisk = chart.previewImagePath
      if (
        previewPathOnDisk &&
        resolve(previewPathOnDisk) !== resolve(chart.sourceFilePath)
      ) {
        const previewData = readRequiredAsset(previewPathOnDisk, chart.id)
        const previewFormat = inferFormat(previewPathOnDisk, chart.fileFormat)
        const previewPath = `${chartFolder}/preview.${fileExtension(previewFormat)}`
        entries.push({ name: previewPath, data: previewData })
        previewAsset = createAssetManifest(previewPath, previewFormat, previewData)
      }

      const procedurePool = getProcedurePool(
        chart.airportCode
          ? this.safeGetAirportProcedures(settings, chart.airportCode)
          : emptyProcedures()
      )
      const procedureBindings = chart.boundApproachProcedureIds.map((sourceId) => {
        const procedure = procedurePool.find((candidate) => candidate.id === sourceId)
        return {
          sourceId,
          name: procedure?.name ?? null,
          procedureType: procedure?.procedureType ?? null,
          runwayName: procedure?.runwayName ?? null
        }
      })

      charts.push({
        id: chart.id,
        title: chart.title,
        airportCode: chart.airportCode,
        chartType: chart.chartType,
        titleMode: chart.titleMode,
        width: chart.width,
        height: chart.height,
        createdAt: chart.createdAt,
        updatedAt: chart.updatedAt,
        assets: {
          source: sourceAsset,
          preview: previewAsset
        },
        georeference: {
          points: this.chartRepository.listReferencePoints(chart.id).map((point) => ({
            index: point.index,
            mapLat: point.mapLat,
            mapLon: point.mapLon,
            chartX: point.chartX,
            chartY: point.chartY
          }))
        },
        bindings: {
          runways: [...chart.boundRunwayNames],
          procedures: procedureBindings
        }
      })
    }

    const manifest: BundleManifest = {
      format: BUNDLE_FORMAT,
      schemaVersion: BUNDLE_SCHEMA_VERSION,
      bundleId: randomUUID(),
      exportedAt: Date.now(),
      producer: {
        name: 'NextEFB',
        version: appVersion
      },
      charts
    }
    entries.unshift({
      name: MANIFEST_PATH,
      data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    })

    const archive = createZipArchive(entries)
    if (archive.length > MAX_ARCHIVE_SIZE) {
      throw new Error('CHART_BUNDLE_TOO_LARGE')
    }
    writeFileSync(destinationPath, archive)

    return {
      filePath: destinationPath,
      chartCount: charts.length
    }
  }

  previewImport(filePath: string, _settings: AppSettings): ChartBundleImportPreview {
    this.purgeExpiredSessions()
    if (!existsSync(filePath) || statSync(filePath).size > MAX_ARCHIVE_SIZE) {
      throw new Error('CHART_BUNDLE_TOO_LARGE')
    }

    const entries = readZipArchive(readFileSync(filePath), {
      maxEntries: MAX_ENTRIES,
      maxEntrySize: MAX_ENTRY_SIZE,
      maxTotalSize: MAX_TOTAL_SIZE
    })
    const manifestData = entries.get(MANIFEST_PATH)
    if (!manifestData || manifestData.length > 2 * 1024 * 1024) {
      throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
    }

    let rawManifest: unknown
    try {
      rawManifest = JSON.parse(manifestData.toString('utf8'))
    } catch {
      throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
    }
    const manifest = parseManifest(rawManifest)
    const expectedEntries = new Set<string>([MANIFEST_PATH])
    const loadedCharts: LoadedChart[] = manifest.charts.map((chart) => {
      expectedEntries.add(chart.assets.source.path)
      if (chart.assets.preview) {
        expectedEntries.add(chart.assets.preview.path)
      }

      const sourceData = readAndVerifyAsset(entries, chart.assets.source)
      const previewData = chart.assets.preview
        ? readAndVerifyAsset(entries, chart.assets.preview)
        : null
      const localChart = this.chartRepository.getChart(chart.id)

      return {
        manifest: chart,
        sourceData,
        previewData,
        preview: {
          id: chart.id,
          title: chart.title,
          airportCode: chart.airportCode,
          chartType: chart.chartType,
          action: localChart ? 'update' : 'create',
          localTitle: localChart?.title ?? null,
          incomingUpdatedAt: chart.updatedAt,
          localUpdatedAt: localChart?.updatedAt ?? null,
          isOlderThanLocal: Boolean(localChart && chart.updatedAt < localChart.updatedAt),
          assetSizeBytes: sourceData.length + (previewData?.length ?? 0)
        }
      }
    })

    for (const entryName of entries.keys()) {
      if (!expectedEntries.has(entryName)) {
        throw new Error('CHART_BUNDLE_UNEXPECTED_ENTRY')
      }
    }

    const sessionId = randomUUID()
    const session: ImportSession = {
      id: sessionId,
      createdAt: Date.now(),
      fileName: basename(filePath),
      manifest,
      charts: loadedCharts
    }
    while (this.sessions.size >= MAX_SESSIONS) {
      const oldest = [...this.sessions.values()].sort((left, right) => left.createdAt - right.createdAt)[0]
      if (!oldest) break
      this.sessions.delete(oldest.id)
    }
    this.sessions.set(sessionId, session)

    return {
      sessionId,
      fileName: session.fileName,
      schemaVersion: manifest.schemaVersion,
      exportedAt: manifest.exportedAt,
      charts: loadedCharts.map((chart) => chart.preview),
      totalAssetSizeBytes: loadedCharts.reduce(
        (total, chart) => total + chart.preview.assetSizeBytes,
        0
      )
    }
  }

  importBundle(
    input: ChartBundleImportInput,
    settings: AppSettings
  ): ChartBundleImportResult {
    this.purgeExpiredSessions()
    const session = this.sessions.get(input.sessionId)
    if (!session) {
      throw new Error('CHART_BUNDLE_IMPORT_SESSION_EXPIRED')
    }

    const selectedIds = uniqueChartIds(input.chartIds)
    if (selectedIds.length === 0) {
      throw new Error('CHART_BUNDLE_SELECTION_REQUIRED')
    }
    const chartsById = new Map(session.charts.map((chart) => [chart.manifest.id, chart]))
    const selectedCharts = selectedIds.map((chartId) => {
      const chart = chartsById.get(chartId)
      if (!chart) {
        throw new Error('CHART_BUNDLE_SELECTION_INVALID')
      }
      const navProcedures = chart.manifest.airportCode
        ? this.safeGetAirportProcedures(settings, chart.manifest.airportCode)
        : emptyProcedures()
      return {
        ...chart,
        resolvedBindings: resolveBindings(chart.manifest, navProcedures)
      }
    })

    const storage = this.getStorageSummary()
    const chartsRoot = resolve(storage.chartsRoot)
    mkdirSync(chartsRoot, { recursive: true })
    const operationId = randomUUID()
    const stageRoot = join(chartsRoot, `.bundle-stage-${operationId}`)
    const backupRoot = join(chartsRoot, `.bundle-backup-${operationId}`)
    mkdirSync(stageRoot, { recursive: true })
    mkdirSync(backupRoot, { recursive: true })

    const repositoryEntries: ChartRepositoryImportEntry[] = []
    const existingIds = new Set(
      selectedCharts
        .filter((loaded) => this.chartRepository.getChart(loaded.manifest.id) !== null)
        .map((loaded) => loaded.manifest.id)
    )

    let preserveBackup = false
    try {
      for (const loaded of selectedCharts) {
        const { manifest, resolvedBindings } = loaded
        const stageChartDir = join(stageRoot, manifest.id)
        mkdirSync(stageChartDir, { recursive: true })
        const sourcePath = join(
          chartsRoot,
          manifest.id,
          `source.${fileExtension(manifest.assets.source.format)}`
        )
        writeFileSync(
          join(stageChartDir, basename(sourcePath)),
          loaded.sourceData
        )

        let previewPath = sourcePath
        let displayFormat = manifest.assets.source.format
        if (manifest.assets.preview && loaded.previewData) {
          previewPath = join(
            chartsRoot,
            manifest.id,
            `preview.${fileExtension(manifest.assets.preview.format)}`
          )
          displayFormat = manifest.assets.preview.format
          writeFileSync(
            join(stageChartDir, basename(previewPath)),
            loaded.previewData
          )
        }

        const points: GeoReferencePoint[] = manifest.georeference.points.map((point) => ({
          id: randomUUID(),
          chartId: manifest.id,
          index: point.index,
          mapLat: point.mapLat,
          mapLon: point.mapLon,
          chartX: point.chartX,
          chartY: point.chartY
        }))
        const chart: ChartRecord = {
          id: manifest.id,
          title: manifest.title,
          airportCode: manifest.airportCode,
          chartType: manifest.chartType,
          titleMode: manifest.titleMode,
          boundRunwayNames: resolvedBindings.runwayNames,
          boundApproachProcedureIds: resolvedBindings.procedureIds,
          sourceFilePath: sourcePath,
          previewImagePath: previewPath,
          fileFormat: displayFormat,
          width: manifest.width,
          height: manifest.height,
          isGeoreferenced: points.length === 2,
          createdAt: manifest.createdAt,
          updatedAt: manifest.updatedAt
        }
        repositoryEntries.push({ chart, points })
      }

      const moved: Array<{ target: string; backup: string | null }> = []
      try {
        for (const loaded of selectedCharts) {
          const target = join(chartsRoot, loaded.manifest.id)
          const staged = join(stageRoot, loaded.manifest.id)
          let backup: string | null = null
          if (existsSync(target)) {
            backup = join(backupRoot, loaded.manifest.id)
            renameSync(target, backup)
          }
          moved.push({ target, backup })
          renameSync(staged, target)
        }

        const importedCharts = this.chartRepository.upsertCharts(repositoryEntries)
        this.sessions.delete(session.id)
        safeRemove(backupRoot)
        safeRemove(stageRoot)
        return {
          charts: importedCharts,
          createdCount: importedCharts.filter((chart) => !existingIds.has(chart.id)).length,
          updatedCount: importedCharts.filter((chart) => existingIds.has(chart.id)).length
        }
      } catch (error) {
        let restoreFailed = false
        for (const item of [...moved].reverse()) {
          try {
            safeRemove(item.target)
            if (item.backup && existsSync(item.backup)) {
              renameSync(item.backup, item.target)
            }
          } catch {
            restoreFailed = true
          }
        }
        if (restoreFailed) {
          preserveBackup = true
          throw new Error(`CHART_BUNDLE_ROLLBACK_FAILED:${backupRoot}`, {
            cause: error
          })
        }
        throw error
      }
    } finally {
      safeRemove(stageRoot)
      if (!preserveBackup) {
        safeRemove(backupRoot)
      }
    }
  }

  private safeGetAirportProcedures(
    settings: AppSettings,
    airportCode: string
  ): NavAirportProcedures {
    try {
      return this.navDataService.getAirportProcedures(settings, airportCode)
    } catch {
      return emptyProcedures()
    }
  }

  private purgeExpiredSessions(): void {
    const threshold = Date.now() - SESSION_TTL_MS
    for (const session of this.sessions.values()) {
      if (session.createdAt < threshold) {
        this.sessions.delete(session.id)
      }
    }
  }
}

function parseManifest(value: unknown): BundleManifest {
  const manifest = asRecord(value, 'CHART_BUNDLE_MANIFEST_INVALID')
  if (manifest.format !== BUNDLE_FORMAT) {
    throw new Error('CHART_BUNDLE_FORMAT_UNSUPPORTED')
  }
  if (manifest.schemaVersion !== BUNDLE_SCHEMA_VERSION) {
    throw new Error('CHART_BUNDLE_VERSION_UNSUPPORTED')
  }

  const rawCharts = asArray(manifest.charts)
  if (rawCharts.length === 0 || rawCharts.length > MAX_CHARTS) {
    throw new Error('CHART_BUNDLE_CHART_COUNT_INVALID')
  }
  const ids = new Set<string>()
  const charts = rawCharts.map((rawChart) => {
    const chart = parseChart(rawChart)
    if (ids.has(chart.id)) {
      throw new Error('CHART_BUNDLE_DUPLICATE_CHART_ID')
    }
    ids.add(chart.id)
    return chart
  })
  const producer = asRecord(manifest.producer, 'CHART_BUNDLE_MANIFEST_INVALID')
  if (producer.name !== 'NextEFB') {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }

  return {
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    bundleId: requiredString(manifest.bundleId),
    exportedAt: finiteNonNegativeNumber(manifest.exportedAt),
    producer: {
      name: 'NextEFB',
      version: requiredString(producer.version)
    },
    charts
  }
}

function parseChart(value: unknown): BundleChart {
  const chart = asRecord(value, 'CHART_BUNDLE_MANIFEST_INVALID')
  const id = requiredString(chart.id)
  if (!VALID_CHART_ID.test(id) || id === '.' || id === '..') {
    throw new Error('CHART_BUNDLE_CHART_ID_INVALID')
  }
  const assets = asRecord(chart.assets, 'CHART_BUNDLE_MANIFEST_INVALID')
  const georeference = asRecord(chart.georeference, 'CHART_BUNDLE_MANIFEST_INVALID')
  const bindings = asRecord(chart.bindings, 'CHART_BUNDLE_MANIFEST_INVALID')
  const points = asArray(georeference.points).map(parseGeoPoint)
  if (
    points.length > 2 ||
    new Set(points.map((point) => point.index)).size !== points.length
  ) {
    throw new Error('CHART_BUNDLE_GEOREFERENCE_INVALID')
  }

  return {
    id,
    title: requiredString(chart.title),
    airportCode: optionalString(chart.airportCode)?.toUpperCase() ?? null,
    chartType: parseChartType(chart.chartType),
    titleMode: parseTitleMode(chart.titleMode),
    width: optionalDimension(chart.width),
    height: optionalDimension(chart.height),
    createdAt: finiteNonNegativeNumber(chart.createdAt),
    updatedAt: finiteNonNegativeNumber(chart.updatedAt),
    assets: {
      source: parseAsset(assets.source),
      preview: assets.preview == null ? null : parseAsset(assets.preview)
    },
    georeference: { points },
    bindings: {
      runways: uniqueStrings(asArray(bindings.runways).map(requiredString)),
      procedures: asArray(bindings.procedures).map(parseProcedureBinding)
    }
  }
}

function parseAsset(value: unknown): BundleAsset {
  const asset = asRecord(value, 'CHART_BUNDLE_MANIFEST_INVALID')
  const path = requiredString(asset.path)
  if (path === MANIFEST_PATH) {
    throw new Error('CHART_BUNDLE_ASSET_PATH_INVALID')
  }
  const sha256 = requiredString(asset.sha256).toLowerCase()
  if (!VALID_HASH.test(sha256)) {
    throw new Error('CHART_BUNDLE_ASSET_HASH_INVALID')
  }
  return {
    path,
    format: parseFileFormat(asset.format),
    size: finiteNonNegativeInteger(asset.size),
    sha256
  }
}

function parseProcedureBinding(value: unknown): BundleProcedureBinding {
  const binding = asRecord(value, 'CHART_BUNDLE_MANIFEST_INVALID')
  const procedureType = binding.procedureType
  if (
    procedureType !== null &&
    procedureType !== 'departure' &&
    procedureType !== 'arrival' &&
    procedureType !== 'approach'
  ) {
    throw new Error('CHART_BUNDLE_BINDING_INVALID')
  }
  return {
    sourceId: requiredString(binding.sourceId),
    name: optionalString(binding.name),
    procedureType,
    runwayName: optionalString(binding.runwayName)
  }
}

function parseGeoPoint(value: unknown): BundleGeoPoint {
  const point = asRecord(value, 'CHART_BUNDLE_GEOREFERENCE_INVALID')
  if (point.index !== 1 && point.index !== 2) {
    throw new Error('CHART_BUNDLE_GEOREFERENCE_INVALID')
  }
  const result: BundleGeoPoint = {
    index: point.index,
    mapLat: finiteNumber(point.mapLat),
    mapLon: finiteNumber(point.mapLon),
    chartX: finiteNumber(point.chartX),
    chartY: finiteNumber(point.chartY)
  }
  if (
    result.mapLat < -90 ||
    result.mapLat > 90 ||
    result.mapLon < -180 ||
    result.mapLon > 180 ||
    result.chartX < 0 ||
    result.chartY < 0
  ) {
    throw new Error('CHART_BUNDLE_GEOREFERENCE_INVALID')
  }
  return result
}

function readAndVerifyAsset(
  entries: Map<string, Buffer>,
  asset: BundleAsset
): Buffer {
  const data = entries.get(asset.path)
  if (!data || data.length !== asset.size || hashBuffer(data) !== asset.sha256) {
    throw new Error('CHART_BUNDLE_ASSET_INTEGRITY_FAILED')
  }
  verifyAssetSignature(data, asset.format)
  return data
}

function resolveBindings(
  chart: BundleChart,
  navProcedures: NavAirportProcedures
): ResolvedBindings {
  const runwayNames: string[] = []

  for (const requested of chart.bindings.runways) {
    const candidates = navProcedures.runways.filter(
      (runway) => normalizeRunway(runway.name) === normalizeRunway(requested)
    )
    runwayNames.push(candidates.length === 1 ? candidates[0]!.name : requested)
  }

  const procedurePool = getProcedurePool(navProcedures)
  const procedureIds: string[] = []
  for (const requested of chart.bindings.procedures) {
    if (!requested.name || !requested.procedureType) {
      procedureIds.push(requested.sourceId)
      continue
    }

    const candidates = procedurePool.filter(
      (procedure) =>
        procedure.procedureType === requested.procedureType &&
        normalizeProcedureName(procedure.name) === normalizeProcedureName(requested.name!) &&
        normalizeOptionalRunway(procedure.runwayName) ===
          normalizeOptionalRunway(requested.runwayName)
    )
    procedureIds.push(candidates.length === 1 ? candidates[0]!.id : requested.sourceId)
  }

  return {
    runwayNames: uniqueStrings(runwayNames),
    procedureIds: uniqueStrings(procedureIds)
  }
}

function getProcedurePool(procedures: NavAirportProcedures): NavProcedureOption[] {
  return [
    ...procedures.departures,
    ...procedures.arrivals,
    ...procedures.approaches
  ]
}

function emptyProcedures(): NavAirportProcedures {
  return {
    airport: null,
    runways: [],
    departures: [],
    arrivals: [],
    transitions: [],
    approaches: []
  }
}

function readRequiredAsset(filePath: string, chartId: string): Buffer {
  if (!existsSync(filePath)) {
    throw new Error(`CHART_ASSET_MISSING:${chartId}`)
  }
  const data = readFileSync(filePath)
  if (data.length > MAX_ENTRY_SIZE) {
    throw new Error('CHART_BUNDLE_ENTRY_TOO_LARGE')
  }
  return data
}

function createAssetManifest(
  path: string,
  format: ChartFileFormat,
  data: Buffer
): BundleAsset {
  return {
    path,
    format,
    size: data.length,
    sha256: hashBuffer(data)
  }
}

function inferFormat(filePath: string, fallback: ChartFileFormat): ChartFileFormat {
  switch (extname(filePath).toLowerCase()) {
    case '.pdf':
      return 'pdf'
    case '.png':
      return 'png'
    case '.jpg':
      return 'jpg'
    case '.jpeg':
      return 'jpeg'
    default:
      return fallback
  }
}

function fileExtension(format: ChartFileFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}

function hashBuffer(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function normalizeRunway(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/^RWY/, '')
    .replace(/[^0-9A-Z]/g, '')
  const match = normalized.match(/^0*(\d{1,2})([LRC]?)$/)
  return match ? `${Number(match[1])}${match[2]}` : normalized
}

function normalizeOptionalRunway(value: string | null): string {
  return value ? normalizeRunway(value) : ''
}

function normalizeProcedureName(value: string): string {
  return value.trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
}

function uniqueChartIds(values: string[]): string[] {
  return uniqueStrings(
    values.map((value) => value.trim()).filter((value) => VALID_CHART_ID.test(value))
  )
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function safeRemove(path: string): void {
  try {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true })
    }
  } catch {
    // Cleanup is best-effort; imported data has already been committed or restored.
  }
}

function verifyAssetSignature(data: Buffer, format: ChartFileFormat): void {
  const isPdf =
    data.length >= 5 && data.subarray(0, 5).toString('ascii') === '%PDF-'
  const isPng =
    data.length >= 8 &&
    data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  const isJpeg =
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  if (
    (format === 'pdf' && !isPdf) ||
    (format === 'png' && !isPng) ||
    ((format === 'jpg' || format === 'jpeg') && !isJpeg)
  ) {
    throw new Error('CHART_BUNDLE_ASSET_TYPE_INVALID')
  }
}

function asRecord(value: unknown, errorCode: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode)
  }
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return value
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return value.trim()
}

function optionalString(value: unknown): string | null {
  if (value == null) return null
  return requiredString(value)
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return value
}

function finiteNonNegativeNumber(value: unknown): number {
  const result = finiteNumber(value)
  if (result < 0) {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return result
}

function finiteNonNegativeInteger(value: unknown): number {
  const result = finiteNonNegativeNumber(value)
  if (!Number.isSafeInteger(result)) {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return result
}

function optionalDimension(value: unknown): number | null {
  if (value == null) return null
  return finiteNonNegativeInteger(value)
}

function parseChartType(value: unknown): ChartType {
  if (
    value !== 'airport' &&
    value !== 'sid' &&
    value !== 'star' &&
    value !== 'approach' &&
    value !== 'general'
  ) {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return value
}

function parseTitleMode(value: unknown): ChartTitleMode {
  if (value !== 'manual' && value !== 'approach-procedure') {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return value
}

function parseFileFormat(value: unknown): ChartFileFormat {
  if (value !== 'pdf' && value !== 'png' && value !== 'jpg' && value !== 'jpeg') {
    throw new Error('CHART_BUNDLE_MANIFEST_INVALID')
  }
  return value
}
