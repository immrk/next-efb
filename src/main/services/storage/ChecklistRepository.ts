import Database from 'better-sqlite3'
import type { ChecklistRecord, ChecklistUpdateInput } from '@shared/checklist-types'

type ChecklistRow = {
  id: string
  title: string
  aircraft_model: string
  source_file_path: string
  file_format: ChecklistRecord['fileFormat']
  created_at: number
  updated_at: number
}

export class ChecklistRepository {
  private readonly db: Database.Database

  constructor(databasePath: string) {
    this.db = new Database(databasePath)
    this.db.pragma('journal_mode = WAL')
    this.init()
  }

  listChecklists(): ChecklistRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM checklists ORDER BY aircraft_model ASC, title ASC, updated_at DESC')
      .all() as ChecklistRow[]

    return rows.map((row) => this.toChecklistRecord(row))
  }

  getChecklist(id: string): ChecklistRecord | null {
    const row = this.db
      .prepare('SELECT * FROM checklists WHERE id = ?')
      .get(id) as ChecklistRow | undefined
    return row ? this.toChecklistRecord(row) : null
  }

  createChecklist(checklist: ChecklistRecord): ChecklistRecord {
    this.db
      .prepare(
        `
        INSERT INTO checklists (
          id, title, aircraft_model, source_file_path, file_format, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        checklist.id,
        checklist.title,
        checklist.aircraftModel,
        checklist.sourceFilePath,
        checklist.fileFormat,
        checklist.createdAt,
        checklist.updatedAt
      )

    return checklist
  }

  updateChecklist(input: ChecklistUpdateInput): ChecklistRecord | null {
    this.db
      .prepare(
        `
        UPDATE checklists
        SET title = ?, aircraft_model = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(input.title, input.aircraftModel, Date.now(), input.id)

    return this.getChecklist(input.id)
  }

  deleteChecklist(checklistId: string): void {
    this.db.prepare('DELETE FROM checklists WHERE id = ?').run(checklistId)
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS checklists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        aircraft_model TEXT NOT NULL,
        source_file_path TEXT NOT NULL,
        file_format TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_checklists_aircraft_model
      ON checklists (aircraft_model, title);
    `)
  }

  private toChecklistRecord(row: ChecklistRow): ChecklistRecord {
    return {
      id: row.id,
      title: row.title,
      aircraftModel: row.aircraft_model,
      sourceFilePath: row.source_file_path,
      fileFormat: row.file_format,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
