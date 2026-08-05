import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CloudSun, MapPin } from 'lucide-react'
import { Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { NavMapFeatureCollection, NavMapLayerVisibility, NavMapQueryInput } from '@shared/nav-map-types'
import type { VatsimMetarFeature } from '@shared/vatsim-types'
import { getAppClient } from '../client'
import {
  createMapSymbolLeafletIcon,
  formatMapCoordinates,
  getAirportMapSymbolKind,
  getVorMapSymbolKind,
  getWaypointMapSymbolKind
} from '../utils/mapVisuals'

interface MapViewportState {
  north: number
  south: number
  east: number
  west: number
  zoom: number
}

export function NavDataOverlay({
  layerVisibility,
  airportWeather = [],
  selectedFeatureKey = null,
  onSelectFeature,
  onPickPoint
}: {
  layerVisibility: NavMapLayerVisibility
  airportWeather?: VatsimMetarFeature[]
  selectedFeatureKey?: string | null
  onSelectFeature?: (key: string) => void
  onPickPoint?: (point: { lat: number; lon: number }) => void
}) {
  const { t } = useTranslation()
  const map = useMap()
  const appClient = getAppClient()
  const [viewport, setViewport] = useState<MapViewportState>(() => readViewportState(map))
  const [features, setFeatures] = useState<NavMapFeatureCollection>(() => emptyNavFeatureCollection())
  const requestIdRef = useRef(0)
  const updateViewport = useCallback((next: MapViewportState) => {
    setViewport((current) => isSameViewport(current, next) ? current : next)
  }, [])
  const weatherByAirport = useMemo(
    () => new Map(airportWeather.map((weather) => [weather.airportIdent.toUpperCase(), weather])),
    [airportWeather]
  )

  const effectiveLayers = useMemo(
    () => getEffectiveNavLayerVisibility(layerVisibility, viewport.zoom),
    [layerVisibility, viewport.zoom]
  )
  const renderedFeatures = useMemo(
    () => applyNavRenderBudget(features, viewport.zoom, selectedFeatureKey),
    [features, selectedFeatureKey, viewport.zoom]
  )
  const airportLabelKeys = useMemo(
    () => selectSpacedLabelKeys(
      renderedFeatures.airports.filter((airport) =>
        viewport.zoom >= (getAirportMapSymbolKind(airport) === 'airport' ? 8 : 10)
      ),
      (airport) => `airport:${airport.id}`,
      viewport,
      getAirportLabelBudget(viewport.zoom)
    ),
    [renderedFeatures.airports, viewport]
  )
  const vorLabelKeys = useMemo(
    () => selectSpacedLabelKeys(
      viewport.zoom >= 10 ? renderedFeatures.vors : [],
      (vor) => `vor:${vor.id}`,
      viewport,
      getNavaidLabelBudget(viewport.zoom)
    ),
    [renderedFeatures.vors, viewport]
  )
  const ndbLabelKeys = useMemo(
    () => selectSpacedLabelKeys(
      viewport.zoom >= 10 ? renderedFeatures.ndbs : [],
      (ndb) => `ndb:${ndb.id}`,
      viewport,
      Math.ceil(getNavaidLabelBudget(viewport.zoom) * 0.65)
    ),
    [renderedFeatures.ndbs, viewport]
  )

  useEffect(() => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const hasActiveLayer = Object.values(effectiveLayers).some(Boolean)
    if (!hasActiveLayer) {
      setFeatures(emptyNavFeatureCollection())
      return
    }

    const input: NavMapQueryInput = {
      viewport,
      layers: effectiveLayers
    }

    const timer = window.setTimeout(() => {
      void appClient
        .getNavMapFeatures(input)
        .then((result) => {
          if (requestIdRef.current !== requestId) return
          setFeatures(result)
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return
          setFeatures(emptyNavFeatureCollection())
        })
    }, 100)

    return () => window.clearTimeout(timer)
  }, [appClient, effectiveLayers, viewport])

  return (
    <>
      <MapViewportBridge onViewportChange={updateViewport} />

      {renderedFeatures.airways.map((airway) => (
        <Polyline
          key={`airway:${airway.id}`}
          positions={[
            [airway.fromLat, airway.fromLon],
            [airway.toLat, airway.toLon]
          ]}
          pathOptions={{
            color: '#6383a3',
            weight: 1.25,
            opacity: 0.48,
            lineCap: 'round',
            className: 'map-airway-line'
          }}
        >
          <Tooltip sticky className="map-airway-tooltip">
            {`${airway.name} · ${airway.airwayType}`}
          </Tooltip>
        </Polyline>
      ))}

      {renderedFeatures.airports.map((airport) => {
        const featureKey = `airport:${airport.id}`
        const isSelected = selectedFeatureKey === featureKey
        const kind = getAirportMapSymbolKind(airport)
        const isMajor = kind === 'airport'
        const size = isMajor ? 24 : 19
        const isLabelVisible = isSelected || airportLabelKeys.has(featureKey)
        const weather = weatherByAirport.get(airport.ident.toUpperCase())

        return (
          <Marker
            key={featureKey}
            position={[airport.lat, airport.lon]}
            icon={createMapSymbolLeafletIcon(
              kind,
              isSelected ? 'selected' : 'default',
              size
            )}
            title={airport.name ? `${airport.ident} · ${airport.name}` : airport.ident}
            riseOnHover
            zIndexOffset={isSelected ? 900 : 420}
            eventHandlers={{
              click: () => {
                onSelectFeature?.(featureKey)
                onPickPoint?.({ lat: airport.lat, lon: airport.lon })
              }
            }}
          >
            {isLabelVisible ? <Tooltip
              permanent
              direction="right"
              opacity={1}
              className={`map-nav-tooltip map-nav-tooltip--airport ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="map-info-card map-info-card--nav">
                {isSelected ? (
                  <>
                    <div className="map-airport-details-header">
                      <span className={`map-airport-details-icon ${weather ? 'is-weather' : ''}`}>
                        {weather ? <CloudSun /> : <MapPin />}
                      </span>
                      <div>
                        <span className="map-info-card-kicker">
                          {weather ? t('vatsim.weather.current') : isMajor ? 'MAJOR AIRPORT' : 'REGIONAL AIRPORT'}
                        </span>
                        <strong className="map-airport-details-title">{airport.ident}</strong>
                      </div>
                      {weather ? <time>{formatMetarTime(weather.observedAt)}</time> : null}
                    </div>
                    {airport.name ? (
                      <span className="map-info-card-description">{airport.name}</span>
                    ) : null}
                    <dl className="vatsim-details-grid map-airport-details-grid">
                      {weather ? <AirportWeatherDetails weather={weather} /> : null}
                      <div className="map-info-card-grid-wide">
                        <dt>POSITION</dt>
                        <dd>{formatMapCoordinates(airport.lat, airport.lon)}</dd>
                      </div>
                      {airport.longestRunwayLengthFt ? (
                        <div>
                          <dt>LONGEST RWY</dt>
                          <dd>{`${Math.round(airport.longestRunwayLengthFt)} FT`}</dd>
                        </div>
                      ) : null}
                      {airport.numApproach !== null ? (
                        <div>
                          <dt>APPROACHES</dt>
                          <dd>{airport.numApproach}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {weather ? (
                      <div className="vatsim-details-text map-airport-details-metar">
                        <span>METAR</span>
                        <p>{weather.rawMetar}</p>
                      </div>
                    ) : null}
                  </>
                ) : <strong>{airport.ident}</strong>}
              </div>
            </Tooltip> : null}
          </Marker>
        )
      })}

      {renderedFeatures.vors.map((vor) => {
        const featureKey = `vor:${vor.id}`
        const isSelected = selectedFeatureKey === featureKey
        const kind = getVorMapSymbolKind(vor)
        const ident = vor.ident ?? (kind === 'dme' ? 'DME' : 'VOR')
        const frequency = vor.frequency ? formatNavFrequency(vor.frequency) : null
        const isLabelVisible = isSelected || vorLabelKeys.has(featureKey)

        return (
          <Marker
            key={featureKey}
            position={[vor.lat, vor.lon]}
            icon={createMapSymbolLeafletIcon(kind, isSelected ? 'selected' : 'default', 20)}
            title={frequency ? `${ident} · ${frequency}` : ident}
            riseOnHover
            zIndexOffset={isSelected ? 900 : 320}
            eventHandlers={{
              click: () => {
                onSelectFeature?.(featureKey)
                onPickPoint?.({ lat: vor.lat, lon: vor.lon })
              }
            }}
          >
            {isLabelVisible ? <Tooltip
              permanent
              direction="right"
              opacity={1}
              className={`map-nav-tooltip map-nav-tooltip--navaid ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="map-info-card map-info-card--nav">
                <strong>{ident}</strong>
                {isSelected ? (
                  <>
                    <span className="map-info-card-kicker">
                      {kind.replace('-', ' ').toUpperCase()}
                    </span>
                    <dl className="map-info-card-grid">
                      {frequency ? (
                        <div>
                          <dt>FREQUENCY</dt>
                          <dd>{frequency}</dd>
                        </div>
                      ) : null}
                      <div className="map-info-card-grid-wide">
                        <dt>POSITION</dt>
                        <dd>{formatMapCoordinates(vor.lat, vor.lon)}</dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </div>
            </Tooltip> : null}
          </Marker>
        )
      })}

      {renderedFeatures.ndbs.map((ndb) => {
        const featureKey = `ndb:${ndb.id}`
        const isSelected = selectedFeatureKey === featureKey
        const ident = ndb.ident ?? 'NDB'
        const isLabelVisible = isSelected || ndbLabelKeys.has(featureKey)

        return (
          <Marker
            key={featureKey}
            position={[ndb.lat, ndb.lon]}
            icon={createMapSymbolLeafletIcon('ndb', isSelected ? 'selected' : 'default', 19)}
            title={ndb.frequency ? `${ident} · ${ndb.frequency}` : ident}
            riseOnHover
            zIndexOffset={isSelected ? 900 : 300}
            eventHandlers={{
              click: () => {
                onSelectFeature?.(featureKey)
                onPickPoint?.({ lat: ndb.lat, lon: ndb.lon })
              }
            }}
          >
            {isLabelVisible ? <Tooltip
              permanent
              direction="right"
              opacity={1}
              className={`map-nav-tooltip map-nav-tooltip--navaid ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="map-info-card map-info-card--nav">
                <strong>{ident}</strong>
                {isSelected ? (
                  <>
                    <span className="map-info-card-kicker">NDB</span>
                    <dl className="map-info-card-grid">
                      {ndb.frequency ? (
                        <div>
                          <dt>FREQUENCY</dt>
                          <dd>{ndb.frequency}</dd>
                        </div>
                      ) : null}
                      <div className="map-info-card-grid-wide">
                        <dt>POSITION</dt>
                        <dd>{formatMapCoordinates(ndb.lat, ndb.lon)}</dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </div>
            </Tooltip> : null}
          </Marker>
        )
      })}

      {renderedFeatures.waypoints.map((waypoint) => {
        const featureKey = `waypoint:${waypoint.id}`
        const isSelected = selectedFeatureKey === featureKey
        const kind = getWaypointMapSymbolKind(waypoint)

        return (
          <Marker
            key={featureKey}
            position={[waypoint.lat, waypoint.lon]}
            icon={createMapSymbolLeafletIcon(kind, isSelected ? 'selected' : 'default', 18)}
            title={waypoint.type ? `${waypoint.ident} · ${waypoint.type}` : waypoint.ident}
            riseOnHover
            zIndexOffset={isSelected ? 900 : 260}
            eventHandlers={{
              click: () => {
                onSelectFeature?.(featureKey)
                onPickPoint?.({ lat: waypoint.lat, lon: waypoint.lon })
              }
            }}
          >
            <Tooltip
              permanent={isSelected}
              direction="right"
              opacity={1}
              className={`map-nav-tooltip map-nav-tooltip--waypoint ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="map-info-card map-info-card--nav">
                <strong>{waypoint.ident}</strong>
                {isSelected ? (
                  <>
                    <span className="map-info-card-kicker">
                      {(waypoint.type ?? (kind === 'rnav' ? 'RNAV WAYPOINT' : 'ENROUTE FIX')).toUpperCase()}
                    </span>
                    <dl className="map-info-card-grid">
                      {waypoint.airportIdent ? (
                        <div>
                          <dt>AIRPORT</dt>
                          <dd>{waypoint.airportIdent}</dd>
                        </div>
                      ) : null}
                      <div className="map-info-card-grid-wide">
                        <dt>POSITION</dt>
                        <dd>{formatMapCoordinates(waypoint.lat, waypoint.lon)}</dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </div>
            </Tooltip>
          </Marker>
        )
      })}
    </>
  )
}

function AirportWeatherDetails({ weather }: { weather: VatsimMetarFeature }) {
  const { t } = useTranslation()

  return (
    <>
      <div>
        <dt>{t('vatsim.fields.wind')}</dt>
        <dd>{formatWeatherWind(weather)}</dd>
      </div>
      <div>
        <dt>{t('vatsim.fields.visibility')}</dt>
        <dd>{weather.visibilitySm === null ? '--' : `${weather.visibilitySm} SM`}</dd>
      </div>
      <div>
        <dt>{t('vatsim.fields.ceiling')}</dt>
        <dd>{weather.ceilingFt === null ? '--' : `${weather.ceilingFt.toLocaleString()} ft`}</dd>
      </div>
      <div>
        <dt>QNH</dt>
        <dd>{weather.qnhHpa === null ? '--' : `${weather.qnhHpa} hPa`}</dd>
      </div>
    </>
  )
}

function formatWeatherWind(weather: VatsimMetarFeature): string {
  if (weather.windSpeedKts === null) return '--'
  if (weather.windSpeedKts === 0) return 'CALM'
  const direction = weather.windDirectionDeg === null
    ? 'VRB'
    : `${String(Math.round(weather.windDirectionDeg)).padStart(3, '0')}°`
  return `${direction} ${weather.windSpeedKts}${weather.windGustKts ? `G${weather.windGustKts}` : ''} kt`
}

function formatMetarTime(value: number | null): string {
  if (!value) return '--'
  const date = new Date(value)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}Z`
}

function MapViewportBridge({
  onViewportChange
}: {
  onViewportChange: (viewport: MapViewportState) => void
}) {
  const map = useMapEvents({
    moveend() {
      onViewportChange(readViewportState(map))
    },
    zoomend() {
      onViewportChange(readViewportState(map))
    }
  })

  useEffect(() => {
    onViewportChange(readViewportState(map))
  }, [map, onViewportChange])

  return null
}

function readViewportState(map: ReturnType<typeof useMap>): MapViewportState {
  const bounds = map.getBounds()
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
    zoom: map.getZoom()
  }
}

function getEffectiveNavLayerVisibility(
  requested: NavMapLayerVisibility,
  zoom: number
): NavMapLayerVisibility {
  return {
    airports: requested.airports,
    airways: requested.airways && zoom >= 5,
    vors: requested.vors && zoom >= 6,
    ndbs: requested.ndbs && zoom >= 6,
    waypoints: requested.waypoints && zoom >= 8
  }
}

function applyNavRenderBudget(
  features: NavMapFeatureCollection,
  zoom: number,
  selectedFeatureKey: string | null
): NavMapFeatureCollection {
  const budgets = getNavRenderBudgets(zoom)
  const airports = takeWithSelected(features.airports, budgets.airports, selectedFeatureKey, 'airport')
  const waypoints = takeWithSelected(features.waypoints, budgets.waypoints, selectedFeatureKey, 'waypoint')
  const vors = takeWithSelected(features.vors, budgets.vors, selectedFeatureKey, 'vor')
  const ndbs = takeWithSelected(features.ndbs, budgets.ndbs, selectedFeatureKey, 'ndb')
  const airways = features.airways.slice(0, budgets.airways)

  return {
    ...features,
    airports,
    waypoints,
    vors,
    ndbs,
    airways,
    overflow: {
      airports: features.overflow.airports || airports.length < features.airports.length,
      waypoints: features.overflow.waypoints || waypoints.length < features.waypoints.length,
      vors: features.overflow.vors || vors.length < features.vors.length,
      ndbs: features.overflow.ndbs || ndbs.length < features.ndbs.length,
      airways: features.overflow.airways || airways.length < features.airways.length
    }
  }
}

function getNavRenderBudgets(zoom: number) {
  if (zoom <= 6) return { airports: 90, waypoints: 80, vors: 70, ndbs: 50, airways: 120 }
  if (zoom <= 8) return { airports: 120, waypoints: 120, vors: 90, ndbs: 60, airways: 150 }
  if (zoom <= 10) return { airports: 160, waypoints: 220, vors: 110, ndbs: 75, airways: 180 }
  return { airports: 220, waypoints: 320, vors: 150, ndbs: 100, airways: 240 }
}

function takeWithSelected<T extends { id: number }>(
  items: T[],
  limit: number,
  selectedFeatureKey: string | null,
  prefix: string
): T[] {
  if (items.length <= limit) return items
  const selectedId = selectedFeatureKey?.startsWith(`${prefix}:`)
    ? Number(selectedFeatureKey.slice(prefix.length + 1))
    : null
  const selected = selectedId === null || !Number.isFinite(selectedId)
    ? undefined
    : items.find((item) => item.id === selectedId)
  const result = items.slice(0, limit)
  if (selected && !result.some((item) => item.id === selected.id)) result[result.length - 1] = selected
  return result
}

function selectSpacedLabelKeys<T extends { lat: number; lon: number }>(
  items: T[],
  getKey: (item: T) => string,
  viewport: MapViewportState,
  limit: number
): Set<string> {
  const keys = new Set<string>()
  if (limit <= 0 || items.length === 0) return keys

  const latSpan = Math.max(0.0001, viewport.north - viewport.south)
  const lonSpan = Math.max(
    0.0001,
    viewport.west <= viewport.east
      ? viewport.east - viewport.west
      : 360 - viewport.west + viewport.east
  )
  const midLatRad = ((viewport.north + viewport.south) / 2) * Math.PI / 180
  const aspect = Math.max(0.4, Math.min(3, lonSpan * Math.max(0.2, Math.cos(midLatRad)) / latSpan))
  const columns = Math.max(1, Math.ceil(Math.sqrt(limit * aspect)))
  const rows = Math.max(1, Math.ceil(limit / columns))
  const occupied = new Set<string>()

  for (const item of items) {
    if (keys.size >= limit) break
    const lonOffset = viewport.west <= viewport.east
      ? item.lon - viewport.west
      : (item.lon - viewport.west + 360) % 360
    const column = Math.max(0, Math.min(columns - 1, Math.floor(lonOffset / lonSpan * columns)))
    const row = Math.max(0, Math.min(rows - 1, Math.floor((viewport.north - item.lat) / latSpan * rows)))
    const cellKey = `${column}:${row}`
    if (occupied.has(cellKey)) continue
    occupied.add(cellKey)
    keys.add(getKey(item))
  }

  return keys
}

function getAirportLabelBudget(zoom: number): number {
  if (zoom < 8) return 0
  if (zoom <= 8) return 28
  if (zoom <= 10) return 52
  if (zoom <= 12) return 84
  return 120
}

function getNavaidLabelBudget(zoom: number): number {
  if (zoom < 10) return 0
  if (zoom <= 10) return 32
  if (zoom <= 12) return 52
  return 80
}

function isSameViewport(left: MapViewportState, right: MapViewportState): boolean {
  return left.zoom === right.zoom
    && left.north === right.north
    && left.south === right.south
    && left.east === right.east
    && left.west === right.west
}

function emptyNavFeatureCollection(): NavMapFeatureCollection {
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
    fetchedAt: 0
  }
}

function formatNavFrequency(value: number): string {
  if (!Number.isFinite(value)) return '--'
  if (value >= 1000) {
    return (value / 100).toFixed(2)
  }
  return String(value)
}
