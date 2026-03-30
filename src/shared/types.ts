export type AppLanguage = 'zh-CN' | 'en-US'
export type AppRoute = 'map' | 'charts' | 'chartDetail' | 'settings'

export type AircraftSource = 'mock' | 'simconnect'
export type MapTileProvider = 'osm' | 'osmfr' | 'cartoLight'

export interface LanAccessSettings {
  enabled: boolean
  port: number
  authEnabled: boolean
  authToken: string
  allowWrite: boolean
}

export interface RemoteAccessStatus {
  enabled: boolean
  running: boolean
  port: number
  primaryAccessUrl: string | null
  accessUrls: string[]
}

export interface AircraftState {
  connected: boolean
  source: AircraftSource
  lat: number
  lon: number
  altitudeFt: number
  headingDeg: number
  groundSpeedKts: number
  onGround: boolean
  updatedAt: number
}

export interface AppSettings {
  language: AppLanguage
  followAircraft: boolean
  refreshIntervalMs: number
  providerMode: AircraftSource
  mapTileProvider: MapTileProvider
  lanAccess: LanAccessSettings
}

export interface ConnectionState {
  connected: boolean
  source: AircraftSource
  messageCode: 'READY' | 'CONNECTING' | 'SIM_NOT_CONNECTED' | 'MOCK_READY'
  updatedAt: number
}
