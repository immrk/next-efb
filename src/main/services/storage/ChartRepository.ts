import Database from 'better-sqlite3'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type {
  ChartRecord,
  ChartUpdateInput,
  GeoReferencePoint,
  StorageSummary
} from '@shared/chart-types'

export interface ChartRepositoryImportEntry {
  chart: ChartRecord
  points: GeoReferencePoint[]
}

type ChartRow = {
  id: string
  title: string
  airport_code: string | null
  chart_type: ChartRecord['chartType']
  title_mode: ChartRecord['titleMode']
  bound_runway_names: string | null
  bound_approach_procedure_id: string | null
  bound_approach_procedure_ids: string | null
  source_file_path: string
  preview_image_path: string | null
  file_format: ChartRecord['fileFormat']
  width: number | null
  height: number | null
  is_georeferenced: number
  created_at: number
  updated_at: number
}

type PointRow = {
  id: string
  chart_id: string
  point_index: 1 | 2
  map_lat: number
  map_lon: number
  chart_x: number
  chart_y: number
}

export class ChartRepository {
  private readonly db: Database.Database

  constructor(storage: StorageSummary) {
    this.db = new Database(storage.databasePath)
    this.db.pragma('journal_mode = WAL')
    this.init()
    if (normalizePath(resolve(storage.legacyChartsRoot)) !== normalizePath(resolve(storage.chartsRoot))) {
      this.relocateChartAssetPaths(storage.legacyChartsRoot, storage.chartsRoot)
    }
  }

  listCharts(): ChartRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM charts ORDER BY updated_at DESC')
      .all() as ChartRow[]

    return rows.map((row) => this.toChartRecord(row))
  }

  getChart(id: string): ChartRecord | null {
    const row = this.db.prepare('SELECT * FROM charts WHERE id = ?').get(id) as ChartRow | undefined
    return row ? this.toChartRecord(row) : null
  }

  createChart(chart: ChartRecord): ChartRecord {
    this.db
      .prepare(
        `
        INSERT INTO charts (
          id, title, airport_code, chart_type, title_mode, bound_runway_names, bound_approach_procedure_id, bound_approach_procedure_ids, source_file_path, preview_image_path,
          file_format, width, height, is_georeferenced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        chart.id,
        chart.title,
        chart.airportCode,
        chart.chartType,
        chart.titleMode,
        JSON.stringify(chart.boundRunwayNames),
        chart.boundApproachProcedureIds[0] ?? null,
        JSON.stringify(chart.boundApproachProcedureIds),
        chart.sourceFilePath,
        chart.previewImagePath,
        chart.fileFormat,
        chart.width,
        chart.height,
        chart.isGeoreferenced ? 1 : 0,
        chart.createdAt,
        chart.updatedAt
      )

    return chart
  }

  upsertCharts(entries: ChartRepositoryImportEntry[]): ChartRecord[] {
    const upsertChart = this.db.prepare(
      `
      INSERT INTO charts (
        id, title, airport_code, chart_type, title_mode, bound_runway_names,
        bound_approach_procedure_id, bound_approach_procedure_ids, source_file_path,
        preview_image_path, file_format, width, height, is_georeferenced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        airport_code = excluded.airport_code,
        chart_type = excluded.chart_type,
        title_mode = excluded.title_mode,
        bound_runway_names = excluded.bound_runway_names,
        bound_approach_procedure_id = excluded.bound_approach_procedure_id,
        bound_approach_procedure_ids = excluded.bound_approach_procedure_ids,
        source_file_path = excluded.source_file_path,
        preview_image_path = excluded.preview_image_path,
        file_format = excluded.file_format,
        width = excluded.width,
        height = excluded.height,
        is_georeferenced = excluded.is_georeferenced,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
      `
    )
    const deletePoints = this.db.prepare(
      'DELETE FROM chart_reference_points WHERE chart_id = ?'
    )
    const insertPoint = this.db.prepare(
      `
      INSERT INTO chart_reference_points (
        id, chart_id, point_index, map_lat, map_lon, chart_x, chart_y, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    const trx = this.db.transaction((nextEntries: ChartRepositoryImportEntry[]) => {
      for (const { chart, points } of nextEntries) {
        upsertChart.run(
          chart.id,
          chart.title,
          chart.airportCode,
          chart.chartType,
          chart.titleMode,
          JSON.stringify(chart.boundRunwayNames),
          chart.boundApproachProcedureIds[0] ?? null,
          JSON.stringify(chart.boundApproachProcedureIds),
          chart.sourceFilePath,
          chart.previewImagePath,
          chart.fileFormat,
          chart.width,
          chart.height,
          chart.isGeoreferenced ? 1 : 0,
          chart.createdAt,
          chart.updatedAt
        )

        deletePoints.run(chart.id)
        for (const point of points) {
          insertPoint.run(
            point.id,
            chart.id,
            point.index,
            point.mapLat,
            point.mapLon,
            point.chartX,
            point.chartY,
            Date.now()
          )
        }
      }
    })

    trx(entries)
    return entries
      .map(({ chart }) => this.getChart(chart.id))
      .filter((chart): chart is ChartRecord => chart !== null)
  }

  updateChart(input: ChartUpdateInput): ChartRecord | null {
    const now = Date.now()
    this.db
      .prepare(
        `
        UPDATE charts
        SET title = ?, airport_code = ?, chart_type = ?, title_mode = ?, bound_runway_names = ?, bound_approach_procedure_id = ?, bound_approach_procedure_ids = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        input.title,
        input.airportCode,
        input.chartType,
        input.titleMode,
        JSON.stringify(input.boundRunwayNames),
        input.boundApproachProcedureIds[0] ?? null,
        JSON.stringify(input.boundApproachProcedureIds),
        now,
        input.id
      )

    return this.getChart(input.id)
  }

  deleteChart(chartId: string): void {
    const trx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM chart_reference_points WHERE chart_id = ?').run(chartId)
      this.db.prepare('DELETE FROM charts WHERE id = ?').run(chartId)
    })

    trx()
  }

  listReferencePoints(chartId: string): GeoReferencePoint[] {
    const rows = this.db
      .prepare(
        `
        SELECT id, chart_id, point_index, map_lat, map_lon, chart_x, chart_y
        FROM chart_reference_points
        WHERE chart_id = ?
        ORDER BY point_index ASC
      `
      )
      .all(chartId) as PointRow[]

    return rows.map((row) => ({
      id: row.id,
      chartId: row.chart_id,
      index: row.point_index,
      mapLat: row.map_lat,
      mapLon: row.map_lon,
      chartX: row.chart_x,
      chartY: row.chart_y
    }))
  }

  saveReferencePoints(chartId: string, points: GeoReferencePoint[]): GeoReferencePoint[] {
    const trx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM chart_reference_points WHERE chart_id = ?').run(chartId)

      const insertPoint = this.db.prepare(
        `
        INSERT INTO chart_reference_points (
          id, chart_id, point_index, map_lat, map_lon, chart_x, chart_y, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )

      for (const point of points) {
        insertPoint.run(
          point.id,
          chartId,
          point.index,
          point.mapLat,
          point.mapLon,
          point.chartX,
          point.chartY,
          Date.now()
        )
      }

      this.db
        .prepare(
          `
          UPDATE charts
          SET is_georeferenced = ?, updated_at = ?
          WHERE id = ?
        `
        )
        .run(points.length === 2 ? 1 : 0, Date.now(), chartId)
    })

    trx()
    return this.listReferencePoints(chartId)
  }

  relocateChartAssetPaths(previousChartsRoot: string, nextChartsRoot: string): void {
    const rows = this.db
      .prepare('SELECT id, source_file_path, preview_image_path FROM charts')
      .all() as Array<{ id: string; source_file_path: string; preview_image_path: string | null }>

    const updateChartPaths = this.db.prepare(
      `
        UPDATE charts
        SET source_file_path = ?, preview_image_path = ?, updated_at = ?
        WHERE id = ?
      `
    )

    const trx = this.db.transaction(() => {
      rows.forEach((row) => {
        const nextSourcePath = relocatePath(row.source_file_path, previousChartsRoot, nextChartsRoot)
        const nextPreviewPath = relocatePath(row.preview_image_path, previousChartsRoot, nextChartsRoot)

        if (nextSourcePath === row.source_file_path && nextPreviewPath === row.preview_image_path) {
          return
        }

        updateChartPaths.run(nextSourcePath, nextPreviewPath, Date.now(), row.id)
      })
    })

    trx()
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS charts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        airport_code TEXT,
        chart_type TEXT NOT NULL,
        title_mode TEXT NOT NULL DEFAULT 'manual',
        bound_runway_names TEXT,
        bound_approach_procedure_id TEXT,
        bound_approach_procedure_ids TEXT,
        source_file_path TEXT NOT NULL,
        preview_image_path TEXT,
        file_format TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        is_georeferenced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chart_reference_points (
        id TEXT PRIMARY KEY,
        chart_id TEXT NOT NULL,
        point_index INTEGER NOT NULL,
        map_lat REAL NOT NULL,
        map_lon REAL NOT NULL,
        chart_x REAL NOT NULL,
        chart_y REAL NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)

    this.migrateChartsTable()
  }

  private migrateChartsTable(): void {
    const columns = new Set<string>(
      (this.db.prepare('PRAGMA table_info(charts)').all() as Array<{ name: string }>).map((row) => row.name)
    )

    if (!columns.has('title_mode')) {
      this.db.prepare(`ALTER TABLE charts ADD COLUMN title_mode TEXT NOT NULL DEFAULT 'manual'`).run()
    }

    if (!columns.has('bound_approach_procedure_id')) {
      this.db.prepare(`ALTER TABLE charts ADD COLUMN bound_approach_procedure_id TEXT`).run()
    }

    if (!columns.has('bound_runway_names')) {
      this.db.prepare(`ALTER TABLE charts ADD COLUMN bound_runway_names TEXT`).run()
      this.db.prepare(`UPDATE charts SET bound_runway_names = '[]' WHERE bound_runway_names IS NULL`).run()
    }

    if (!columns.has('bound_approach_procedure_ids')) {
      this.db.prepare(`ALTER TABLE charts ADD COLUMN bound_approach_procedure_ids TEXT`).run()
      this.db.prepare(`
        UPDATE charts
        SET bound_approach_procedure_ids =
          CASE
            WHEN bound_approach_procedure_id IS NULL OR TRIM(bound_approach_procedure_id) = '' THEN '[]'
            ELSE json_array(bound_approach_procedure_id)
          END
      `).run()
    }
  }

  private toChartRecord(row: ChartRow): ChartRecord {
    return {
      id: row.id,
      title: row.title,
      airportCode: row.airport_code,
      chartType: row.chart_type,
      titleMode: row.title_mode ?? 'manual',
      boundRunwayNames: parseStringArray(row.bound_runway_names),
      boundApproachProcedureIds: parseProcedureIds(
        row.bound_approach_procedure_ids,
        row.bound_approach_procedure_id
      ),
      sourceFilePath: row.source_file_path,
      previewImagePath: row.preview_image_path,
      fileFormat: row.file_format,
      width: row.width,
      height: row.height,
      isGeoreferenced: row.is_georeferenced === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

function relocatePath(
  filePath: string | null,
  previousChartsRoot: string,
  nextChartsRoot: string
): string | null {
  if (!filePath || !isAbsolute(filePath) || !isPathInsideRoot(filePath, previousChartsRoot)) {
    return filePath
  }

  return join(resolve(nextChartsRoot), relative(resolve(previousChartsRoot), resolve(filePath)))
}

function parseProcedureIds(value: string | null, legacyValue: string | null): string[] {
  if (value) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      }
    } catch {
      return legacyValue ? [legacyValue] : []
    }
  }

  return legacyValue ? [legacyValue] : []
}

function parseStringArray(value: string | null): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    }
  } catch {
    return []
  }

  return []
}

function isPathInsideRoot(targetPath: string, rootPath: string): boolean {
  const normalizedTarget = normalizePath(resolve(targetPath))
  const normalizedRoot = `${normalizePath(resolve(rootPath))}${sep}`
  return normalizedTarget === normalizePath(resolve(rootPath)) || normalizedTarget.startsWith(normalizedRoot)
}

function normalizePath(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value
}
