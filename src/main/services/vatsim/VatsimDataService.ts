import type { AppSettings } from '@shared/types'
import type { NavMapAirportFeature, NavMapViewport } from '@shared/nav-map-types'
import type {
  VatsimAtisFeature,
  VatsimConnectionPhase,
  VatsimControllerFeature,
  VatsimFlightCategory,
  VatsimFlightPlanSummary,
  VatsimMapFeatureCollection,
  VatsimMapQueryInput,
  VatsimMetarFeature,
  VatsimPilotClusterFeature,
  VatsimPilotFeature,
  VatsimPilotSearchInput,
  VatsimStatus,
  VatsimStatusCounts
} from '@shared/vatsim-types'
import { NavDataService } from '../navigation/NavDataService'

const DATA_URL = 'https://data.vatsim.net/v3/vatsim-data.json'
const TRANSCEIVERS_URL = 'https://data.vatsim.net/v3/transceivers-data.json'
const AFV_ATIS_URL = 'https://data.vatsim.net/v3/afv-atis-data.json'
const METAR_BASE_URL = 'https://metar.vatsim.net'

const DATA_REFRESH_MS = 30_000
const TRANSCEIVER_REFRESH_MS = 5 * 60_000
const METAR_CACHE_MS = 10 * 60_000
const REQUEST_TIMEOUT_MS = 15_000
const STALE_AFTER_MS = 90_000
const MAX_RETRY_MS = 3 * 60_000
const MAX_PILOTS = 1_200
const MAX_CONTROLLERS = 300
const MAX_ATIS = 180
const MAX_WEATHER_AIRPORTS = 80

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type StatusListener = (status: VatsimStatus) => void

interface VatsimDataServiceOptions {
  navDataService: NavDataService
  getSettings: () => AppSettings
  fetchImpl?: FetchLike
  now?: () => number
}

interface TransceiverPoint {
  lat: number
  lon: number
  frequency: string | null
}

interface MetarCacheEntry {
  fetchedAt: number
  report: ParsedMetar | null
}

interface ParsedMetar {
  airportIdent: string
  rawMetar: string
  flightCategory: VatsimFlightCategory
  observedAt: number | null
  windDirectionDeg: number | null
  windSpeedKts: number | null
  windGustKts: number | null
  visibilitySm: number | null
  ceilingFt: number | null
  qnhHpa: number | null
}

interface ParsedFeed {
  feedUpdatedAt: number
  connectedClients: number
  pilots: Array<Record<string, unknown>>
  controllers: Array<Record<string, unknown>>
  atis: Array<Record<string, unknown>>
}

export class VatsimDataService {
  private readonly navDataService: NavDataService
  private readonly getSettings: () => AppSettings
  private readonly fetchImpl: FetchLike
  private readonly now: () => number
  private readonly listeners = new Set<StatusListener>()
  private readonly transceivers = new Map<string, TransceiverPoint[]>()
  private readonly metarCache = new Map<string, MetarCacheEntry>()

  private pilots: VatsimPilotFeature[] = []
  private controllers: VatsimControllerFeature[] = []
  private atis: VatsimAtisFeature[] = []
  private phase: VatsimConnectionPhase = 'connecting'
  private counts: VatsimStatusCounts = emptyCounts()
  private revision = 0
  private fetchedAt: number | null = null
  private feedUpdatedAt: number | null = null
  private nextRefreshAt: number | null = null
  private lastError: string | null = null
  private lastTransceiverFetchAt = 0
  private retryCount = 0
  private running = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private refreshPromise: Promise<VatsimStatus> | null = null

  constructor(options: VatsimDataServiceOptions) {
    this.navDataService = options.navDataService
    this.getSettings = options.getSettings
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? Date.now
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.runScheduledRefresh()
  }

  stop(): void {
    this.running = false
    this.nextRefreshAt = null
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  onChanged(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): VatsimStatus {
    const now = this.now()
    const phase =
      this.fetchedAt && now - this.fetchedAt > STALE_AFTER_MS && this.phase === 'ready'
        ? 'stale'
        : this.phase

    return {
      phase,
      revision: this.revision,
      fetchedAt: this.fetchedAt,
      feedUpdatedAt: this.feedUpdatedAt,
      nextRefreshAt: this.nextRefreshAt,
      lastError: this.lastError,
      counts: { ...this.counts }
    }
  }

  refreshNow(): Promise<VatsimStatus> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = this.refreshInternal().finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  searchPilots(input: VatsimPilotSearchInput): VatsimPilotFeature[] {
    const query = typeof input?.query === 'string'
      ? input.query.trim().toUpperCase().slice(0, 80)
      : ''
    if (!query) return []

    const limit = clamp(
      typeof input.limit === 'number' && Number.isFinite(input.limit) ? Math.floor(input.limit) : 12,
      1,
      30
    )
    return this.pilots
      .map((pilot) => ({ pilot, score: scorePilotSearch(pilot, query) }))
      .filter((entry) => entry.score !== null)
      .sort((left, right) => (left.score ?? 0) - (right.score ?? 0)
        || left.pilot.callsign.localeCompare(right.pilot.callsign))
      .slice(0, limit)
      .map((entry) => entry.pilot)
  }

  async getMapFeatures(input: VatsimMapQueryInput): Promise<VatsimMapFeatureCollection> {
    const normalized = normalizeMapQuery(input)
    if (!normalized) {
      return emptyFeatureCollection(this.getStatus(), this.now())
    }

    const { viewport, layers } = normalized
    const visiblePilots = layers.pilots
      ? this.pilots.filter((pilot) => pointInViewport(pilot.lat, pilot.lon, viewport))
      : []

    let pilots: VatsimPilotFeature[] = []
    let pilotClusters: VatsimPilotClusterFeature[] = []
    let pilotOverflow = false
    if (layers.pilots && viewport.zoom < 7) {
      pilotClusters = clusterPilots(visiblePilots, viewport.zoom)
    } else if (layers.pilots) {
      pilotOverflow = visiblePilots.length > MAX_PILOTS
      pilots = visiblePilots.slice(0, MAX_PILOTS)
    }

    const visibleControllers = layers.controllers
      ? this.controllers.filter((controller) =>
          circleIntersectsViewport(
            controller.lat,
            controller.lon,
            layers.controllerCoverage ? controller.coverageRadiusNm : 0,
            viewport
          )
        )
      : []
    const controllerOverflow = visibleControllers.length > MAX_CONTROLLERS
    const controllers = visibleControllers.slice(0, MAX_CONTROLLERS)

    const visibleAtis = layers.atis
      ? this.atis.filter((station) => pointInViewport(station.lat, station.lon, viewport))
      : []
    const atisOverflow = visibleAtis.length > MAX_ATIS
    const atis = visibleAtis.slice(0, MAX_ATIS)

    const weather = layers.weather && viewport.zoom >= 6
      ? await this.getWeatherForViewport(viewport)
      : []

    return {
      pilots,
      pilotClusters,
      controllers,
      atis,
      weather: weather.slice(0, MAX_WEATHER_AIRPORTS),
      overflow: {
        pilots: pilotOverflow,
        controllers: controllerOverflow,
        atis: atisOverflow,
        weather: weather.length > MAX_WEATHER_AIRPORTS
      },
      status: this.getStatus(),
      fetchedAt: this.now()
    }
  }

  private async runScheduledRefresh(): Promise<void> {
    await this.refreshNow()
    if (!this.running) return

    const delay = this.retryCount > 0
      ? Math.min(MAX_RETRY_MS, DATA_REFRESH_MS * 2 ** (this.retryCount - 1))
      : DATA_REFRESH_MS
    this.nextRefreshAt = this.now() + delay
    this.timer = setTimeout(() => {
      this.timer = null
      void this.runScheduledRefresh()
    }, delay)
    this.emitChanged()
  }

  private async refreshInternal(): Promise<VatsimStatus> {
    if (this.fetchedAt === null) {
      this.phase = 'connecting'
      this.emitChanged()
    }

    try {
      const now = this.now()
      const needsTransceivers =
        this.transceivers.size === 0 || now - this.lastTransceiverFetchAt >= TRANSCEIVER_REFRESH_MS
      const feedPromise = this.fetchJson(DATA_URL)
      const transceiverPromise = needsTransceivers
        ? this.fetchJson(TRANSCEIVERS_URL).catch(() => null)
        : Promise.resolve(null)
      const atisPromise = this.fetchJson(AFV_ATIS_URL).catch(() => null)
      const [feedPayload, transceiverPayload, atisPayload] = await Promise.all([
        feedPromise,
        transceiverPromise,
        atisPromise
      ])

      if (transceiverPayload) {
        this.replaceTransceivers(transceiverPayload)
        this.lastTransceiverFetchAt = now
      }

      const feed = parseFeed(feedPayload)
      if (this.feedUpdatedAt === null || feed.feedUpdatedAt > this.feedUpdatedAt) {
        this.pilots = feed.pilots
          .map(normalizePilot)
          .filter((pilot): pilot is VatsimPilotFeature => pilot !== null)
        this.controllers = feed.controllers
          .map((controller) => normalizeController(controller, this.transceivers))
          .filter((controller): controller is VatsimControllerFeature => controller !== null)

        const atisSource = Array.isArray(atisPayload) ? atisPayload : feed.atis
        this.atis = atisSource
          .map((station) => normalizeAtis(asRecord(station), this.transceivers))
          .filter((station): station is VatsimAtisFeature => station !== null)
        this.feedUpdatedAt = feed.feedUpdatedAt
        this.counts = {
          pilots: this.pilots.length,
          controllers: feed.controllers.length,
          atis: this.atis.length,
          connectedClients: feed.connectedClients
        }
        this.revision += 1
      }

      this.fetchedAt = now
      this.phase = 'ready'
      this.lastError = null
      this.retryCount = 0
    } catch (error) {
      this.retryCount += 1
      this.phase = this.fetchedAt === null ? 'error' : 'stale'
      this.lastError = formatError(error)
    }

    this.emitChanged()
    return this.getStatus()
  }

  private async fetchJson(url: string): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NextEFB VATSIM data client'
        },
        signal: controller.signal
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.json()
    } finally {
      clearTimeout(timeout)
    }
  }

  private replaceTransceivers(payload: unknown): void {
    if (!Array.isArray(payload)) return
    const next = new Map<string, TransceiverPoint[]>()

    for (const item of payload) {
      const entry = asRecord(item)
      const callsign = asString(entry.callsign)?.toUpperCase()
      if (!callsign || !Array.isArray(entry.transceivers)) continue

      const points = entry.transceivers
        .map((value): TransceiverPoint | null => {
          const transceiver = asRecord(value)
          const lat = asFiniteNumber(transceiver.latDeg)
          const lon = asFiniteNumber(transceiver.lonDeg)
          if (lat === null || lon === null || !isCoordinateValid(lat, lon)) return null
          const frequencyHz = asFiniteNumber(transceiver.frequency)
          return {
            lat,
            lon,
            frequency: frequencyHz === null ? null : formatFrequency(frequencyHz / 1_000_000)
          }
        })
        .filter((point): point is TransceiverPoint => point !== null)

      if (points.length > 0) next.set(callsign, points)
    }

    this.transceivers.clear()
    next.forEach((points, callsign) => this.transceivers.set(callsign, points))
  }

  private async getWeatherForViewport(viewport: NavMapViewport): Promise<VatsimMetarFeature[]> {
    const airports = this.navDataService.getMapFeatures(this.getSettings(), {
      viewport,
      layers: {
        airports: true,
        waypoints: false,
        vors: false,
        ndbs: false,
        airways: false
      }
    }).airports.slice(0, MAX_WEATHER_AIRPORTS)

    if (airports.length === 0) return []
    await this.loadMetars(airports.map((airport) => airport.ident))

    return airports.flatMap((airport) => {
      const report = this.metarCache.get(airport.ident.toUpperCase())?.report
      return report ? [toMetarFeature(airport, report)] : []
    })
  }

  private async loadMetars(idents: string[]): Promise<void> {
    const now = this.now()
    const missing = Array.from(new Set(idents.map((ident) => ident.trim().toUpperCase())))
      .filter((ident) => /^[A-Z0-9]{3,4}$/.test(ident))
      .filter((ident) => {
        const cached = this.metarCache.get(ident)
        return !cached || now - cached.fetchedAt >= METAR_CACHE_MS
      })

    if (missing.length === 0) return
    const chunks = chunk(missing, 40)
    await Promise.all(chunks.map(async (identChunk) => {
      try {
        const payload = await this.fetchJson(
          `${METAR_BASE_URL}/${identChunk.join(',')}?format=json`
        )
        const found = new Set<string>()
        if (Array.isArray(payload)) {
          for (const value of payload) {
            const entry = asRecord(value)
            const ident = asString(entry.id)?.trim().toUpperCase()
            const rawMetar = asString(entry.metar)?.trim()
            if (!ident || !rawMetar) continue
            found.add(ident)
            this.metarCache.set(ident, {
              fetchedAt: now,
              report: parseMetar(ident, rawMetar, now)
            })
          }
        }
        identChunk.forEach((ident) => {
          if (!found.has(ident)) this.metarCache.set(ident, { fetchedAt: now, report: null })
        })
      } catch {
        // Weather is an optional overlay. Keep stale cached reports when a batch fails.
      }
    }))
  }

  private emitChanged(): void {
    const status = this.getStatus()
    this.listeners.forEach((listener) => listener(status))
  }
}

function parseFeed(payload: unknown): ParsedFeed {
  const root = asRecord(payload)
  const general = asRecord(root.general)
  const version = asFiniteNumber(general.version)
  const updateTimestamp = asString(general.update_timestamp)
  const feedUpdatedAt = updateTimestamp ? Date.parse(updateTimestamp) : Number.NaN
  if (version !== 3 || !Number.isFinite(feedUpdatedAt)) {
    throw new Error('Invalid VATSIM v3 data feed')
  }

  return {
    feedUpdatedAt,
    connectedClients: asFiniteNumber(general.connected_clients) ?? 0,
    pilots: asRecordArray(root.pilots),
    controllers: asRecordArray(root.controllers),
    atis: asRecordArray(root.atis)
  }
}

function normalizePilot(record: Record<string, unknown>): VatsimPilotFeature | null {
  const callsign = asString(record.callsign)?.trim().toUpperCase()
  const cid = asFiniteNumber(record.cid)
  const lat = asFiniteNumber(record.latitude)
  const lon = asFiniteNumber(record.longitude)
  if (!callsign || cid === null || lat === null || lon === null || !isCoordinateValid(lat, lon)) return null

  const altitudeFt = Math.round(asFiniteNumber(record.altitude) ?? 0)
  const groundSpeedKts = Math.max(0, Math.round(asFiniteNumber(record.groundspeed) ?? 0))
  const headingDeg = normalizeHeading(asFiniteNumber(record.heading) ?? 0)
  const flightPlanRecord = asNullableRecord(record.flight_plan)

  return {
    kind: 'pilot',
    id: `${Math.trunc(cid)}:${callsign}`,
    callsign,
    name: cleanString(record.name),
    lat,
    lon,
    altitudeFt,
    groundSpeedKts,
    headingDeg,
    transponder: asString(record.transponder),
    onGround: groundSpeedKts < 30,
    flightPlan: flightPlanRecord ? normalizeFlightPlan(flightPlanRecord) : null,
    logonTime: parseDate(record.logon_time),
    lastUpdated: parseDate(record.last_updated)
  }
}

function normalizeFlightPlan(record: Record<string, unknown>): VatsimFlightPlanSummary {
  return {
    flightRules: cleanString(record.flight_rules),
    aircraft: cleanString(record.aircraft_short) ?? cleanString(record.aircraft),
    departure: cleanString(record.departure),
    arrival: cleanString(record.arrival),
    alternate: cleanString(record.alternate),
    cruiseAltitude: cleanString(record.altitude),
    route: cleanLongString(record.route),
    remarks: cleanLongString(record.remarks)
  }
}

function normalizeController(
  record: Record<string, unknown>,
  transceivers: Map<string, TransceiverPoint[]>
): VatsimControllerFeature | null {
  const callsign = asString(record.callsign)?.trim().toUpperCase()
  const cid = asFiniteNumber(record.cid)
  if (!callsign || cid === null) return null
  const points = transceivers.get(callsign) ?? []
  const directLat = asFiniteNumber(record.latitude)
  const directLon = asFiniteNumber(record.longitude)
  const anchor = points.length > 0
    ? getPointBoundsCenter(points)
    : directLat !== null && directLon !== null && isCoordinateValid(directLat, directLon)
      ? { lat: directLat, lon: directLon }
      : null
  if (!anchor) return null

  const facility = Math.trunc(asFiniteNumber(record.facility) ?? -1)
  const visualRangeNm = Math.max(0, asFiniteNumber(record.visual_range) ?? 0)
  const frequencies = new Set<string>()
  const mainFrequency = formatFrequency(asFiniteNumber(record.frequency))
  if (mainFrequency) frequencies.add(mainFrequency)
  points.forEach((point) => {
    if (point.frequency) frequencies.add(point.frequency)
  })

  return {
    kind: 'controller',
    id: `${Math.trunc(cid)}:${callsign}:${facility}`,
    callsign,
    facility,
    facilityName: getFacilityName(facility),
    frequencies: Array.from(frequencies).sort(),
    lat: anchor.lat,
    lon: anchor.lon,
    visualRangeNm,
    coverageRadiusNm: Math.min(600, Math.max(1, visualRangeNm || getDefaultCoverageRadius(facility))),
    textAtis: asStringArray(record.text_atis),
    logonTime: parseDate(record.logon_time),
    lastUpdated: parseDate(record.last_updated)
  }
}

function normalizeAtis(
  record: Record<string, unknown>,
  transceivers: Map<string, TransceiverPoint[]>
): VatsimAtisFeature | null {
  const callsign = asString(record.callsign)?.trim().toUpperCase()
  const cid = asFiniteNumber(record.cid)
  if (!callsign || cid === null) return null
  const lat = asFiniteNumber(record.latitude)
  const lon = asFiniteNumber(record.longitude)
  const transceiverAnchor = getPointBoundsCenter(transceivers.get(callsign) ?? [])
  const anchor = lat !== null && lon !== null && isCoordinateValid(lat, lon)
    ? { lat, lon }
    : transceiverAnchor
  if (!anchor) return null

  return {
    kind: 'atis',
    id: `${Math.trunc(cid)}:${callsign}`,
    callsign,
    airportIdent: extractAirportIdent(callsign),
    frequency: formatFrequency(asFiniteNumber(record.frequency)),
    atisCode: cleanString(record.atis_code),
    lat: anchor.lat,
    lon: anchor.lon,
    textAtis: asStringArray(record.text_atis),
    logonTime: parseDate(record.logon_time),
    lastUpdated: parseDate(record.last_updated)
  }
}

function normalizeMapQuery(input: VatsimMapQueryInput | null | undefined): VatsimMapQueryInput | null {
  if (!input?.viewport) return null
  const viewport = normalizeViewport(input.viewport)
  if (!viewport) return null
  return {
    viewport,
    layers: {
      pilots: Boolean(input.layers?.pilots),
      controllers: Boolean(input.layers?.controllers),
      controllerCoverage: Boolean(input.layers?.controllerCoverage),
      atis: Boolean(input.layers?.atis),
      weather: Boolean(input.layers?.weather),
      labels: Boolean(input.layers?.labels)
    }
  }
}

function normalizeViewport(viewport: NavMapViewport): NavMapViewport | null {
  const north = clamp(viewport.north, -90, 90)
  const south = clamp(viewport.south, -90, 90)
  if (north <= south) return null
  return {
    north,
    south,
    east: normalizeLongitude(viewport.east),
    west: normalizeLongitude(viewport.west),
    zoom: clamp(viewport.zoom, 0, 24)
  }
}

function pointInViewport(lat: number, lon: number, viewport: NavMapViewport): boolean {
  if (lat < viewport.south || lat > viewport.north) return false
  return viewport.west <= viewport.east
    ? lon >= viewport.west && lon <= viewport.east
    : lon >= viewport.west || lon <= viewport.east
}

function circleIntersectsViewport(
  lat: number,
  lon: number,
  radiusNm: number,
  viewport: NavMapViewport
): boolean {
  if (pointInViewport(lat, lon, viewport)) return true
  const latMargin = radiusNm / 60
  if (lat < viewport.south - latMargin || lat > viewport.north + latMargin) return false
  const lonMargin = latMargin / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const longitudeSpan = viewport.west <= viewport.east
    ? viewport.east - viewport.west
    : 360 - viewport.west + viewport.east
  if (longitudeSpan + lonMargin * 2 >= 360) return true
  const expandedWest = normalizeLongitude(viewport.west - lonMargin)
  const expandedEast = normalizeLongitude(viewport.east + lonMargin)
  return expandedWest <= expandedEast
    ? lon >= expandedWest && lon <= expandedEast
    : lon >= expandedWest || lon <= expandedEast
}

function clusterPilots(pilots: VatsimPilotFeature[], zoom: number): VatsimPilotClusterFeature[] {
  const cellSize = zoom <= 2 ? 20 : zoom <= 3 ? 10 : zoom <= 4 ? 5 : zoom <= 5 ? 2 : 1
  const buckets = new Map<string, { lat: number; lon: number; count: number }>()
  pilots.forEach((pilot) => {
    const latCell = Math.floor((pilot.lat + 90) / cellSize)
    const lonCell = Math.floor((pilot.lon + 180) / cellSize)
    const key = `${latCell}:${lonCell}`
    const current = buckets.get(key) ?? { lat: 0, lon: 0, count: 0 }
    current.lat += pilot.lat
    current.lon += pilot.lon
    current.count += 1
    buckets.set(key, current)
  })

  return Array.from(buckets.entries()).map(([key, bucket]) => ({
    kind: 'pilot-cluster',
    id: `cluster:${zoom}:${key}`,
    lat: bucket.lat / bucket.count,
    lon: bucket.lon / bucket.count,
    count: bucket.count
  }))
}

function scorePilotSearch(pilot: VatsimPilotFeature, query: string): number | null {
  const callsign = pilot.callsign.toUpperCase()
  const cid = pilot.id.split(':', 1)[0]?.toUpperCase() ?? ''
  const name = pilot.name?.toUpperCase() ?? ''
  if (callsign === query) return 0
  if (cid === query) return 1
  if (name === query) return 2
  if (callsign.startsWith(query)) return 10
  if (cid.startsWith(query)) return 11
  if (name.startsWith(query)) return 12
  if (callsign.includes(query)) return 20
  if (name.includes(query)) return 21

  const flightPlan = pilot.flightPlan
  const departure = flightPlan?.departure?.toUpperCase() ?? ''
  const arrival = flightPlan?.arrival?.toUpperCase() ?? ''
  const aircraft = flightPlan?.aircraft?.toUpperCase() ?? ''
  if (departure === query || arrival === query) return 30
  if (departure.startsWith(query) || arrival.startsWith(query)) return 40
  if (aircraft.includes(query)) return 50
  return null
}

function parseMetar(airportIdent: string, rawMetar: string, now: number): ParsedMetar {
  const windMatch = rawMetar.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/)
  const windDirectionDeg = windMatch?.[1] && windMatch[1] !== 'VRB' ? Number(windMatch[1]) : null
  const windSpeedKts = windMatch?.[2] ? Number(windMatch[2]) : null
  const windGustKts = windMatch?.[3] ? Number(windMatch[3]) : null
  const visibilitySm = parseVisibilitySm(rawMetar)
  const ceilingFt = parseCeilingFt(rawMetar)
  const qnhMatch = rawMetar.match(/\bQ(\d{4})\b/)
  const altimeterMatch = rawMetar.match(/\bA(\d{4})\b/)
  const qnhHpa = qnhMatch?.[1]
    ? Number(qnhMatch[1])
    : altimeterMatch?.[1]
      ? Math.round((Number(altimeterMatch[1]) / 100) * 33.8639)
      : null

  return {
    airportIdent,
    rawMetar,
    flightCategory: getFlightCategory(rawMetar, visibilitySm, ceilingFt),
    observedAt: parseMetarObservedAt(rawMetar, now),
    windDirectionDeg,
    windSpeedKts,
    windGustKts,
    visibilitySm,
    ceilingFt,
    qnhHpa
  }
}

function parseVisibilitySm(rawMetar: string): number | null {
  const statute = rawMetar.match(/\b(P)?(?:(\d+)\s+)?(\d+)?(?:\/(\d+))?SM\b/)
  if (statute) {
    const whole = Number(statute[2] ?? (statute[4] ? 0 : statute[3] ?? 0))
    const numerator = statute[4] ? Number(statute[3] ?? 0) : 0
    const denominator = statute[4] ? Number(statute[4]) : 1
    const value = whole + numerator / Math.max(1, denominator)
    return statute[1] ? Math.max(6, value) : value
  }
  const metric = rawMetar.match(/\b(\d{4})(?:NDV)?\b/)
  if (metric?.[1]) {
    const meters = Number(metric[1])
    return meters === 9999 ? 6.2 : Math.round((meters / 1609.344) * 10) / 10
  }
  return rawMetar.includes('CAVOK') ? 6.2 : null
}

function parseCeilingFt(rawMetar: string): number | null {
  const heights = Array.from(rawMetar.matchAll(/\b(?:BKN|OVC|VV)(\d{3})\b/g))
    .map((match) => Number(match[1]) * 100)
    .filter(Number.isFinite)
  return heights.length > 0 ? Math.min(...heights) : null
}

function getFlightCategory(
  rawMetar: string,
  visibilitySm: number | null,
  ceilingFt: number | null
): VatsimFlightCategory {
  if ((visibilitySm !== null && visibilitySm < 1) || (ceilingFt !== null && ceilingFt < 500)) return 'LIFR'
  if ((visibilitySm !== null && visibilitySm < 3) || (ceilingFt !== null && ceilingFt < 1_000)) return 'IFR'
  if ((visibilitySm !== null && visibilitySm <= 5) || (ceilingFt !== null && ceilingFt <= 3_000)) return 'MVFR'
  if (rawMetar.includes('CAVOK') || visibilitySm !== null || ceilingFt !== null) return 'VFR'
  return 'UNKNOWN'
}

function parseMetarObservedAt(rawMetar: string, now: number): number | null {
  const match = rawMetar.match(/\b(\d{2})(\d{2})(\d{2})Z\b/)
  if (!match) return null
  const current = new Date(now)
  const candidate = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  )
  const halfMonth = 15 * 24 * 60 * 60_000
  if (candidate - now > halfMonth) {
    return Date.UTC(
      current.getUTCMonth() === 0 ? current.getUTCFullYear() - 1 : current.getUTCFullYear(),
      current.getUTCMonth() === 0 ? 11 : current.getUTCMonth() - 1,
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    )
  }
  return Number.isFinite(candidate) ? candidate : null
}

function toMetarFeature(airport: NavMapAirportFeature, report: ParsedMetar): VatsimMetarFeature {
  return {
    kind: 'weather',
    id: `weather:${airport.ident}`,
    airportIdent: airport.ident,
    lat: airport.lat,
    lon: airport.lon,
    rawMetar: report.rawMetar,
    flightCategory: report.flightCategory,
    observedAt: report.observedAt,
    windDirectionDeg: report.windDirectionDeg,
    windSpeedKts: report.windSpeedKts,
    windGustKts: report.windGustKts,
    visibilitySm: report.visibilitySm,
    ceilingFt: report.ceilingFt,
    qnhHpa: report.qnhHpa
  }
}

function getPointBoundsCenter(points: TransceiverPoint[]): { lat: number; lon: number } | null {
  if (points.length === 0) return null
  const lats = points.map((point) => point.lat)
  const lons = points.map((point) => point.lon)
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2
  }
}

function getFacilityName(facility: number): string {
  return ['Observer', 'Flight Information', 'Delivery', 'Ground', 'Tower', 'Approach', 'Center', 'Departure'][facility]
    ?? 'Controller'
}

function getDefaultCoverageRadius(facility: number): number {
  switch (facility) {
    case 2:
    case 3:
      return 5
    case 4:
      return 15
    case 5:
    case 7:
      return 80
    case 1:
      return 150
    case 6:
      return 300
    case 0:
    default:
      return 10
  }
}

function extractAirportIdent(callsign: string): string | null {
  const match = callsign.match(/^([A-Z0-9]{3,4})(?:_[A-Z])?_ATIS$/)
  return match?.[1] ?? null
}

function formatFrequency(value: number | null): string | null {
  if (value === null || value < 100 || value > 200) return null
  return value.toFixed(3)
}

function parseDate(value: unknown): number | null {
  const text = asString(value)
  if (!text) return null
  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanString(value: unknown): string | null {
  const text = asString(value)?.trim()
  return text ? text.slice(0, 80) : null
}

function cleanLongString(value: unknown): string | null {
  const text = asString(value)?.trim()
  return text ? text.slice(0, 2_000) : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asNullableRecord(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value)
  return Object.keys(record).length > 0 ? record : null
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 500))
    : []
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isCoordinateValid(lat: number, lon: number): boolean {
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360
}

function normalizeLongitude(value: number): number {
  if (!Number.isFinite(value)) return 0
  let normalized = value
  while (normalized > 180) normalized -= 360
  while (normalized < -180) normalized += 360
  return normalized
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240)
  return String(error).slice(0, 240)
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function emptyCounts(): VatsimStatusCounts {
  return { pilots: 0, controllers: 0, atis: 0, connectedClients: 0 }
}

function emptyFeatureCollection(status: VatsimStatus, fetchedAt: number): VatsimMapFeatureCollection {
  return {
    pilots: [],
    pilotClusters: [],
    controllers: [],
    atis: [],
    weather: [],
    overflow: { pilots: false, controllers: false, atis: false, weather: false },
    status,
    fetchedAt
  }
}
