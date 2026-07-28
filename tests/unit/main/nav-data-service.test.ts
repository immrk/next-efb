import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSettings } from '../../helpers/factories'
import { NavDataService } from '../../../src/main/services/navigation/NavDataService'

describe('NavDataService', () => {
  let root: string
  let dbPath: string
  let service: NavDataService

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nextefb-nav-'))
    dbPath = join(root, 'nav.sqlite')
    createNavigationFixture(dbPath)
    service = new NavDataService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 50
    })
  })

  it('reports missing and manually configured navigation databases', () => {
    const missing = service.getStatus(
      createSettings({ navData: { sqlitePath: join(root, 'missing.sqlite'), autoDetect: false } })
    )
    expect(missing).toMatchObject({
      configuredPath: join(root, 'missing.sqlite'),
      activePath: null,
      exists: false,
      source: 'none'
    })

    const manual = service.getStatus(
      createSettings({ navData: { sqlitePath: dbPath, autoDetect: false } })
    )
    expect(manual).toMatchObject({
      configuredPath: dbPath,
      activePath: dbPath,
      exists: true,
      source: 'manual'
    })
  })

  it('searches airports and clamps result limits', () => {
    const settings = navSettings(dbPath)
    expect(service.searchAirports(settings, 'zbaa')).toEqual([
      {
        ident: 'ZBAA',
        name: 'Beijing Capital',
        city: 'Beijing',
        country: 'CN',
        lat: 40.08,
        lon: 116.58
      }
    ])
    expect(service.searchAirports(settings, '  ')).toEqual([])
    expect(service.searchAirports(createSettings(), 'ZBAA')).toEqual([])
  })

  it('loads runways, procedures, approaches and transitions', () => {
    const result = service.getAirportProcedures(navSettings(dbPath), 'zbaa')

    expect(result.airport?.ident).toBe('ZBAA')
    expect(result.runways.map((runway) => runway.name)).toEqual(['18L', '36R'])
    expect(result.departures).toEqual([
      expect.objectContaining({ id: 'approach:1', name: 'PEK1D', procedureType: 'departure' })
    ])
    expect(result.arrivals).toEqual([
      expect.objectContaining({ id: 'approach:2', name: 'PEK1A', procedureType: 'arrival' })
    ])
    expect(result.approaches).toEqual([
      expect.objectContaining({ id: 'approach:3', name: 'ILS Z 36R', procedureType: 'approach' })
    ])
    expect(result.transitions).toEqual([
      expect.objectContaining({
        id: 'transition:31',
        approachId: 3,
        runwayName: '36R'
      })
    ])
    expect(service.getAirportProcedures(navSettings(dbPath), 'missing').airport).toBeNull()
  })

  it('builds a route, resolves fixes and reports unresolved tokens', () => {
    const result = service.buildFlightPlan(navSettings(dbPath), {
      departureAirport: 'zbaa',
      destinationAirport: 'zspd',
      enrouteText: 'DCT FIX1 UNKNOWN',
      departureRunway: '36R',
      departureProcedureId: null,
      arrivalRunway: null,
      arrivalProcedureId: null,
      approachProcedureId: 'approach:3',
      arrivalTransitionId: 'transition:31'
    })

    expect(result.points.map((point) => point.ident)).toEqual([
      'RWY 36R',
      'FIX1',
      'TRANS1',
      'AP1',
      'AP2',
      'ZSPD',
      'MISSED'
    ])
    expect(result.unresolvedTokens).toEqual(['UNKNOWN'])
    expect(result.segments.map((segment) => segment.phase)).toEqual([
      'enroute',
      'approach',
      'missed'
    ])
    expect(result.segments.at(-1)).toMatchObject({ phase: 'missed', dashed: true })
    expect(result.summary).toContain('ZBAA -> ZSPD')
  })

  it('queries visible map layers and searches points by relevance', () => {
    const settings = navSettings(dbPath)
    const features = service.getMapFeatures(settings, {
      viewport: {
        north: 42,
        south: 29,
        west: 110,
        east: 123,
        zoom: 10
      },
      layers: {
        airports: true,
        waypoints: true,
        vors: true,
        ndbs: true,
        airways: true
      }
    })

    expect(features.airports.map((feature) => feature.ident)).toEqual(['ZSPD', 'ZBAA'])
    expect(features.waypoints.map((feature) => feature.ident)).toContain('FIX1')
    expect(features.vors[0]).toMatchObject({ ident: 'PEK', frequency: 113.6 })
    expect(features.ndbs[0]).toMatchObject({ ident: 'PK', frequency: 345 })
    expect(features.airways[0]).toMatchObject({ name: 'A1', airwayType: 'high' })
    expect(features.overflow).toEqual({
      airports: false,
      waypoints: false,
      vors: false,
      ndbs: false,
      airways: false
    })

    const search = service.searchMapPoints(settings, {
      query: 'PEK',
      types: ['airports', 'waypoints', 'vors', 'ndbs'],
      limit: 3
    })
    expect(search[0]).toMatchObject({ type: 'vors', ident: 'PEK' })
    expect(service.searchMapPoints(settings, { query: '', types: ['airports'] })).toEqual([])
    expect(
      service.getMapFeatures(settings, {
        viewport: { north: 10, south: 20, west: 0, east: 1, zoom: 5 },
        layers: {
          airports: true,
          waypoints: true,
          vors: true,
          ndbs: true,
          airways: true
        }
      }).airports
    ).toEqual([])
  })

  it('imports and normalizes a SimBrief flight plan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            origin: { icao_code: 'zbaa', plan_rwy: 'RWY 36R' },
            destination: {
              icao_code: 'zspd',
              plan_rwy: 'runway 17l',
              approach: 'ils17l',
              transition: 'sas1'
            },
            alternate: { icao_code: 'zsss' },
            general: {
              route: 'pek1d dct fix1 sas1a',
              sid_ident: 'pek1d',
              star_ident: 'sas1a',
              flight_number: '1106',
              callsign: 'CXA1106',
              initial_altitude: '25600',
              route_distance: '561'
            },
            aircraft: { icaocode: 'B737', reg: 'N714SB' },
            times: { sched_out: '1785200700', est_time_enroute: '5340' },
            params: { units: 'kgs', airac: '2503' },
            fuel: { enroute_burn: '4054', plan_ramp: '7127' },
            weights: { pax_count: '148', est_tow: '60496' },
            text: {
              plan_html: '<pre>[ OFP ]<br>SIMBRIEF&nbsp;OFP<br>FINAL LINE</pre>'
            }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
    )

    await expect(service.importFromSimBrief({ username: ' pilot ' })).resolves.toMatchObject({
      departureAirport: 'ZBAA',
      destinationAirport: 'ZSPD',
      alternateAirport: 'ZSSS',
      routeText: 'PEK1D DCT FIX1 SAS1A',
      departureRunway: '36R',
      arrivalRunway: '17L',
      departureProcedureName: 'PEK1D',
      arrivalProcedureName: 'SAS1A',
      approachProcedureName: 'ILS17L',
      arrivalTransitionName: 'SAS1',
      source: 'simbrief',
      details: {
        flightNumber: '1106',
        callsign: 'CXA1106',
        aircraftType: 'B737',
        registration: 'N714SB',
        scheduledOut: '1785200700',
        airTimeSeconds: '5340',
        initialAltitude: '25600',
        routeDistance: '561',
        airacCycle: '2503',
        units: 'kgs',
        enrouteBurn: '4054',
        blockFuel: '7127',
        passengerCount: '148',
        estimatedTow: '60496',
        briefingText: '[ OFP ]\nSIMBRIEF OFP\nFINAL LINE'
      }
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('username=pilot')
    )
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('json=v2'))
  })

  it('validates SimBrief input, HTTP status and required fields', async () => {
    await expect(service.importFromSimBrief({})).rejects.toThrow(
      'SIMBRIEF_USERNAME_REQUIRED'
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    await expect(service.importFromSimBrief({ userId: '123' })).rejects.toThrow(
      'SIMBRIEF_HTTP_500'
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ general: { route: 'DCT' } }), { status: 200 })
      )
    )
    await expect(service.importFromSimBrief({ username: 'pilot' })).rejects.toThrow(
      'SIMBRIEF_PARSE_FAILED'
    )
  })
})

function navSettings(dbPath: string) {
  return createSettings({
    navData: {
      sqlitePath: dbPath,
      autoDetect: false
    }
  })
}

function createNavigationFixture(filePath: string): void {
  const db = new Database(filePath)
  db.exec(`
    CREATE TABLE airport (
      airport_id INTEGER PRIMARY KEY,
      ident TEXT NOT NULL,
      name TEXT,
      city TEXT,
      country TEXT,
      laty REAL NOT NULL,
      lonx REAL NOT NULL,
      bottom_laty REAL NOT NULL,
      top_laty REAL NOT NULL,
      type INTEGER,
      longest_runway_length REAL,
      num_approach INTEGER
    );
    CREATE TABLE runway_end (
      runway_end_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      heading REAL,
      is_takeoff INTEGER,
      is_landing INTEGER,
      laty REAL,
      lonx REAL
    );
    CREATE TABLE runway (
      runway_id INTEGER PRIMARY KEY,
      airport_id INTEGER NOT NULL,
      primary_end_id INTEGER,
      secondary_end_id INTEGER,
      length REAL,
      width REAL,
      surface TEXT
    );
    CREATE TABLE approach (
      approach_id INTEGER PRIMARY KEY,
      airport_ident TEXT NOT NULL,
      runway_end_id INTEGER,
      runway_name TEXT,
      type TEXT NOT NULL,
      suffix TEXT,
      arinc_name TEXT,
      fix_ident TEXT,
      fix_region TEXT,
      altitude REAL
    );
    CREATE TABLE transition (
      transition_id INTEGER PRIMARY KEY,
      approach_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      fix_ident TEXT,
      fix_region TEXT,
      dme_ident TEXT,
      dme_region TEXT,
      dme_distance REAL,
      dme_radial REAL
    );
    CREATE TABLE approach_leg (
      approach_leg_id INTEGER PRIMARY KEY,
      approach_id INTEGER NOT NULL,
      fix_ident TEXT,
      fix_laty REAL,
      fix_lonx REAL,
      is_missed INTEGER
    );
    CREATE TABLE waypoint (
      waypoint_id INTEGER PRIMARY KEY,
      ident TEXT NOT NULL,
      type TEXT,
      airport_ident TEXT,
      region TEXT,
      laty REAL NOT NULL,
      lonx REAL NOT NULL
    );
    CREATE TABLE vor (
      vor_id INTEGER PRIMARY KEY,
      ident TEXT,
      type TEXT,
      frequency REAL,
      airport_ident TEXT,
      region TEXT,
      laty REAL NOT NULL,
      lonx REAL NOT NULL
    );
    CREATE TABLE ndb (
      ndb_id INTEGER PRIMARY KEY,
      ident TEXT,
      type TEXT,
      frequency REAL,
      airport_ident TEXT,
      region TEXT,
      laty REAL NOT NULL,
      lonx REAL NOT NULL
    );
    CREATE TABLE airway (
      airway_id INTEGER PRIMARY KEY,
      airway_name TEXT NOT NULL,
      airway_type TEXT NOT NULL,
      from_lonx REAL NOT NULL,
      from_laty REAL NOT NULL,
      to_lonx REAL NOT NULL,
      to_laty REAL NOT NULL,
      right_lonx REAL NOT NULL,
      left_lonx REAL NOT NULL,
      bottom_laty REAL NOT NULL,
      top_laty REAL NOT NULL
    );

    INSERT INTO airport VALUES
      (1, 'ZBAA', 'Beijing Capital', 'Beijing', 'CN', 40.08, 116.58, 40.0, 40.2, 1, 12500, 3),
      (2, 'ZSPD', 'Shanghai Pudong', 'Shanghai', 'CN', 31.14, 121.80, 31.0, 31.3, 1, 13100, 2);
    INSERT INTO runway_end VALUES
      (11, '36R', 360, 1, 1, 40.07, 116.59),
      (12, '18L', 180, 1, 1, 40.10, 116.57);
    INSERT INTO runway VALUES
      (21, 1, 11, 12, 3800, 60, 'CONCRETE');
    INSERT INTO approach VALUES
      (1, 'ZBAA', 11, '36R', 'GPS', 'D', 'PEK1D', 'PEK1D', 'CN', 3000),
      (2, 'ZBAA', 11, '36R', 'GPS', 'A', 'PEK1A', 'PEK1A', 'CN', 3000),
      (3, 'ZBAA', 11, '36R', 'ILS', 'Z', 'I36RZ', 'AP1', 'CN', 2500);
    INSERT INTO transition VALUES
      (31, 3, 'FULL', 'TRANS1', 'CN', NULL, NULL, NULL, NULL);
    INSERT INTO approach_leg VALUES
      (1, 3, 'AP1', 35.0, 119.0, 0),
      (2, 3, 'AP2', 33.0, 120.5, 0),
      (3, 3, 'MISSED', 32.5, 121.0, 1);
    INSERT INTO waypoint VALUES
      (101, 'FIX1', 'WAYPOINT', NULL, 'CN', 38.0, 117.0),
      (102, 'TRANS1', 'WAYPOINT', NULL, 'CN', 36.0, 118.5),
      (103, 'PEK1D', 'WAYPOINT', NULL, 'CN', 39.0, 116.8),
      (104, 'PEK1A', 'WAYPOINT', NULL, 'CN', 39.5, 116.9);
    INSERT INTO vor VALUES
      (201, 'PEK', 'VOR-DME', 113.6, NULL, 'CN', 40.0, 116.6);
    INSERT INTO ndb VALUES
      (301, 'PK', 'NDB', 345, NULL, 'CN', 39.9, 116.7);
    INSERT INTO airway VALUES
      (401, 'A1', 'high', 116.5, 40.0, 121.8, 31.1, 121.8, 116.5, 31.1, 40.0);
  `)
  db.close()
}
