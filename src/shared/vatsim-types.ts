import type { NavMapViewport } from './nav-map-types'

export type VatsimConnectionPhase = 'connecting' | 'ready' | 'stale' | 'error'
export type VatsimFlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN'

export interface VatsimStatusCounts {
  pilots: number
  controllers: number
  atis: number
  connectedClients: number
}

export interface VatsimStatus {
  phase: VatsimConnectionPhase
  revision: number
  fetchedAt: number | null
  feedUpdatedAt: number | null
  nextRefreshAt: number | null
  lastError: string | null
  counts: VatsimStatusCounts
}

export interface VatsimMapLayerVisibility {
  pilots: boolean
  controllers: boolean
  controllerCoverage: boolean
  atis: boolean
  weather: boolean
  labels: boolean
}

export interface VatsimMapQueryInput {
  viewport: NavMapViewport
  layers: VatsimMapLayerVisibility
}

export interface VatsimPilotSearchInput {
  query: string
  limit?: number
}

export interface VatsimFlightPlanSummary {
  flightRules: string | null
  aircraft: string | null
  departure: string | null
  arrival: string | null
  alternate: string | null
  cruiseAltitude: string | null
  route: string | null
  remarks: string | null
}

export interface VatsimPilotFeature {
  kind: 'pilot'
  id: string
  callsign: string
  name: string | null
  lat: number
  lon: number
  altitudeFt: number
  groundSpeedKts: number
  headingDeg: number
  transponder: string | null
  onGround: boolean
  flightPlan: VatsimFlightPlanSummary | null
  logonTime: number | null
  lastUpdated: number | null
}

export interface VatsimPilotClusterFeature {
  kind: 'pilot-cluster'
  id: string
  lat: number
  lon: number
  count: number
}

export interface VatsimControllerFeature {
  kind: 'controller'
  id: string
  callsign: string
  facility: number
  facilityName: string
  frequencies: string[]
  lat: number
  lon: number
  visualRangeNm: number
  coverageRadiusNm: number
  textAtis: string[]
  logonTime: number | null
  lastUpdated: number | null
}

export interface VatsimAtisFeature {
  kind: 'atis'
  id: string
  callsign: string
  airportIdent: string | null
  frequency: string | null
  atisCode: string | null
  lat: number
  lon: number
  textAtis: string[]
  logonTime: number | null
  lastUpdated: number | null
}

export interface VatsimMetarFeature {
  kind: 'weather'
  id: string
  airportIdent: string
  lat: number
  lon: number
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

export type VatsimSelectableFeature =
  | VatsimPilotFeature
  | VatsimControllerFeature
  | VatsimAtisFeature

export interface VatsimMapFeatureCollection {
  pilots: VatsimPilotFeature[]
  pilotClusters: VatsimPilotClusterFeature[]
  controllers: VatsimControllerFeature[]
  atis: VatsimAtisFeature[]
  weather: VatsimMetarFeature[]
  overflow: {
    pilots: boolean
    controllers: boolean
    atis: boolean
    weather: boolean
  }
  status: VatsimStatus
  fetchedAt: number
}
