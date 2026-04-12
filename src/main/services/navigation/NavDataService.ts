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
import type {
  NavMapAirwayFeature,
  NavMapAirportFeature,
  NavMapFeatureCollection,
  NavMapFeatureOverflow,
  NavMapLayerVisibility,
  NavMapSearchInput,
  NavMapSearchResult,
  NavMapSearchType,
  NavMapNdbFeature,
  NavMapQueryInput,
  NavMapVorFeature,
  NavMapWaypointFeature
} from '@shared/nav-map-types'

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

type FixCandidateRow = FixRow & {
  region: string | null
  airport_ident: string | null
  source_rank: number
}

type ApproachLegRow = {
  fix_ident: string | null
  fix_laty: number | null
  fix_lonx: number | null
}

type MapAirportRow = {
  airport_id: number
  ident: string
  name: string | null
  type: number | null
  longest_runway_length: number | null
  num_approach: number | null
  lonx: number
  laty: number
}

type MapWaypointRow = {
  waypoint_id: number
  ident: string
  type: string | null
  airport_ident: string | null
  lonx: number
  laty: number
}

type MapVorRow = {
  vor_id: number
  ident: string | null
  type: string | null
  frequency: number | null
  lonx: number
  laty: number
}

type MapNdbRow = {
  ndb_id: number
  ident: string | null
  type: string | null
  frequency: number | null
  lonx: number
  laty: number
}

type MapAirwayRow = {
  airway_id: number
  airway_name: string
  airway_type: string
  from_lonx: number
  from_laty: number
  to_lonx: number
  to_laty: number
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
        displayName: row.runway_name,
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
        name: formatGpsProcedureName(row),
        procedureType: 'departure',
        runwayName: row.runway_name
      }))

    const arrivalOptions: NavProcedureOption[] = procedures
      .filter((row) => isGpsProcedure(row) && matchesSuffix(row.suffix, ['A', '']))
      .map((row) => ({
        id: `approach:${row.approach_id}`,
        name: formatGpsProcedureName(row),
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
    const routePoints: FlightPlanPoint[] = []
    const segments: FlightPlanSegment[] = []

    const departure = this.getAirportByIdent(db, departureIdent)
    const destination = this.getAirportByIdent(db, destinationIdent)
    const departureLegs = this.resolveApproachLegPoints(db, departureProcedureId)
    const arrivalLegs = this.resolveApproachLegPoints(db, arrivalProcedureId)
    const approachLegs = this.resolveApproachLegPoints(db, approachProcedureId)

    const departureStartPoint =
      departureRunwayName && departure?.airport_id
        ? this.resolveRunwayEndPoint(db, departure.airport_id, departureRunwayName) ??
          this.resolveAirportPoint(departure)
        : this.resolveAirportPoint(departure)

    const departureSegmentPoints = dedupeConsecutivePoints(collectPoints(departureStartPoint, ...departureLegs.main))
    appendSegment(segments, routePoints, departureSegmentPoints, 'departure', FLIGHT_PLAN_COLORS.departure)

    const departureAnchor = lastPoint(departureSegmentPoints) ?? departureStartPoint
    const tokens = normalizeRouteTokens(input.enrouteText)
    const enroutePoints: FlightPlanPoint[] = []
    if (departureAnchor) {
      enroutePoints.push(departureAnchor)
    }

    for (const token of tokens) {
      if (token === departureIdent || token === destinationIdent) {
        continue
      }

      const fix = this.resolveFix(db, token, {
        referencePoint: enroutePoints[enroutePoints.length - 1] ?? departureAnchor
      })
      if (fix) {
        enroutePoints.push({
          ident: fix.ident,
          lat: fix.laty,
          lon: fix.lonx,
          source: fix.source
        })
      } else {
        unresolvedTokens.push(token)
      }
    }

    const destinationPoint =
      arrivalRunwayName && destination?.airport_id
        ? this.resolveRunwayEndPoint(db, destination.airport_id, arrivalRunwayName) ??
          this.resolveAirportPoint(destination)
        : this.resolveAirportPoint(destination)

    const enrouteAnchor = lastPoint(enroutePoints) ?? departureAnchor
    const transitionPoint = this.resolveTransitionPoint(db, arrivalTransitionId)
    const arrivalEntryPoint = arrivalLegs.main[0] ?? transitionPoint ?? approachLegs.main[0] ?? destinationPoint
    const enrouteSegmentPoints = dedupeConsecutivePoints(
      collectPoints(...enroutePoints, arrivalEntryPoint)
    )
    appendSegment(segments, routePoints, enrouteSegmentPoints, 'enroute', FLIGHT_PLAN_COLORS.enroute)

    const arrivalSegmentPoints = dedupeConsecutivePoints(
      collectPoints(arrivalEntryPoint, ...arrivalLegs.main.slice(1), transitionPoint)
    )
    appendSegment(segments, routePoints, arrivalSegmentPoints, 'arrival', FLIGHT_PLAN_COLORS.arrival)

    const arrivalAnchor = lastPoint(arrivalSegmentPoints) ?? enrouteAnchor
    const approachEntryPoint = transitionPoint ?? arrivalAnchor
    const approachSegmentPoints = dedupeConsecutivePoints(collectPoints(approachEntryPoint, ...approachLegs.main))

    const mainApproachPoints = dedupeConsecutivePoints(collectPoints(...approachSegmentPoints, destinationPoint))
    appendSegment(segments, routePoints, mainApproachPoints, 'approach', FLIGHT_PLAN_COLORS.approach)

    const missedStartPoint = destinationPoint
    const missedSegmentPoints = dedupeConsecutivePoints(collectPoints(missedStartPoint, ...approachLegs.missed))
    appendSegment(segments, routePoints, missedSegmentPoints, 'missed', FLIGHT_PLAN_COLORS.missed, true)

    db.close()

    const uniquePoints = dedupeConsecutivePoints(routePoints)
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

  getMapFeatures(settings: AppSettings, input: NavMapQueryInput): NavMapFeatureCollection {
    const db = this.openDatabase(settings)
    if (!db) {
      return emptyMapFeatureCollection()
    }

    const normalizedInput = normalizeMapQueryInput(input)
    if (!normalizedInput) {
      db.close()
      return emptyMapFeatureCollection()
    }

    const {
      viewport,
      layers
    } = normalizedInput
    const overflow: NavMapFeatureOverflow = {
      airports: false,
      waypoints: false,
      vors: false,
      ndbs: false,
      airways: false
    }

    const airports = layers.airports
      ? this.queryAirports(db, viewport, overflow)
      : []
    const waypoints = layers.waypoints
      ? this.queryWaypoints(db, viewport, overflow)
      : []
    const vors = layers.vors
      ? this.queryVors(db, viewport, overflow)
      : []
    const ndbs = layers.ndbs
      ? this.queryNdbs(db, viewport, overflow)
      : []
    const airways = layers.airways
      ? this.queryAirways(db, viewport, overflow)
      : []

    db.close()

    return {
      airports,
      waypoints,
      vors,
      ndbs,
      airways,
      overflow,
      fetchedAt: Date.now()
    }
  }

  searchMapPoints(settings: AppSettings, input: NavMapSearchInput): NavMapSearchResult[] {
    const db = this.openDatabase(settings)
    if (!db) {
      return []
    }

    const query = input.query.trim().toUpperCase()
    const limit = Math.max(1, Math.min(30, input.limit ?? 12))
    const uniqueTypes = Array.from(new Set(input.types)).filter(isSearchablePointType)

    if (!query || uniqueTypes.length === 0) {
      db.close()
      return []
    }

    const perTypeLimit = Math.max(limit, 12)
    const results = uniqueTypes.flatMap((type) => this.searchPointType(db, type, query, perTypeLimit))

    db.close()

    return [...results]
      .sort((left, right) => {
        const scoreDelta = left.score - right.score
        if (scoreDelta !== 0) return scoreDelta
        return left.ident.localeCompare(right.ident)
      })
      .slice(0, limit)
      .map(({ score: _score, ...result }) => result)
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
        SELECT approach_id, fix_ident, fix_region
        FROM approach
        WHERE approach_id = ?
        LIMIT 1
        `
      )
      .get(parsedProcedureId) as
      | { approach_id: number; fix_ident: string | null; fix_region: string | null }
      | undefined

    if (!row) {
      return null
    }

    const fix = row.fix_ident?.trim()
      ? this.resolveFix(db, row.fix_ident, {
          region: row.fix_region
        })
      : null
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
        SELECT t.fix_ident, t.fix_region, t.dme_ident, t.dme_region, t.type, a.runway_name AS runway_name,
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
          fix_region: string | null
          dme_ident: string | null
          dme_region: string | null
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

    const fix = this.resolveFix(db, token, {
      region: row.fix_ident?.trim() ? row.fix_region : row.dme_region
    })
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
      throw new Error('SIMBRIEF_USERNAME_REQUIRED')
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
    const departureAirport =
      readFirstStringPath(payload, [
        ['origin', 'icao_code'],
        ['origin', 'icao'],
        ['params', 'orig']
      ])
    const destinationAirport =
      readFirstStringPath(payload, [
        ['destination', 'icao_code'],
        ['destination', 'icao'],
        ['params', 'dest']
      ])
    const alternateAirport = readStringPath(payload, ['alternate', 'icao_code']) ?? null
    const routeText =
      readFirstStringPath(payload, [
        ['general', 'route'],
        ['navlog', 'route'],
        ['params', 'route']
      ]) ?? ''
    const normalizedRouteText = routeText.trim().toUpperCase()
    const routeProcedures = extractProceduresFromRoute(normalizedRouteText)
    const departureRunway = normalizeRunwayName(
      readFirstStringPath(payload, [
        ['origin', 'plan_rwy'],
        ['origin', 'runway'],
        ['general', 'initial_altitude_runway'],
        ['params', 'origrwy']
      ])
    )
    const arrivalRunway = normalizeRunwayName(
      readFirstStringPath(payload, [
        ['destination', 'plan_rwy'],
        ['destination', 'runway'],
        ['params', 'destrwy'],
        ['params', 'arrrwy']
      ])
    )
    const departureProcedureName = normalizeProcedureToken(
      readFirstStringPath(payload, [
        ['general', 'sid_ident'],
        ['origin', 'sid'],
        ['origin', 'sid_ident'],
        ['navlog', 'sid'],
        ['params', 'sid']
      ]) ?? routeProcedures.departureProcedureName
    )
    const arrivalProcedureName = normalizeProcedureToken(
      readFirstStringPath(payload, [
        ['general', 'star_ident'],
        ['destination', 'star'],
        ['destination', 'star_ident'],
        ['navlog', 'star'],
        ['params', 'star']
      ]) ?? routeProcedures.arrivalProcedureName
    )
    const approachProcedureName = normalizeProcedureToken(
      readFirstStringPath(payload, [
        ['destination', 'approach'],
        ['destination', 'approach_name'],
        ['general', 'approach'],
        ['params', 'approach']
      ])
    )
    const arrivalTransitionName = normalizeProcedureToken(
      readFirstStringPath(payload, [
        ['general', 'star_trans'],
        ['destination', 'transition'],
        ['destination', 'transition_name'],
        ['params', 'transition']
      ])
    )

    if (!departureAirport || !destinationAirport) {
      throw new Error('SIMBRIEF_PARSE_FAILED')
    }

    return {
      departureAirport: departureAirport.trim().toUpperCase(),
      destinationAirport: destinationAirport.trim().toUpperCase(),
      alternateAirport: alternateAirport ? alternateAirport.trim().toUpperCase() : null,
      routeText: normalizedRouteText,
      departureRunway,
      arrivalRunway,
      departureProcedureName,
      arrivalProcedureName,
      approachProcedureName,
      arrivalTransitionName,
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

  private resolveFix(
    db: Database.Database,
    token: string,
    options?: {
      region?: string | null
      airportIdent?: string | null
      referencePoint?: Pick<FlightPlanPoint, 'lat' | 'lon'> | null
    }
  ): FixRow | null {
    const ident = token.trim().toUpperCase()
    if (!ident) return null

    const candidates = db
      .prepare(
        `
        SELECT ident, laty, lonx, region, airport_ident, 'waypoint' AS source, 0 AS source_rank
        FROM waypoint
        WHERE ident = ?
        UNION ALL
        SELECT ident, laty, lonx, region, airport_ident, 'vor' AS source, 1 AS source_rank
        FROM vor
        WHERE ident = ?
        UNION ALL
        SELECT ident, laty, lonx, region, airport_ident, 'ndb' AS source, 2 AS source_rank
        FROM ndb
        WHERE ident = ?
        `
      )
      .all(ident, ident, ident) as FixCandidateRow[]
    if (!candidates.length) return null

    const normalizedAirportIdent = normalizeText(options?.airportIdent)
    const normalizedRegion = normalizeText(options?.region)
    let pool = candidates

    if (normalizedAirportIdent) {
      const airportMatches = candidates.filter(
        (candidate) => normalizeText(candidate.airport_ident) === normalizedAirportIdent
      )
      if (airportMatches.length) {
        pool = airportMatches
      }
    }

    if (normalizedRegion) {
      const regionMatches = pool.filter((candidate) => normalizeText(candidate.region) === normalizedRegion)
      if (regionMatches.length) {
        pool = regionMatches
      }
    }

    const referencePoint = options?.referencePoint
    const [best] = [...pool].sort((left, right) => {
      if (referencePoint) {
        const distanceDelta =
          approximateDistanceSquared(left.laty, left.lonx, referencePoint) -
          approximateDistanceSquared(right.laty, right.lonx, referencePoint)
        if (Math.abs(distanceDelta) > 1e-9) {
          return distanceDelta
        }
      }

      const airportWeightLeft = left.airport_ident?.trim() ? 1 : 0
      const airportWeightRight = right.airport_ident?.trim() ? 1 : 0
      if (airportWeightLeft !== airportWeightRight) {
        return airportWeightLeft - airportWeightRight
      }

      return left.source_rank - right.source_rank
    })

    return best
      ? {
          ident: best.ident,
          laty: best.laty,
          lonx: best.lonx,
          source: best.source
        }
      : null
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

  private queryAirports(
    db: Database.Database,
    viewport: NormalizedMapViewport,
    overflow: NavMapFeatureOverflow
  ): NavMapAirportFeature[] {
    const limit = getAirportLimit(viewport.zoom)
    const rows = this.executeViewportQuery<MapAirportRow>(
      db,
      `
      SELECT airport_id, ident, name, type, longest_runway_length, num_approach, lonx, laty
      FROM airport
      WHERE {{lonPredicate}}
        AND bottom_laty <= @north
        AND top_laty >= @south
        AND longest_runway_length >= @minRunwayLength
      ORDER BY longest_runway_length DESC, ident
      LIMIT @rowLimitPlusOne
      `,
      viewport,
      {
        minRunwayLength: getMinimumAirportRunwayLength(viewport.zoom),
        rowLimitPlusOne: limit + 1
      }
    )

    overflow.airports = rows.length > limit

    return rows.slice(0, limit).map((row) => ({
      id: row.airport_id,
      ident: row.ident,
      name: row.name,
      type: asFiniteOrNull(row.type),
      lat: row.laty,
      lon: row.lonx,
      longestRunwayLengthFt: asFiniteOrNull(row.longest_runway_length),
      numApproach: asFiniteOrNull(row.num_approach)
    }))
  }

  private queryWaypoints(
    db: Database.Database,
    viewport: NormalizedMapViewport,
    overflow: NavMapFeatureOverflow
  ): NavMapWaypointFeature[] {
    const limit = getWaypointLimit(viewport.zoom)
    const rows = this.executeViewportQuery<MapWaypointRow>(
      db,
      `
      SELECT waypoint_id, ident, type, airport_ident, lonx, laty
      FROM waypoint
      WHERE {{lonPredicate}}
        AND laty BETWEEN @south AND @north
      ORDER BY ident
      LIMIT @rowLimitPlusOne
      `,
      viewport,
      {
        rowLimitPlusOne: limit + 1
      }
    )

    overflow.waypoints = rows.length > limit

    return rows.slice(0, limit).map((row) => ({
      id: row.waypoint_id,
      ident: row.ident,
      type: row.type,
      lat: row.laty,
      lon: row.lonx,
      airportIdent: row.airport_ident
    }))
  }

  private queryVors(
    db: Database.Database,
    viewport: NormalizedMapViewport,
    overflow: NavMapFeatureOverflow
  ): NavMapVorFeature[] {
    const limit = getVorLimit(viewport.zoom)
    const rows = this.executeViewportQuery<MapVorRow>(
      db,
      `
      SELECT vor_id, ident, type, frequency, lonx, laty
      FROM vor
      WHERE {{lonPredicate}}
        AND laty BETWEEN @south AND @north
      ORDER BY ident
      LIMIT @rowLimitPlusOne
      `,
      viewport,
      {
        rowLimitPlusOne: limit + 1
      }
    )

    overflow.vors = rows.length > limit

    return rows.slice(0, limit).map((row) => ({
      id: row.vor_id,
      ident: row.ident,
      type: row.type,
      frequency: asFiniteOrNull(row.frequency),
      lat: row.laty,
      lon: row.lonx
    }))
  }

  private queryNdbs(
    db: Database.Database,
    viewport: NormalizedMapViewport,
    overflow: NavMapFeatureOverflow
  ): NavMapNdbFeature[] {
    const limit = getNdbLimit(viewport.zoom)
    const rows = this.executeViewportQuery<MapNdbRow>(
      db,
      `
      SELECT ndb_id, ident, type, frequency, lonx, laty
      FROM ndb
      WHERE {{lonPredicate}}
        AND laty BETWEEN @south AND @north
      ORDER BY ident
      LIMIT @rowLimitPlusOne
      `,
      viewport,
      {
        rowLimitPlusOne: limit + 1
      }
    )

    overflow.ndbs = rows.length > limit

    return rows.slice(0, limit).map((row) => ({
      id: row.ndb_id,
      ident: row.ident,
      type: row.type,
      frequency: asFiniteOrNull(row.frequency),
      lat: row.laty,
      lon: row.lonx
    }))
  }

  private queryAirways(
    db: Database.Database,
    viewport: NormalizedMapViewport,
    overflow: NavMapFeatureOverflow
  ): NavMapAirwayFeature[] {
    const limit = getAirwayLimit(viewport.zoom)
    const rows = this.executeViewportQuery<MapAirwayRow>(
      db,
      `
      SELECT airway_id, airway_name, airway_type, from_lonx, from_laty, to_lonx, to_laty
      FROM airway
      WHERE {{lonBoxPredicate}}
        AND bottom_laty <= @north
        AND top_laty >= @south
      ORDER BY airway_name, airway_id
      LIMIT @rowLimitPlusOne
      `,
      viewport,
      {
        rowLimitPlusOne: limit + 1
      }
    )

    overflow.airways = rows.length > limit

    return rows.slice(0, limit).map((row) => ({
      id: row.airway_id,
      name: row.airway_name,
      airwayType: row.airway_type,
      fromLat: row.from_laty,
      fromLon: row.from_lonx,
      toLat: row.to_laty,
      toLon: row.to_lonx
    }))
  }

  private executeViewportQuery<Row extends object>(
    db: Database.Database,
    sql: string,
    viewport: NormalizedMapViewport,
    params: Record<string, unknown>
  ): Row[] {
    const { querySql, queryParams } = compileViewportSql(sql, viewport, params)
    return db.prepare(querySql).all(queryParams) as Row[]
  }

  private searchPointType(
    db: Database.Database,
    type: NavMapSearchType,
    query: string,
    limit: number
  ): Array<NavMapSearchResult & { score: number }> {
    const prefix = `${query}%`
    const wildcard = `%${query}%`

    switch (type) {
      case 'airports': {
        const rows = db
          .prepare(
            `
            SELECT airport_id AS id, ident, name, laty, lonx
            FROM airport
            WHERE ident LIKE @prefix OR name LIKE @wild
            ORDER BY
              CASE
                WHEN ident = @exact THEN 0
                WHEN ident LIKE @prefix THEN 1
                WHEN name = @exact THEN 2
                ELSE 3
              END,
              ident
            LIMIT @limit
            `
          )
          .all({ prefix, wild: wildcard, exact: query, limit }) as Array<{
          id: number
          ident: string
          name: string | null
          laty: number
          lonx: number
        }>

        return rows.map((row) => ({
          id: `airport:${row.id}`,
          type,
          ident: row.ident,
          name: row.name,
          lat: row.laty,
          lon: row.lonx,
          score: getSearchScore(query, row.ident, row.name)
        }))
      }
      case 'waypoints': {
        const rows = db
          .prepare(
            `
            SELECT waypoint_id AS id, ident, airport_ident, laty, lonx
            FROM waypoint
            WHERE ident LIKE @prefix OR ident LIKE @wild
            ORDER BY
              CASE
                WHEN ident = @exact THEN 0
                WHEN ident LIKE @prefix THEN 1
                ELSE 2
              END,
              ident
            LIMIT @limit
            `
          )
          .all({ prefix, wild: wildcard, exact: query, limit }) as Array<{
          id: number
          ident: string
          airport_ident: string | null
          laty: number
          lonx: number
        }>

        return rows.map((row) => ({
          id: `waypoint:${row.id}`,
          type,
          ident: row.ident,
          name: row.airport_ident,
          lat: row.laty,
          lon: row.lonx,
          score: getSearchScore(query, row.ident, row.airport_ident)
        }))
      }
      case 'vors': {
        const rows = db
          .prepare(
            `
            SELECT vor_id AS id, ident, type AS vor_type, laty, lonx
            FROM vor
            WHERE ident LIKE @prefix OR ident LIKE @wild
            ORDER BY
              CASE
                WHEN ident = @exact THEN 0
                WHEN ident LIKE @prefix THEN 1
                ELSE 2
              END,
              ident
            LIMIT @limit
            `
          )
          .all({ prefix, wild: wildcard, exact: query, limit }) as Array<{
          id: number
          ident: string | null
          vor_type: string | null
          laty: number
          lonx: number
        }>

        return rows
          .filter((row) => Boolean(row.ident))
          .map((row) => ({
            id: `vor:${row.id}`,
            type,
            ident: row.ident ?? '',
            name: row.vor_type,
            lat: row.laty,
            lon: row.lonx,
            score: getSearchScore(query, row.ident ?? '', row.vor_type)
          }))
      }
      case 'ndbs': {
        const rows = db
          .prepare(
            `
            SELECT ndb_id AS id, ident, type AS ndb_type, laty, lonx
            FROM ndb
            WHERE ident LIKE @prefix OR ident LIKE @wild
            ORDER BY
              CASE
                WHEN ident = @exact THEN 0
                WHEN ident LIKE @prefix THEN 1
                ELSE 2
              END,
              ident
            LIMIT @limit
            `
          )
          .all({ prefix, wild: wildcard, exact: query, limit }) as Array<{
          id: number
          ident: string | null
          ndb_type: string | null
          laty: number
          lonx: number
        }>

        return rows
          .filter((row) => Boolean(row.ident))
          .map((row) => ({
            id: `ndb:${row.id}`,
            type,
            ident: row.ident ?? '',
            name: row.ndb_type,
            lat: row.laty,
            lon: row.lonx,
            score: getSearchScore(query, row.ident ?? '', row.ndb_type)
          }))
      }
      default:
        return []
    }
  }
}

function stripMissedFlag(point: FlightPlanPoint & { isMissed?: boolean }): FlightPlanPoint {
  const { isMissed: _isMissed, ...rest } = point
  return rest
}

function appendSegment(
  segments: FlightPlanSegment[],
  routePoints: FlightPlanPoint[],
  points: FlightPlanPoint[],
  phase: NonNullable<FlightPlanSegment['phase']>,
  color: string,
  dashed = false
): void {
  const cleaned = dedupeConsecutivePoints(collectPoints(...points))
  if (cleaned.length < 2) {
    if (cleaned.length === 1) {
      routePoints.push(cleaned[0])
    }
    return
  }

  segments.push({ points: cleaned, phase, color, dashed })
  routePoints.push(...cleaned)
}

function lastPoint(points: FlightPlanPoint[]): FlightPlanPoint | null {
  return points.length > 0 ? points[points.length - 1] : null
}

function collectPoints(...points: Array<FlightPlanPoint | null | undefined>): FlightPlanPoint[] {
  return points.filter((point): point is FlightPlanPoint => Boolean(point))
}

const FLIGHT_PLAN_COLORS = {
  departure: '#4fd1c5',
  enroute: '#6aa8ff',
  arrival: '#ffbf69',
  approach: '#ff7b72',
  missed: '#c084fc'
} as const

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

interface NormalizedMapViewport {
  north: number
  south: number
  east: number
  west: number
  zoom: number
}

function normalizeMapQueryInput(input: NavMapQueryInput | null | undefined): {
  viewport: NormalizedMapViewport
  layers: NavMapLayerVisibility
} | null {
  if (!input) return null
  const viewport = normalizeViewport(input.viewport)
  if (!viewport) return null

  return {
    viewport,
    layers: {
      airports: Boolean(input.layers?.airports),
      waypoints: Boolean(input.layers?.waypoints),
      vors: Boolean(input.layers?.vors),
      ndbs: Boolean(input.layers?.ndbs),
      airways: Boolean(input.layers?.airways)
    }
  }
}

function isSearchablePointType(value: string): value is NavMapSearchType {
  return value === 'airports' || value === 'waypoints' || value === 'vors' || value === 'ndbs'
}

function getSearchScore(query: string, ident: string, name: string | null): number {
  const normalizedIdent = ident.trim().toUpperCase()
  const normalizedName = name?.trim().toUpperCase() ?? ''

  if (normalizedIdent === query) return 0
  if (normalizedIdent.startsWith(query)) return 1
  if (normalizedName === query) return 2
  if (normalizedName.startsWith(query)) return 3
  if (normalizedIdent.includes(query)) return 4
  if (normalizedName.includes(query)) return 5
  return 6
}

function normalizeViewport(viewport: NavMapQueryInput['viewport'] | null | undefined): NormalizedMapViewport | null {
  if (!viewport) return null
  const north = clampLatitude(viewport.north)
  const south = clampLatitude(viewport.south)
  const east = clampLongitude(viewport.east)
  const west = clampLongitude(viewport.west)
  const zoom = typeof viewport.zoom === 'number' && Number.isFinite(viewport.zoom) ? viewport.zoom : 0

  if (north <= south) {
    return null
  }

  return {
    north,
    south,
    east,
    west,
    zoom: Math.max(0, Math.min(24, zoom))
  }
}

function clampLatitude(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-90, Math.min(90, value))
}

function clampLongitude(value: number): number {
  if (!Number.isFinite(value)) return 0
  let normalized = value
  while (normalized > 180) normalized -= 360
  while (normalized < -180) normalized += 360
  return normalized
}

function compileViewportSql(
  sql: string,
  viewport: NormalizedMapViewport,
  params: Record<string, unknown>
): {
  querySql: string
  queryParams: Record<string, unknown>
} {
  const crossesAntiMeridian = viewport.west > viewport.east
  const querySql = sql
    .replace(
      '{{lonPredicate}}',
      crossesAntiMeridian
        ? '(lonx >= @west OR lonx <= @east)'
        : 'lonx BETWEEN @west AND @east'
    )
    .replace(
      '{{lonBoxPredicate}}',
      crossesAntiMeridian
        ? '(right_lonx >= @west OR left_lonx <= @east)'
        : 'right_lonx >= @west AND left_lonx <= @east'
    )

  return {
    querySql,
    queryParams: {
      north: viewport.north,
      south: viewport.south,
      east: viewport.east,
      west: viewport.west,
      ...params
    }
  }
}

function getMinimumAirportRunwayLength(zoom: number): number {
  if (zoom <= 4) return 8000
  if (zoom <= 5) return 6000
  if (zoom <= 6) return 4000
  if (zoom <= 7) return 2000
  return 0
}

function getAirportLimit(zoom: number): number {
  if (zoom <= 4) return 120
  if (zoom <= 6) return 180
  return 300
}

function getWaypointLimit(zoom: number): number {
  if (zoom <= 8) return 180
  if (zoom <= 10) return 350
  return 700
}

function getVorLimit(zoom: number): number {
  if (zoom <= 5) return 120
  if (zoom <= 8) return 180
  return 300
}

function getNdbLimit(zoom: number): number {
  if (zoom <= 5) return 100
  if (zoom <= 8) return 160
  return 260
}

function getAirwayLimit(zoom: number): number {
  if (zoom <= 5) return 180
  if (zoom <= 7) return 260
  return 450
}

function emptyMapFeatureCollection(): NavMapFeatureCollection {
  return {
    airports: [],
    waypoints: [],
    vors: [],
    ndbs: [],
    airways: [],
    overflow: {
      airports: false,
      waypoints: false,
      vors: false,
      ndbs: false,
      airways: false
    },
    fetchedAt: Date.now()
  }
}

function approximateDistanceSquared(
  lat: number,
  lon: number,
  referencePoint: Pick<FlightPlanPoint, 'lat' | 'lon'>
): number {
  const latDelta = lat - referencePoint.lat
  const lonDelta = lon - referencePoint.lon
  return latDelta * latDelta + lonDelta * lonDelta
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

function readFirstStringPath(data: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    const value = readStringPath(data, path)
    if (value?.trim()) {
      return value
    }
  }

  return null
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

function formatGpsProcedureName(row: Pick<ApproachProcedureRow, 'approach_id' | 'arinc_name' | 'fix_ident'>): string {
  const fixIdent = normalizeText(row.fix_ident)
  if (fixIdent) {
    return fixIdent
  }

  const arincName = normalizeText(row.arinc_name)
  if (arincName) {
    return arincName
  }

  return `Procedure ${row.approach_id}`
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

function normalizeRunwayName(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? ''
  if (!normalized) return null
  const stripped = normalized.replace(/^RWY\s*/u, '').replace(/^RUNWAY\s*/u, '').trim()
  return stripped || null
}

function normalizeProcedureToken(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? ''
  return normalized || null
}

function extractProceduresFromRoute(routeText: string): {
  departureProcedureName: string | null
  arrivalProcedureName: string | null
} {
  const tokens = routeText
    .split(/\s+/u)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .filter((token) => token !== 'DCT' && token !== 'DIRECT')
  const procedureTokens = tokens.filter(isProcedureToken)

  return {
    departureProcedureName: procedureTokens[0] ?? null,
    arrivalProcedureName: procedureTokens.length > 1 ? procedureTokens[procedureTokens.length - 1] : null
  }
}

function isProcedureToken(token: string): boolean {
  if (token.length < 4) return false
  if (!/[0-9]/u.test(token)) return false
  if (isAirwayToken(token)) return false
  if (/^\d{4}[NS]\d{5}[EW]$/u.test(token)) return false
  if (/^[A-Z]{1,2}\d{1,3}$/u.test(token)) return false
  return /^[A-Z0-9]+$/u.test(token)
}

function isAirwayToken(token: string): boolean {
  return /^(?:[A-Z]{1,3}\d+[A-Z]?|N\d+|Q\d+|T\d+|V\d+|J\d+|Y\d+|UL\d+|UM\d+|UY\d+|UT\d+)$/u.test(token)
}
