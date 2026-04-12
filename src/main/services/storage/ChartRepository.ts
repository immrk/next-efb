import Database from 'better-sqlite3'
import type {
  ChartRecord,
  ChartUpdateInput,
  GeoReferencePoint,
  StorageSummary
} from '@shared/chart-types'

type ChartRow = {
  id: string
  title: string
  airport_code: string | null
  chart_type: ChartRecord['chartType']
  title_mode: ChartRecord['titleMode']
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
          id, title, airport_code, chart_type, title_mode, bound_approach_procedure_id, bound_approach_procedure_ids, source_file_path, preview_image_path,
          file_format, width, height, is_georeferenced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        chart.id,
        chart.title,
        chart.airportCode,
        chart.chartType,
        chart.titleMode,
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

  updateChart(input: ChartUpdateInput): ChartRecord | null {
    const now = Date.now()
    this.db
      .prepare(
        `
        UPDATE charts
        SET title = ?, airport_code = ?, chart_type = ?, title_mode = ?, bound_approach_procedure_id = ?, bound_approach_procedure_ids = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        input.title,
        input.airportCode,
        input.chartType,
        input.titleMode,
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

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS charts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        airport_code TEXT,
        chart_type TEXT NOT NULL,
        title_mode TEXT NOT NULL DEFAULT 'manual',
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
