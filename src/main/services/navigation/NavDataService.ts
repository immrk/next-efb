import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AppSettings } from '@shared/types'
import type {
  BuildFlightPlanInput,
  BuildFlightPlanResult,
  FlightPlanPoint,
  FlightPlanSegment,
  NavAirportOption,
  NavAirportProcedures,
  NavDataStatus,
  NavProcedureOption,
  NavRunwayOption,
  NavTransitionOption,
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
  runway_end_id: number
  runway_name: string
  paired_runway_name: string | null
  length: number | null
  width: number | null
  surface: string | null
  heading: number | null
  is_takeoff: number | null
  is_landing: number | null
}

type StartProcedureRow = {
  start_id: number
  runway_end_id: number | null
  runway_name: string | null
  type: string | null
  heading: number | null
  altitude: number | null
  laty: number
  lonx: number
}

type ApproachProcedureRow = {
  approach_id: number
  runway_end_id: number | null
  runway_name: string | null
  type: string
  suffix: string | null
  arinc_name: string | null
  fix_ident: string | null
  altitude: number | null
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
        SELECT
          re.runway_end_id,
          re.name AS runway_name,
          MAX(r.length) AS length,
          MAX(r.width) AS width,
          MAX(r.surface) AS surface,
          MAX(re.heading) AS heading,
          MAX(re.is_takeoff) AS is_takeoff,
          MAX(re.is_landing) AS is_landing,
          MAX(
            CASE
              WHEN primary_re.name IS NOT NULL AND secondary_re.name IS NOT NULL THEN primary_re.name || '/' || secondary_re.name
              WHEN primary_re.name IS NOT NULL THEN primary_re.name
              WHEN secondary_re.name IS NOT NULL THEN secondary_re.name
              ELSE NULL
            END
          ) AS paired_runway_name
        FROM runway_end re
        JOIN runway r
          ON r.airport_id = @airportId
         AND (r.primary_end_id = re.runway_end_id OR r.secondary_end_id = re.runway_end_id)
        LEFT JOIN runway_end primary_re ON primary_re.runway_end_id = r.primary_end_id
        LEFT JOIN runway_end secondary_re ON secondary_re.runway_end_id = r.secondary_end_id
        GROUP BY re.runway_end_id, re.name
        ORDER BY paired_runway_name, re.name
        `
      )
      .all({ airportId: airport.airport_id }) as RunwayRow[]

    const procedures = db
      .prepare(
        `
        SELECT approach_id, runway_end_id, runway_name, type, suffix, arinc_name, fix_ident, altitude
        FROM approach
        WHERE airport_ident = ?
        ORDER BY runway_name, type, suffix, arinc_name, fix_ident, approach_id
        `
      )
      .all(ident) as ApproachProcedureRow[]

    const transitions = db
      .prepare(
        `
        SELECT
          t.transition_id,
          t.approach_id,
          t.type,
          t.fix_ident,
          t.dme_ident,
          t.dme_distance,
          t.dme_radial,
          a.runway_name AS approach_runway_name,
          a.type AS approach_type,
          a.suffix AS approach_suffix,
          a.arinc_name AS approach_arinc_name
        FROM transition t
        JOIN approach a ON a.approach_id = t.approach_id
        WHERE a.airport_ident = ?
        ORDER BY a.runway_name, a.type, a.suffix, a.arinc_name, t.fix_ident, t.transition_id
        `
      )
      .all(ident) as Array<{
        transition_id: number
        approach_id: number
        type: string
        fix_ident: string | null
        dme_ident: string | null
        dme_distance: number | null
        dme_radial: number | null
        approach_runway_name: string | null
        approach_type: string
        approach_suffix: string | null
        approach_arinc_name: string | null
      }>

    db.close()

    const runwayOptions: NavRunwayOption[] = runways.map((row) => {
      const displayName =
        row.paired_runway_name && row.paired_runway_name !== row.runway_name
          ? `${row.runway_name} · ${row.paired_runway_name}`
          : row.runway_name

      return {
        name: row.runway_name,
        displayName,
        lengthM: asFiniteOrNull(row.length),
        widthM: asFiniteOrNull(row.width),
        surface: row.surface,
        headingDeg: asFiniteOrNull(row.heading)
      }
    })

    const departureOptions: NavProcedureOption[] = procedures
      .filter((row) => isGpsProcedure(row) && matchesSuffix(row.suffix, ['D', '']))
      .map((row) => ({
        id: `approach:${row.approach_id}`,
        name: row.fix_ident?.trim() ? row.fix_ident.trim() : `Procedure ${row.approach_id}`,
        procedureType: 'departure',
        runwayName: row.runway_name
      }))

    const arrivalOptions: NavProcedureOption[] = procedures
      .filter((row) => isGpsProcedure(row) && matchesSuffix(row.suffix, ['A', '']))
      .map((row) => ({
        id: `approach:${row.approach_id}`,
        name: row.fix_ident?.trim() ? row.fix_ident.trim() : `Procedure ${row.approach_id}`,
        procedureType: 'arrival',
        runwayName: row.runway_name
      }))

    const approachOptions: NavProcedureOption[] = procedures
      .filter((row) => !isGpsProcedure(row))
      .map((row) => ({
        id: `approach:${row.approach_id}`,
        name: formatApproachName(row),
        procedureType: 'approach',
        runwayName: row.runway_name
      }))

    const transitionOptions: NavTransitionOption[] = transitions.map((row) => ({
      id: `transition:${row.transition_id}`,
      name: buildTransitionLabel({
        transition_id: row.transition_id,
        approach_id: row.approach_id,
        type: row.type,
        fix_ident: row.fix_ident,
        dme_ident: row.dme_ident,
        dme_distance: row.dme_distance,
        dme_radial: row.dme_radial,
        approach_runway_name: row.approach_runway_name,
        approach_type: row.approach_type,
        approach_suffix: row.approach_suffix,
        approach_arinc_name: row.approach_arinc_name
      }),
      approachId: row.approach_id,
      approachName: formatApproachName({
        approach_id: row.approach_id,
        runway_end_id: null,
        runway_name: row.approach_runway_name,
        type: row.approach_type,
        suffix: row.approach_suffix,
        arinc_name: row.approach_arinc_name,
        fix_ident: row.fix_ident,
        altitude: null
      }),
      runwayName: row.approach_runway_name
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
      departures: departureOptions,
      arrivals: arrivalOptions,
      transitions: transitionOptions,
      approaches: approachOptions
    }
  }

  buildFlightPlan(settings: AppSettings, input: BuildFlightPlanInput): BuildFlightPlanResult {
    const db = this.openDatabase(settings)
    if (!db) {
      return {
        points: [],
        segments: [],
        unresolvedTokens: [],
        summary: 'Navigation database is not available.'
      }
    }

    const departureIdent = input.departureAirport.trim().toUpperCase()
    const destinationIdent = input.destinationAirport.trim().toUpperCase()
    const departureRunwayName = normalizeNullablePath(input.departureRunway)
    const departureProcedureId = normalizeNullablePath(input.departureProcedureId)
    const arrivalRunwayName = normalizeNullablePath(input.arrivalRunway)
    const arrivalProcedureId = normalizeNullablePath(input.arrivalProcedureId)
    const approachProcedureId = normalizeNullablePath(input.approachProcedureId)
    const arrivalTransitionId = normalizeNullablePath(input.arrivalTransitionId)
    const unresolvedTokens: string[] = []
    const mainPoints: FlightPlanPoint[] = []
    const missedPoints: FlightPlanPoint[] = []

    const departure = this.getAirportByIdent(db, departureIdent)
    const destination = this.getAirportByIdent(db, destinationIdent)

    const departureStartPoint =
      departureRunwayName && departure?.airport_id
        ? this.resolveRunwayEndPoint(db, departure.airport_id, departureRunwayName) ??
          this.resolveAirportPoint(departure)
        : this.resolveAirportPoint(departure)

    if (departureStartPoint) {
      mainPoints.push(departureStartPoint)
    }

    const departureProcedurePoint = this.resolveProcedurePoint(db, departureProcedureId)
    if (departureProcedurePoint) {
      mainPoints.push(departureProcedurePoint)
    }

    const tokens = normalizeRouteTokens(input.enrouteText)
    for (const token of tokens) {
      if (token === departureIdent || token === destinationIdent) {
        continue
      }

      const fix = this.resolveFix(db, token)
      if (fix) {
        mainPoints.push({
          ident: fix.ident,
          lat: fix.laty,
          lon: fix.lonx,
          source: fix.source
        })
      } else {
        unresolvedTokens.push(token)
      }
    }

    const arrivalProcedurePoint = this.resolveProcedurePoint(db, arrivalProcedureId)
    if (arrivalProcedurePoint) {
      mainPoints.push(arrivalProcedurePoint)
    }

    const transitionPoint = this.resolveTransitionPoint(db, arrivalTransitionId)
    if (transitionPoint) {
      mainPoints.push(transitionPoint)
    }

    const approachLegs = this.resolveApproachLegPoints(db, approachProcedureId)
    mainPoints.push(...approachLegs.main)

    const destinationPoint =
      arrivalRunwayName && destination?.airport_id
        ? this.resolveRunwayEndPoint(db, destination.airport_id, arrivalRunwayName) ??
          this.resolveAirportPoint(destination)
        : this.resolveAirportPoint(destination)

    if (destinationPoint) {
      mainPoints.push(destinationPoint)
    }

    const missedStartPoint =
      arrivalRunwayName && destination?.airport_id
        ? this.resolveRunwayEndPoint(db, destination.airport_id, arrivalRunwayName) ?? destinationPoint
        : destinationPoint

    if (missedStartPoint && approachLegs.missed.length > 0) {
      missedPoints.push(missedStartPoint, ...approachLegs.missed)
    }

    db.close()

    const mainSegment = dedupeConsecutivePoints(mainPoints)
    const missedSegment = dedupeConsecutivePoints(missedPoints)
    const segments: FlightPlanSegment[] = [mainSegment.length > 0 ? { points: mainSegment } : null, missedSegment.length > 0 ? { points: missedSegment, dashed: true } : null].filter(
      (segment): segment is FlightPlanSegment => Boolean(segment)
    )
    const uniquePoints = dedupeConsecutivePoints([...mainSegment, ...missedSegment])
    const procedureSummary = [
      departureRunwayName ? `DEP RWY ${departureRunwayName}` : 'DEP AUTO',
      departureProcedureId ? `DEP PROC ${departureProcedureId.replace(/^approach:/, '')}` : null,
      arrivalRunwayName ? `ARR RWY ${arrivalRunwayName}` : 'ARR AUTO',
      arrivalProcedureId ? `ARR PROC ${arrivalProcedureId.replace(/^approach:/, '')}` : null,
      approachProcedureId ? `APR PROC ${approachProcedureId.replace(/^approach:/, '')}` : null,
      arrivalTransitionId ? `TRANS ${arrivalTransitionId.replace(/^transition:/, '')}` : null
    ]
      .filter(Boolean)
      .join(' | ')

    return {
      points: uniquePoints,
      segments,
      unresolvedTokens,
      summary: `${departureIdent || '----'} -> ${destinationIdent || '----'} | ${uniquePoints.length} points | ${procedureSummary}`
    }
  }

  private resolveProcedurePoint(db: Database.Database, procedureId: string | null): FlightPlanPoint | null {
    if (!procedureId?.startsWith('approach:')) {
      return null
    }

    const parsedProcedureId = Number(procedureId.slice('approach:'.length))
    if (!Number.isFinite(parsedProcedureId)) {
      return null
    }

    const row = db
      .prepare(
        `
        SELECT approach_id, fix_ident
        FROM approach
        WHERE approach_id = ?
        LIMIT 1
        `
      )
      .get(parsedProcedureId) as { approach_id: number; fix_ident: string | null } | undefined

    if (!row) {
      return null
    }

    const fix = row.fix_ident?.trim() ? this.resolveFix(db, row.fix_ident) : null
    if (!fix) {
      return null
    }

    return {
      ident: fix.ident,
      lat: fix.laty,
      lon: fix.lonx,
      source: fix.source
    }
  }

  private resolveTransitionPoint(db: Database.Database, transitionId: string | null): FlightPlanPoint | null {
    if (!transitionId?.startsWith('transition:')) {
      return null
    }

    const parsedTransitionId = Number(transitionId.slice('transition:'.length))
    if (!Number.isFinite(parsedTransitionId)) {
      return null
    }

    const row = db
      .prepare(
        `
        SELECT t.fix_ident, t.dme_ident, t.type, a.runway_name AS runway_name,
          a.type AS approach_type, a.suffix AS approach_suffix, a.arinc_name AS approach_arinc_name
        FROM transition t
        JOIN approach a ON a.approach_id = t.approach_id
        WHERE t.transition_id = ?
        LIMIT 1
        `
      )
      .get(parsedTransitionId) as
      | {
          fix_ident: string | null
          dme_ident: string | null
          type: string
          runway_name: string | null
          approach_type: string
          approach_suffix: string | null
          approach_arinc_name: string | null
        }
      | undefined

    if (!row) {
      return null
    }

    const token = row.fix_ident?.trim() || row.dme_ident?.trim()
    if (!token) {
      return null
    }

    const fix = this.resolveFix(db, token)
    if (!fix) {
      return null
    }

    return {
      ident: fix.ident,
      lat: fix.laty,
      lon: fix.lonx,
      source: fix.source
    }
  }

  private resolveApproachLegPoints(
    db: Database.Database,
    approachProcedureId: string | null
  ): { main: FlightPlanPoint[]; missed: FlightPlanPoint[] } {
    if (!approachProcedureId?.startsWith('approach:')) {
      return { main: [], missed: [] }
    }

    const approachId = Number(approachProcedureId.slice('approach:'.length))
    if (!Number.isFinite(approachId)) {
      return { main: [], missed: [] }
    }

    const legs = db
      .prepare(
        `
        SELECT fix_ident, fix_laty, fix_lonx, is_missed
        FROM approach_leg
        WHERE approach_id = ? AND fix_laty IS NOT NULL AND fix_lonx IS NOT NULL
        ORDER BY approach_leg_id
        `
      )
      .all(approachId) as Array<ApproachLegRow & { is_missed: number | null }>

    const mapped = legs.map((leg) => ({
      ident: leg.fix_ident?.trim() || 'APPR',
      lat: leg.fix_laty as number,
      lon: leg.fix_lonx as number,
      source: 'procedure' as const,
      isMissed: Boolean(leg.is_missed)
    }))

    return {
      main: mapped.filter((leg) => !leg.isMissed).map(stripMissedFlag),
      missed: mapped.filter((leg) => leg.isMissed).map(stripMissedFlag)
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

  private resolveAirportPoint(airport: AirportRow | null): FlightPlanPoint | null {
    if (!airport) return null
    return {
      ident: airport.ident,
      lat: airport.laty,
      lon: airport.lonx,
      source: 'airport'
    }
  }

  private resolveRunwayEndPoint(
    db: Database.Database,
    airportId: number,
    runwayName: string
  ): FlightPlanPoint | null {
    const row = db
      .prepare(
        `
        SELECT re.name AS runway_name, re.laty, re.lonx
        FROM runway_end re
        JOIN runway r
          ON r.airport_id = ?
         AND (r.primary_end_id = re.runway_end_id OR r.secondary_end_id = re.runway_end_id)
        WHERE re.name = ?
        ORDER BY r.runway_id
        LIMIT 1
        `
      )
      .get(airportId, runwayName) as { runway_name: string | null; laty: number; lonx: number } | undefined

    if (!row) return null

    return {
      ident: row.runway_name ? `RWY ${row.runway_name}` : 'RWY',
      lat: row.laty,
      lon: row.lonx,
      source: 'airport'
    }
  }
}

function stripMissedFlag(point: FlightPlanPoint & { isMissed?: boolean }): FlightPlanPoint {
  const { isMissed: _isMissed, ...rest } = point
  return rest
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

type TransitionRow = {
  transition_id: number
  approach_id: number
  type: string
  fix_ident: string | null
  dme_ident: string | null
  dme_distance: number | null
  dme_radial: number | null
  approach_runway_name: string | null
  approach_type: string
  approach_suffix: string | null
  approach_arinc_name: string | null
}

function isGpsProcedure(row: Pick<ApproachProcedureRow, 'type'>): boolean {
  return row.type.trim().toUpperCase() === 'GPS'
}

function matchesSuffix(suffix: string | null, accepted: string[]): boolean {
  const normalized = normalizeText(suffix)
  return accepted.some((item) => normalizeText(item) === normalized)
}

function formatProcedureName(row: Pick<ApproachProcedureRow, 'type' | 'suffix' | 'runway_name'>): string {
  const parts = [normalizeText(row.type)]
  const suffix = normalizeText(row.suffix)
  if (suffix) parts.push(suffix)
  const runway = normalizeText(row.runway_name)
  if (runway) parts.push(runway)
  return parts.filter(Boolean).join(' ')
}

function formatApproachName(row: ApproachProcedureRow): string {
  return formatProcedureName(row)
}

function buildTransitionLabel(row: TransitionRow): string {
  const fix = normalizeText(row.fix_ident) || `TRANS ${row.transition_id}`
  const approach = formatProcedureName({
    type: row.approach_type,
    suffix: row.approach_suffix,
    runway_name: row.approach_runway_name
  })
  const dme = normalizeText(row.dme_ident)
  return [fix, approach, dme ? `DME ${dme}` : null].filter(Boolean).join(' ? ')
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

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}
