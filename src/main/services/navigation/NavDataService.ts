import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AppSettings } from '@shared/types'
import type {
  BuildFlightPlanInput,
  BuildFlightPlanResult,
  FlightPlanPoint,
  NavAirportOption,
  NavAirportProcedures,
  NavDataStatus,
  NavProcedureOption,
  NavRunwayOption,
  SimBriefImportInput,
  SimBriefImportResult
} from '@shared/flight-plan-types'

type AirportRow = {
  airport_id: number
  ident: string
  name: string | null
  city: string | null
  country: string | null
  laty: number
  lonx: number
}

type RunwayRow = {
  runway_name: string
  length: number | null
  width: number | null
  surface: string | null
  heading: number | null
}

type StartProcedureRow = {
  start_id: number
  runway_name: string | null
}

type ApproachProcedureRow = {
  approach_id: number
  runway_name: string | null
  type: string
  arinc_name: string | null
}

type FixRow = {
  ident: string
  laty: number
  lonx: number
  source: 'waypoint' | 'vor' | 'ndb'
}

type ApproachLegRow = {
  fix_ident: string | null
  fix_laty: number | null
  fix_lonx: number | null
}

export class NavDataService {
  getDefaultDbPath(): string {
    return join(
      homedir(),
      'AppData',
      'Roaming',
      'ABarthel',
      'little_navmap_db',
      'little_navmap_navigraph.sqlite'
    )
  }

  getStatus(settings: AppSettings): NavDataStatus {
    const defaultPath = this.getDefaultDbPath()
    const configuredPath = normalizeNullablePath(settings.navData.sqlitePath)
    const manualExists = configuredPath ? existsSync(configuredPath) : false
    const autoExists = existsSync(defaultPath)

    if (configuredPath && manualExists) {
      return {
        defaultPath,
        configuredPath,
        activePath: configuredPath,
        exists: true,
        source: 'manual',
        message: 'Using manual Little Navmap SQLite path.'
      }
    }

    if (settings.navData.autoDetect !== false && autoExists) {
      return {
        defaultPath,
        configuredPath,
        activePath: defaultPath,
        exists: true,
        source: 'auto',
        message: 'Detected Little Navmap SQLite path automatically.'
      }
    }

    return {
      defaultPath,
      configuredPath,
      activePath: null,
      exists: false,
      source: 'none',
      message: 'Little Navmap SQLite file was not found.'
    }
  }

  searchAirports(settings: AppSettings, query: string, limit = 20): NavAirportOption[] {
    const db = this.openDatabase(settings)
    if (!db) return []

    const term = query.trim().toUpperCase()
    if (!term) return []

    const rows = db
      .prepare(
        `
        SELECT ident, name, city, country, laty, lonx
        FROM airport
        WHERE ident LIKE @prefix OR name LIKE @wild
        ORDER BY CASE WHEN ident = @exact THEN 0 ELSE 1 END, ident
        LIMIT @limit
        `
      )
      .all({
        prefix: `${term}%`,
        wild: `%${term}%`,
        exact: term,
        limit: Math.max(1, Math.min(100, limit))
      }) as Array<Omit<AirportRow, 'airport_id'>>

    db.close()
    return rows.map((row) => ({
      ident: row.ident,
      name: row.name ?? row.ident,
      city: row.city,
      country: row.country,
      lat: row.laty,
      lon: row.lonx
    }))
  }

  getAirportProcedures(settings: AppSettings, airportIdent: string): NavAirportProcedures {
    const db = this.openDatabase(settings)
    if (!db) {
      return emptyProcedures()
    }

    const ident = airportIdent.trim().toUpperCase()
    if (!ident) {
      db.close()
      return emptyProcedures()
    }

    const airport = db
      .prepare(
        'SELECT airport_id, ident, name, city, country, laty, lonx FROM airport WHERE ident = ? LIMIT 1'
      )
      .get(ident) as AirportRow | undefined

    if (!airport) {
      db.close()
      return emptyProcedures()
    }

    const runways = db
      .prepare(
        `
        SELECT runway_name, MAX(length) AS length, MAX(width) AS width, MAX(surface) AS surface, MAX(heading) AS heading
        FROM (
          SELECT runway_id, airport_id, surface, length, width, heading,
            CASE
              WHEN primary_name IS NOT NULL AND secondary_name IS NOT NULL THEN primary_name || '/' || secondary_name
              WHEN primary_name IS NOT NULL THEN primary_name
              WHEN secondary_name IS NOT NULL THEN secondary_name
              ELSE printf('RWY-%d', runway_id)
            END AS runway_name
          FROM (
            SELECT r.runway_id, r.airport_id, r.surface, r.length, r.width, r.heading,
              (SELECT name FROM runway_end re WHERE re.runway_end_id = r.primary_end_id) AS primary_name,
              (SELECT name FROM runway_end re WHERE re.runway_end_id = r.secondary_end_id) AS secondary_name
            FROM runway r
            WHERE r.airport_id = @airportId
          )
        )
        GROUP BY runway_name
        ORDER BY length DESC, runway_name
        `
      )
      .all({ airportId: airport.airport_id }) as RunwayRow[]

    const departures = db
      .prepare(
        `
        SELECT start_id, runway_name
        FROM start
        WHERE airport_id = ?
        ORDER BY runway_name
        `
      )
      .all(airport.airport_id) as StartProcedureRow[]

    const approaches = db
      .prepare(
        `
        SELECT approach_id, runway_name, type, arinc_name
        FROM approach
        WHERE airport_ident = ?
        ORDER BY runway_name, type, arinc_name
        `
      )
      .all(ident) as ApproachProcedureRow[]

    db.close()

    const runwayOptions: NavRunwayOption[] = runways.map((row) => ({
      name: row.runway_name,
      lengthM: asFiniteOrNull(row.length),
      widthM: asFiniteOrNull(row.width),
      surface: row.surface,
      headingDeg: asFiniteOrNull(row.heading)
    }))

    const depOptions: NavProcedureOption[] = departures.map((row) => ({
      id: `start:${row.start_id}`,
      name: row.runway_name ? `RWY ${row.runway_name} Departure` : `Departure ${row.start_id}`,
      procedureType: 'departure',
      runwayName: row.runway_name
    }))

    const apprOptions: NavProcedureOption[] = approaches.map((row) => ({
      id: `approach:${row.approach_id}`,
      name: [row.type, row.runway_name ? `RWY ${row.runway_name}` : null, row.arinc_name]
        .filter(Boolean)
        .join(' '),
      procedureType: 'approach',
      runwayName: row.runway_name
    }))

    return {
      airport: {
        ident: airport.ident,
        name: airport.name ?? airport.ident,
        city: airport.city,
        country: airport.country,
        lat: airport.laty,
        lon: airport.lonx
      },
      runways: runwayOptions,
      departures: depOptions,
      arrivals: [],
      approaches: apprOptions
    }
  }

  buildFlightPlan(settings: AppSettings, input: BuildFlightPlanInput): BuildFlightPlanResult {
    const db = this.openDatabase(settings)
    if (!db) {
      return {
        points: [],
        unresolvedTokens: [],
        summary: 'Navigation database is not available.'
      }
    }

    const departureIdent = input.departureAirport.trim().toUpperCase()
    const destinationIdent = input.destinationAirport.trim().toUpperCase()
    const unresolvedTokens: string[] = []
    const points: FlightPlanPoint[] = []

    const departure = this.getAirportByIdent(db, departureIdent)
    const destination = this.getAirportByIdent(db, destinationIdent)

    if (departure) {
      points.push({
        ident: departure.ident,
        lat: departure.laty,
        lon: departure.lonx,
        source: 'airport'
      })
    }

    const departureProcedure = this.resolveStartProcedurePoint(db, input.departureProcedureId)
    if (departureProcedure) {
      points.push(departureProcedure)
    }

    const tokens = normalizeRouteTokens(input.enrouteText)
    for (const token of tokens) {
      if (token === departureIdent || token === destinationIdent) {
        continue
      }

      const fix = this.resolveFix(db, token)
      if (fix) {
        points.push({
          ident: fix.ident,
          lat: fix.laty,
          lon: fix.lonx,
          source: fix.source
        })
      } else {
        unresolvedTokens.push(token)
      }
    }

    const approachLegs = this.resolveApproachLegPoints(db, input.approachProcedureId)
    points.push(...approachLegs)

    if (destination) {
      points.push({
        ident: destination.ident,
        lat: destination.laty,
        lon: destination.lonx,
        source: 'airport'
      })
    }

    db.close()

    const uniquePoints = dedupeConsecutivePoints(points)
    return {
      points: uniquePoints,
      unresolvedTokens,
      summary: `${departureIdent || '----'} -> ${destinationIdent || '----'} | ${uniquePoints.length} points`
    }
  }

  async importFromSimBrief(input: SimBriefImportInput): Promise<SimBriefImportResult> {
    const username = input.username?.trim() ?? ''
    const userId = input.userId?.trim() ?? ''
    if (!username && !userId) {
      throw new Error('SIMBRIEF_ID_REQUIRED')
    }

    const query = new URLSearchParams()
    query.set('json', '1')
    if (username) query.set('username', username)
    if (userId) query.set('userid', userId)

    const url = `https://www.simbrief.com/api/xml.fetcher.php?${query.toString()}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`SIMBRIEF_HTTP_${response.status}`)
    }

    const payload = (await response.json()) as Record<string, unknown>
    const departureAirport = readStringPath(payload, ['origin', 'icao_code']) ?? readStringPath(payload, ['params', 'orig'])
    const destinationAirport =
      readStringPath(payload, ['destination', 'icao_code']) ?? readStringPath(payload, ['params', 'dest'])
    const alternateAirport = readStringPath(payload, ['alternate', 'icao_code']) ?? null
    const routeText =
      readStringPath(payload, ['general', 'route']) ??
      readStringPath(payload, ['navlog', 'route']) ??
      readStringPath(payload, ['params', 'route']) ??
      ''

    if (!departureAirport || !destinationAirport) {
      throw new Error('SIMBRIEF_PARSE_FAILED')
    }

    return {
      departureAirport: departureAirport.trim().toUpperCase(),
      destinationAirport: destinationAirport.trim().toUpperCase(),
      alternateAirport: alternateAirport ? alternateAirport.trim().toUpperCase() : null,
      routeText: routeText.trim(),
      source: 'simbrief'
    }
  }

  private openDatabase(settings: AppSettings): Database.Database | null {
    const status = this.getStatus(settings)
    if (!status.activePath || !existsSync(status.activePath)) {
      return null
    }

    return new Database(status.activePath, {
      readonly: true,
      fileMustExist: true
    })
  }

  private getAirportByIdent(db: Database.Database, ident: string): AirportRow | null {
    if (!ident) return null
    return (
      (db
        .prepare(
          'SELECT airport_id, ident, name, city, country, laty, lonx FROM airport WHERE ident = ? LIMIT 1'
        )
        .get(ident) as AirportRow | undefined) ?? null
    )
  }

  private resolveFix(db: Database.Database, token: string): FixRow | null {
    const ident = token.trim().toUpperCase()
    if (!ident) return null

    const waypoint = db
      .prepare(
        `
        SELECT ident, laty, lonx, 'waypoint' AS source
        FROM waypoint
        WHERE ident = ?
        ORDER BY CASE WHEN airport_ident IS NULL OR airport_ident = '' THEN 0 ELSE 1 END, waypoint_id
        LIMIT 1
        `
      )
      .get(ident) as FixRow | undefined
    if (waypoint) return waypoint

    const vor = db
      .prepare(
        `
        SELECT ident, laty, lonx, 'vor' AS source
        FROM vor
        WHERE ident = ?
        LIMIT 1
        `
      )
      .get(ident) as FixRow | undefined
    if (vor) return vor

    const ndb = db
      .prepare(
        `
        SELECT ident, laty, lonx, 'ndb' AS source
        FROM ndb
        WHERE ident = ?
        LIMIT 1
        `
      )
      .get(ident) as FixRow | undefined
    if (ndb) return ndb

    return null
  }

  private resolveStartProcedurePoint(
    db: Database.Database,
    departureProcedureId: string | null
  ): FlightPlanPoint | null {
    if (!departureProcedureId?.startsWith('start:')) {
      return null
    }

    const startId = Number(departureProcedureId.slice('start:'.length))
    if (!Number.isFinite(startId)) {
      return null
    }

    const row = db
      .prepare('SELECT runway_name, laty, lonx FROM start WHERE start_id = ? LIMIT 1')
      .get(startId) as { runway_name: string | null; laty: number; lonx: number } | undefined

    if (!row) {
      return null
    }

    return {
      ident: row.runway_name ? `RWY${row.runway_name}` : 'DEP',
      lat: row.laty,
      lon: row.lonx,
      source: 'procedure'
    }
  }

  private resolveApproachLegPoints(
    db: Database.Database,
    approachProcedureId: string | null
  ): FlightPlanPoint[] {
    if (!approachProcedureId?.startsWith('approach:')) {
      return []
    }

    const approachId = Number(approachProcedureId.slice('approach:'.length))
    if (!Number.isFinite(approachId)) {
      return []
    }

    const legs = db
      .prepare(
        `
        SELECT fix_ident, fix_laty, fix_lonx
        FROM approach_leg
        WHERE approach_id = ? AND fix_laty IS NOT NULL AND fix_lonx IS NOT NULL
        ORDER BY approach_leg_id
        `
      )
      .all(approachId) as ApproachLegRow[]

    return legs.map((leg) => ({
      ident: leg.fix_ident?.trim() || 'APPR',
      lat: leg.fix_laty as number,
      lon: leg.fix_lonx as number,
      source: 'procedure'
    }))
  }
}

function normalizeNullablePath(pathValue: string | null | undefined): string | null {
  if (!pathValue) return null
  const trimmed = pathValue.trim()
  return trimmed || null
}

function normalizeRouteTokens(routeText: string): string[] {
  return routeText
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0)
    .filter((token) => token !== 'DCT' && token !== 'DIRECT')
}

function asFiniteOrNull(value: unknown): number | null {
  if (typeof value !== 'number') return null
  return Number.isFinite(value) ? value : null
}

function dedupeConsecutivePoints(points: FlightPlanPoint[]): FlightPlanPoint[] {
  const output: FlightPlanPoint[] = []

  for (const point of points) {
    const prev = output[output.length - 1]
    if (prev && Math.abs(prev.lat - point.lat) < 1e-7 && Math.abs(prev.lon - point.lon) < 1e-7) {
      continue
    }
    output.push(point)
  }

  return output
}

function readStringPath(
  data: Record<string, unknown>,
  path: string[]
): string | null {
  let current: unknown = data
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' ? current : null
}

function emptyProcedures(): NavAirportProcedures {
  return {
    airport: null,
    runways: [],
    departures: [],
    arrivals: [],
    approaches: []
  }
}
