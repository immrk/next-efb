export interface NavMapViewport {
  north: number
  south: number
  east: number
  west: number
  zoom: number
}

export interface NavMapLayerVisibility {
  airports: boolean
  waypoints: boolean
  vors: boolean
  ndbs: boolean
  airways: boolean
}

export interface NavMapQueryInput {
  viewport: NavMapViewport
  layers: NavMapLayerVisibility
}

export interface NavMapAirportFeature {
  id: number
  ident: string
  name: string | null
  type: number | null
  lat: number
  lon: number
  longestRunwayLengthFt: number | null
  numApproach: number | null
}

export interface NavMapWaypointFeature {
  id: number
  ident: string
  type: string | null
  lat: number
  lon: number
  airportIdent: string | null
}

export interface NavMapVorFeature {
  id: number
  ident: string | null
  type: string | null
  frequency: number | null
  lat: number
  lon: number
}

export interface NavMapNdbFeature {
  id: number
  ident: string | null
  type: string | null
  frequency: number | null
  lat: number
  lon: number
}

export interface NavMapAirwayFeature {
  id: number
  name: string
  airwayType: string
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
}

export interface NavMapFeatureOverflow {
  airports: boolean
  waypoints: boolean
  vors: boolean
  ndbs: boolean
  airways: boolean
}

export interface NavMapFeatureCollection {
  airports: NavMapAirportFeature[]
  waypoints: NavMapWaypointFeature[]
  vors: NavMapVorFeature[]
  ndbs: NavMapNdbFeature[]
  airways: NavMapAirwayFeature[]
  overflow: NavMapFeatureOverflow
  fetchedAt: number
}
