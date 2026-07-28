import { divIcon, type DivIcon } from 'leaflet'
import type {
  FlightPlanPoint,
  FlightPlanSegment
} from '@shared/flight-plan-types'
import type {
  NavMapAirportFeature,
  NavMapVorFeature,
  NavMapWaypointFeature
} from '@shared/nav-map-types'

export type MapSymbolKind =
  | 'airport'
  | 'airport-regional'
  | 'departure'
  | 'destination'
  | 'vor'
  | 'vor-dme'
  | 'dme'
  | 'ndb'
  | 'fix'
  | 'rnav'
  | 'user'

export type MapSymbolState = 'default' | 'route' | 'selected'

export type RouteVisualTheme =
  | 'planned'
  | 'departure'
  | 'arrival'
  | 'approach'
  | 'missed'
  | 'active'

export interface RouteLeg {
  from: FlightPlanPoint
  to: FlightPlanPoint
  phase: FlightPlanSegment['phase']
  dashed: boolean
  color?: string
}

export interface RouteLegGeometry {
  lat: number
  lon: number
  bearingDeg: number
  distanceNm: number
}

export const ROUTE_VISUAL_COLORS: Record<RouteVisualTheme, string> = {
  planned: '#c975ff',
  departure: '#4ddba5',
  arrival: '#ff6b7a',
  approach: '#ff6b7a',
  missed: '#ffb84d',
  active: '#39d4ff'
}

const iconCache = new Map<string, DivIcon>()

export function createMapSymbolLeafletIcon(
  kind: MapSymbolKind,
  state: MapSymbolState = 'default',
  size = 20
): DivIcon {
  const normalizedSize = Math.max(16, Math.min(28, Math.round(size)))
  const cacheKey = `${kind}:${state}:${normalizedSize}`
  const cached = iconCache.get(cacheKey)
  if (cached) return cached

  const stateClass =
    state === 'route'
      ? 'map-symbol--route'
      : state === 'selected'
        ? 'map-symbol--selected'
        : ''
  const icon = divIcon({
    className: 'map-symbol-leaflet-icon',
    html: [
      `<span class="map-symbol map-symbol--${kind} ${stateClass}" aria-hidden="true">`,
      renderMapSymbolSvg(kind),
      '</span>'
    ].join(''),
    iconSize: [normalizedSize, normalizedSize],
    iconAnchor: [normalizedSize / 2, normalizedSize / 2],
    tooltipAnchor: [Math.ceil(normalizedSize / 2) + 5, 0]
  })

  iconCache.set(cacheKey, icon)
  return icon
}

export function getAirportMapSymbolKind(
  airport: Pick<NavMapAirportFeature, 'longestRunwayLengthFt' | 'numApproach'>
): MapSymbolKind {
  const hasLongRunway = (airport.longestRunwayLengthFt ?? 0) >= 8000
  const hasMultipleApproaches = (airport.numApproach ?? 0) >= 4
  return hasLongRunway || hasMultipleApproaches ? 'airport' : 'airport-regional'
}

export function getVorMapSymbolKind(
  vor: Pick<NavMapVorFeature, 'type'>
): MapSymbolKind {
  const normalizedType = vor.type?.trim().toUpperCase() ?? ''
  if (normalizedType.includes('VOR') && normalizedType.includes('DME')) return 'vor-dme'
  if (normalizedType === 'DME' || normalizedType.startsWith('DME')) return 'dme'
  return 'vor'
}

export function getWaypointMapSymbolKind(
  waypoint: Pick<NavMapWaypointFeature, 'type'>
): MapSymbolKind {
  const normalizedType = waypoint.type?.trim().toUpperCase() ?? ''
  return normalizedType.includes('RNAV') || normalizedType.includes('TERMINAL')
    ? 'rnav'
    : 'fix'
}

export function getFlightPlanPointSymbolKind(
  point: FlightPlanPoint,
  index: number,
  total: number
): MapSymbolKind {
  if (index === 0) return 'departure'
  if (index === total - 1) return 'destination'

  switch (point.source) {
    case 'airport':
      return 'airport'
    case 'vor':
      return 'vor'
    case 'ndb':
      return 'ndb'
    case 'procedure':
      return 'rnav'
    case 'manual':
      return 'user'
    case 'waypoint':
    default:
      return 'fix'
  }
}

export function getRouteVisualTheme(
  phase: FlightPlanSegment['phase']
): RouteVisualTheme {
  switch (phase) {
    case 'departure':
      return 'departure'
    case 'arrival':
      return 'arrival'
    case 'approach':
      return 'approach'
    case 'missed':
      return 'missed'
    case 'enroute':
    default:
      return 'planned'
  }
}

export function buildRouteLegs(
  routeSegments: FlightPlanSegment[],
  routePoints: FlightPlanPoint[]
): RouteLeg[] {
  const sourceSegments =
    routeSegments.length > 0
      ? routeSegments
      : [
          {
            points: routePoints,
            phase: 'enroute' as const
          }
        ]

  return sourceSegments.flatMap((segment) => {
    const legs: RouteLeg[] = []
    for (let index = 1; index < segment.points.length; index += 1) {
      legs.push({
        from: segment.points[index - 1],
        to: segment.points[index],
        phase: segment.phase,
        dashed: Boolean(segment.dashed),
        ...(segment.color ? { color: segment.color } : {})
      })
    }
    return legs
  })
}

export function getRouteLegGeometry(leg: RouteLeg): RouteLegGeometry {
  const fromLat = toRadians(leg.from.lat)
  const fromLon = toRadians(leg.from.lon)
  const toLat = toRadians(leg.to.lat)
  const toLon = toRadians(leg.to.lon)
  const deltaLon = wrapRadians(toLon - fromLon)
  const bx = Math.cos(toLat) * Math.cos(deltaLon)
  const by = Math.cos(toLat) * Math.sin(deltaLon)
  const midpointLat = Math.atan2(
    Math.sin(fromLat) + Math.sin(toLat),
    Math.hypot(Math.cos(fromLat) + bx, by)
  )
  const midpointLon = fromLon + Math.atan2(by, Math.cos(fromLat) + bx)
  const bearing = Math.atan2(
    Math.sin(deltaLon) * Math.cos(toLat),
    Math.cos(fromLat) * Math.sin(toLat) -
      Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon)
  )

  return {
    lat: toDegrees(midpointLat),
    lon: wrapLongitude(toDegrees(midpointLon)),
    bearingDeg: normalizeBearing(toDegrees(bearing)),
    distanceNm: calculateGreatCircleDistanceNm(leg.from, leg.to)
  }
}

export function findNearestRouteLegIndex(
  legs: RouteLeg[],
  lat: number,
  lon: number,
  maxDistanceNm = 80
): number | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  let nearestIndex: number | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  legs.forEach((leg, index) => {
    const distance = pointToLegDistanceNm(lat, lon, leg)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestDistance <= maxDistanceNm ? nearestIndex : null
}

export function formatMapCoordinates(
  lat: number,
  lon: number,
  precision = 4
): string {
  const safePrecision = Math.max(0, Math.min(6, Math.round(precision)))
  const latHemisphere = lat >= 0 ? 'N' : 'S'
  const lonHemisphere = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(safePrecision)}°${latHemisphere} · ${Math.abs(lon).toFixed(safePrecision)}°${lonHemisphere}`
}

function renderMapSymbolSvg(kind: MapSymbolKind): string {
  const commonStart =
    '<svg class="map-symbol-svg" viewBox="0 0 24 24" role="presentation" focusable="false">'
  const commonEnd = '</svg>'

  switch (kind) {
    case 'airport':
    case 'departure':
    case 'destination':
      return [
        commonStart,
        '<circle class="map-symbol-surface" cx="12" cy="12" r="9.25" />',
        '<path class="map-symbol-line map-symbol-line--strong" d="M12 4.2 13.7 10.1 19 12.2 19 14 13.7 12.9 13.2 17.2 15.2 18.7 15.2 20 12 19 8.8 20 8.8 18.7 10.8 17.2 10.3 12.9 5 14 5 12.2 10.3 10.1 12 4.2Z" />',
        commonEnd
      ].join('')
    case 'airport-regional':
      return [
        commonStart,
        '<circle class="map-symbol-surface" cx="12" cy="12" r="8.5" />',
        '<circle class="map-symbol-line" cx="12" cy="12" r="3.25" />',
        commonEnd
      ].join('')
    case 'vor':
      return [
        commonStart,
        '<path class="map-symbol-surface" d="M7 3.8h10l5 8.2-5 8.2H7L2 12l5-8.2Z" />',
        '<circle class="map-symbol-line" cx="12" cy="12" r="3.25" />',
        commonEnd
      ].join('')
    case 'vor-dme':
      return [
        commonStart,
        '<path class="map-symbol-surface" d="M7 3.8h10l5 8.2-5 8.2H7L2 12l5-8.2Z" />',
        '<rect class="map-symbol-line" x="8.5" y="8.5" width="7" height="7" rx="1" />',
        commonEnd
      ].join('')
    case 'dme':
      return [
        commonStart,
        '<rect class="map-symbol-surface" x="4" y="4" width="16" height="16" rx="1.5" />',
        '<rect class="map-symbol-line" x="8.5" y="8.5" width="7" height="7" rx="1" />',
        commonEnd
      ].join('')
    case 'ndb':
      return [
        commonStart,
        '<circle class="map-symbol-surface map-symbol-line--dashed" cx="12" cy="12" r="8" />',
        '<circle class="map-symbol-dot" cx="12" cy="12" r="2.2" />',
        commonEnd
      ].join('')
    case 'rnav':
      return [
        commonStart,
        '<path class="map-symbol-surface" d="M12 2.75 21.25 12 12 21.25 2.75 12 12 2.75Z" />',
        '<path class="map-symbol-line" d="M12 7.2 16.8 12 12 16.8 7.2 12 12 7.2Z" />',
        commonEnd
      ].join('')
    case 'user':
      return [
        commonStart,
        '<path class="map-symbol-surface" d="M12 3.2 21 20H3L12 3.2Z" />',
        '<circle class="map-symbol-dot" cx="12" cy="14.2" r="1.8" />',
        commonEnd
      ].join('')
    case 'fix':
    default:
      return [
        commonStart,
        '<path class="map-symbol-surface" d="M12 2.5 14.6 9.4 21.5 12 14.6 14.6 12 21.5 9.4 14.6 2.5 12 9.4 9.4 12 2.5Z" />',
        '<circle class="map-symbol-dot" cx="12" cy="12" r="1.45" />',
        commonEnd
      ].join('')
  }
}

function calculateGreatCircleDistanceNm(
  from: Pick<FlightPlanPoint, 'lat' | 'lon'>,
  to: Pick<FlightPlanPoint, 'lat' | 'lon'>
): number {
  const earthRadiusNm = 3440.065
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)
  const deltaLat = toLat - fromLat
  const deltaLon = wrapRadians(toRadians(to.lon - from.lon))
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2
  return earthRadiusNm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function pointToLegDistanceNm(
  lat: number,
  lon: number,
  leg: RouteLeg
): number {
  const longitudeScale = Math.cos(toRadians(lat))
  const ax = wrapLongitude(leg.from.lon - lon) * 60 * longitudeScale
  const ay = (leg.from.lat - lat) * 60
  const bx = wrapLongitude(leg.to.lon - lon) * 60 * longitudeScale
  const by = (leg.to.lat - lat) * 60
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

function normalizeBearing(value: number): number {
  return ((value % 360) + 360) % 360
}

function wrapLongitude(value: number): number {
  return ((value + 540) % 360) - 180
}

function wrapRadians(value: number): number {
  return ((value + Math.PI * 3) % (Math.PI * 2)) - Math.PI
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI
}
