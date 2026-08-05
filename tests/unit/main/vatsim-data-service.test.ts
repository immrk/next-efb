import { describe, expect, it, vi } from 'vitest'
import type { NavMapFeatureCollection } from '@shared/nav-map-types'
import { createSettings } from '../../helpers/factories'
import { NavDataService } from '../../../src/main/services/navigation/NavDataService'
import { VatsimDataService } from '../../../src/main/services/vatsim/VatsimDataService'

const NOW = Date.parse('2026-08-01T17:00:00.000Z')
const ALL_LAYERS = {
  pilots: true,
  controllers: true,
  controllerCoverage: true,
  atis: true,
  weather: true,
  labels: true
}

describe('VatsimDataService', () => {
  it('normalizes the live feeds, locates controllers and parses visible METARs', async () => {
    const navDataService = createNavDataService()
    const fetchImpl = createFetchMock()
    const service = new VatsimDataService({
      navDataService,
      getSettings: () => createSettings(),
      fetchImpl,
      now: () => NOW
    })

    await expect(service.refreshNow()).resolves.toMatchObject({
      phase: 'ready',
      revision: 1,
      counts: { pilots: 2, controllers: 1, atis: 1, connectedClients: 4 }
    })
    expect(service.searchPilots({ query: 'dal' })).toMatchObject([{ callsign: 'DAL1' }])
    expect(service.searchPilots({ query: '1001' })).toMatchObject([{ callsign: 'DAL1' }])
    expect(service.searchPilots({ query: 'John' })).toMatchObject([{ callsign: 'DAL1' }])
    expect(service.searchPilots({ query: 'KJFK' })).toMatchObject([{ callsign: 'DAL1' }])
    expect(service.searchPilots({ query: '' })).toEqual([])

    const result = await service.getMapFeatures({
      viewport: { north: 41, south: 40, east: -73, west: -75, zoom: 9 },
      layers: ALL_LAYERS
    })

    expect(result.pilots).toHaveLength(1)
    expect(result.pilots[0]).toMatchObject({
      callsign: 'DAL1',
      altitudeFt: 12000,
      groundSpeedKts: 420,
      flightPlan: { departure: 'KJFK', arrival: 'EGLL' }
    })
    expect(result.controllers[0]).toMatchObject({
      callsign: 'JFK_GND',
      lat: 40.642445,
      lon: -73.781358,
      frequencies: ['121.900']
    })
    expect(result.atis[0]).toMatchObject({
      callsign: 'KJFK_ATIS',
      airportIdent: 'KJFK',
      frequency: '128.725',
      atisCode: 'A'
    })
    expect(result.weather[0]).toMatchObject({
      airportIdent: 'KJFK',
      flightCategory: 'IFR',
      windDirectionDeg: 180,
      windSpeedKts: 12,
      windGustKts: 20,
      visibilitySm: 2,
      ceilingFt: 800,
      qnhHpa: 1013
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://metar.vatsim.net/KJFK?format=json',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('clusters pilots at a low zoom and filters features outside the viewport', async () => {
    const service = new VatsimDataService({
      navDataService: createNavDataService(),
      getSettings: () => createSettings(),
      fetchImpl: createFetchMock(),
      now: () => NOW
    })
    await service.refreshNow()

    const lowZoom = await service.getMapFeatures({
      viewport: { north: 90, south: -90, east: 180, west: -180, zoom: 3 },
      layers: { ...ALL_LAYERS, weather: false }
    })
    expect(lowZoom.pilots).toEqual([])
    expect(lowZoom.pilotClusters.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(2)

    const mediumZoom = await service.getMapFeatures({
      viewport: { north: 90, south: -90, east: 180, west: -180, zoom: 6 },
      layers: { ...ALL_LAYERS, weather: false }
    })
    expect(mediumZoom.pilots).toEqual([])
    expect(mediumZoom.pilotClusters.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(2)

    const europe = await service.getMapFeatures({
      viewport: { north: 55, south: 48, east: 10, west: 0, zoom: 9 },
      layers: { ...ALL_LAYERS, weather: false }
    })
    expect(europe.pilots).toEqual([])
    expect(europe.controllers).toEqual([])
    expect(europe.atis).toEqual([])
  })

  it('keeps the last good snapshot and reports stale when a refresh fails', async () => {
    let fail = false
    let now = NOW
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (fail && String(input).includes('vatsim-data.json')) {
        throw new Error('offline')
      }
      return createFetchResponse(input)
    })
    const service = new VatsimDataService({
      navDataService: createNavDataService(),
      getSettings: () => createSettings(),
      fetchImpl,
      now: () => now
    })
    await service.refreshNow()
    fail = true
    now += 31_000

    await expect(service.refreshNow()).resolves.toMatchObject({
      phase: 'stale',
      lastError: 'offline',
      counts: { pilots: 2 }
    })
    const cached = await service.getMapFeatures({
      viewport: { north: 41, south: 40, east: -73, west: -75, zoom: 9 },
      layers: { ...ALL_LAYERS, weather: false }
    })
    expect(cached.pilots).toHaveLength(1)
  })

  it('rejects malformed v3 snapshots without exposing partial data', async () => {
    const service = new VatsimDataService({
      navDataService: createNavDataService(),
      getSettings: () => createSettings(),
      fetchImpl: vi.fn(async () => jsonResponse({ general: { version: 2 } })),
      now: () => NOW
    })

    await expect(service.refreshNow()).resolves.toMatchObject({
      phase: 'error',
      counts: { pilots: 0, controllers: 0, atis: 0 }
    })
  })
})

function createNavDataService(): NavDataService {
  const empty: NavMapFeatureCollection = {
    airports: [{
      id: 1,
      ident: 'KJFK',
      name: 'John F. Kennedy International',
      type: 1,
      lat: 40.6413,
      lon: -73.7781,
      longestRunwayLengthFt: 14572,
      numApproach: 8
    }],
    waypoints: [],
    vors: [],
    ndbs: [],
    airways: [],
    overflow: { airports: false, waypoints: false, vors: false, ndbs: false, airways: false },
    fetchedAt: NOW
  }
  return {
    getMapFeatures: vi.fn(() => empty)
  } as unknown as NavDataService
}

function createFetchMock() {
  return vi.fn((input: string | URL | Request) => createFetchResponse(input))
}

function createFetchResponse(input: string | URL | Request): Promise<Response> {
  const url = String(input)
  if (url.includes('vatsim-data.json')) return Promise.resolve(jsonResponse(createFeed()))
  if (url.includes('transceivers-data.json')) {
    return Promise.resolve(jsonResponse([{
      callsign: 'JFK_GND',
      transceivers: [{ frequency: 121900000, latDeg: 40.642445, lonDeg: -73.781358 }]
    }]))
  }
  if (url.includes('afv-atis-data.json')) {
    return Promise.resolve(jsonResponse([{
      cid: 3001,
      callsign: 'KJFK_ATIS',
      frequency: '128.725',
      latitude: 40.6413,
      longitude: -73.7781,
      atis_code: 'A',
      text_atis: ['KJFK ATIS INFO A']
    }]))
  }
  if (url.includes('metar.vatsim.net')) {
    return Promise.resolve(jsonResponse([{
      id: 'KJFK',
      metar: 'KJFK 011651Z 18012G20KT 2SM BKN008 OVC020 20/18 A2992'
    }]))
  }
  return Promise.resolve(new Response('', { status: 404 }))
}

function createFeed() {
  return {
    general: {
      version: 3,
      update_timestamp: '2026-08-01T16:59:45.000Z',
      connected_clients: 4
    },
    pilots: [
      {
        cid: 1001,
        name: 'John Pilot',
        callsign: 'DAL1',
        latitude: 40.7,
        longitude: -73.8,
        altitude: 12000,
        groundspeed: 420,
        heading: 83,
        transponder: '3456',
        flight_plan: {
          flight_rules: 'I',
          aircraft: 'B764/H',
          departure: 'KJFK',
          arrival: 'EGLL',
          altitude: '35000',
          route: 'GREKI DCT JUDDS'
        }
      },
      {
        cid: 1002,
        callsign: 'BAW2',
        latitude: 51.47,
        longitude: -0.45,
        altitude: 6000,
        groundspeed: 240,
        heading: 270
      }
    ],
    controllers: [{
      cid: 2001,
      callsign: 'JFK_GND',
      frequency: '121.900',
      facility: 3,
      visual_range: 20,
      text_atis: ['Kennedy Ground']
    }],
    atis: []
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}
