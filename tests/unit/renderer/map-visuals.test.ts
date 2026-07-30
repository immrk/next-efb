import { describe, expect, it } from 'vitest'
import type {
  FlightPlanPoint,
  FlightPlanSegment
} from '../../../src/shared/flight-plan-types'
import {
  ROUTE_VISUAL_COLORS,
  buildRouteLegs,
  createMapReferenceLeafletIcon,
  createMapSymbolLeafletIcon,
  findNearestRouteLegIndex,
  formatMapCoordinates,
  getAirportMapSymbolKind,
  getFlightPlanPointSymbolKind,
  getRouteLegGeometry,
  getRouteVisualTheme,
  getVorMapSymbolKind,
  getWaypointMapSymbolKind
} from '../../../src/renderer/utils/mapVisuals'

describe('map visual system', () => {
  it('creates distinct SVG symbols and preserves route interaction states', () => {
    const airport = createMapSymbolLeafletIcon('airport', 'default', 24)
    const selectedFix = createMapSymbolLeafletIcon('fix', 'selected', 20)

    expect(airport.options.className).toBe('map-symbol-leaflet-icon')
    expect(airport.options.iconSize).toEqual([24, 24])
    expect(airport.options.html).toContain('map-symbol--airport')
    expect(airport.options.html).toContain('<circle')
    expect(selectedFix.options.html).toContain('map-symbol--fix')
    expect(selectedFix.options.html).toContain('map-symbol--selected')
    expect(selectedFix.options.html).toContain('map-symbol-dot')
  })

  it('creates a map reference marker with an accessible delete icon', () => {
    const marker = createMapReferenceLeafletIcon('1', 'Remove point "1"')

    expect(marker.options.className).toBe('map-reference-icon')
    expect(marker.options.iconSize).toEqual([28, 38])
    expect(marker.options.html).toContain('<span>1</span>')
    expect(marker.options.html).toContain('data-map-reference-delete')
    expect(marker.options.html).toContain('aria-label="Remove point &quot;1&quot;"')
    expect(marker.options.html).toContain('<svg')
  })

  it('classifies navigation and flight-plan point types by shape', () => {
    expect(
      getAirportMapSymbolKind({
        longestRunwayLengthFt: 12000,
        numApproach: 1
      })
    ).toBe('airport')
    expect(
      getAirportMapSymbolKind({
        longestRunwayLengthFt: 3500,
        numApproach: 0
      })
    ).toBe('airport-regional')
    expect(getVorMapSymbolKind({ type: 'VOR-DME' })).toBe('vor-dme')
    expect(getVorMapSymbolKind({ type: 'DME' })).toBe('dme')
    expect(getWaypointMapSymbolKind({ type: 'RNAV TERMINAL' })).toBe('rnav')
    expect(getWaypointMapSymbolKind({ type: 'ENROUTE' })).toBe('fix')

    const route = createRoutePoints()
    expect(getFlightPlanPointSymbolKind(route[0], 0, route.length)).toBe('departure')
    expect(getFlightPlanPointSymbolKind(route[1], 1, route.length)).toBe('fix')
    expect(getFlightPlanPointSymbolKind(route[2], 2, route.length)).toBe('destination')
  })

  it('builds styled legs and calculates midpoint, bearing and distance', () => {
    const route = createRoutePoints()
    const segments: FlightPlanSegment[] = [
      {
        points: route,
        phase: 'departure'
      }
    ]
    const legs = buildRouteLegs(segments, [])
    const geometry = getRouteLegGeometry(legs[0])

    expect(legs).toHaveLength(2)
    expect(legs[0]).toMatchObject({
      from: route[0],
      to: route[1],
      phase: 'departure',
      dashed: false
    })
    expect(geometry.lat).toBeCloseTo(30.5, 1)
    expect(geometry.lon).toBeCloseTo(120, 1)
    expect(geometry.bearingDeg).toBeCloseTo(0, 0)
    expect(geometry.distanceNm).toBeCloseTo(60, 0)
    expect(getRouteVisualTheme('departure')).toBe('departure')
    expect(getRouteVisualTheme('enroute')).toBe('planned')
  })

  it('identifies only a nearby active route leg and formats map coordinates', () => {
    const legs = buildRouteLegs([], createRoutePoints())

    expect(findNearestRouteLegIndex(legs, 30.4, 120, 20)).toBe(0)
    expect(findNearestRouteLegIndex(legs, 40, 130, 20)).toBeNull()
    expect(formatMapCoordinates(31.2, -121.4)).toBe('31.2000°N · 121.4000°W')
    expect(ROUTE_VISUAL_COLORS.departure).not.toBe(ROUTE_VISUAL_COLORS.planned)
    expect(ROUTE_VISUAL_COLORS.arrival).not.toBe(ROUTE_VISUAL_COLORS.planned)
    expect(ROUTE_VISUAL_COLORS.missed).not.toBe(ROUTE_VISUAL_COLORS.arrival)
    expect(ROUTE_VISUAL_COLORS.active).not.toBe(ROUTE_VISUAL_COLORS.departure)
    expect(ROUTE_VISUAL_COLORS.approach).toBe(ROUTE_VISUAL_COLORS.arrival)
  })
})

function createRoutePoints(): FlightPlanPoint[] {
  return [
    {
      ident: 'ZSPD',
      lat: 30,
      lon: 120,
      source: 'airport'
    },
    {
      ident: 'SASAN',
      lat: 31,
      lon: 120,
      source: 'waypoint'
    },
    {
      ident: 'ZGGG',
      lat: 32,
      lon: 120,
      source: 'airport'
    }
  ]
}
