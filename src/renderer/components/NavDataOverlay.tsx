import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { NavMapFeatureCollection, NavMapLayerVisibility, NavMapQueryInput } from '@shared/nav-map-types'
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
  selectedFeatureKey = null,
  onSelectFeature
}: {
  layerVisibility: NavMapLayerVisibility
  selectedFeatureKey?: string | null
  onSelectFeature?: (key: string) => void
}) {
  const map = useMap()
  const appClient = getAppClient()
  const [viewport, setViewport] = useState<MapViewportState>(() => readViewportState(map))
  const [features, setFeatures] = useState<NavMapFeatureCollection>(() => emptyNavFeatureCollection())
  const requestIdRef = useRef(0)

  const effectiveLayers = useMemo(
    () => getEffectiveNavLayerVisibility(layerVisibility, viewport.zoom),
    [layerVisibility, viewport.zoom]
  )

  useEffect(() => {
    const hasActiveLayer = Object.values(effectiveLayers).some(Boolean)
    if (!hasActiveLayer) {
      setFeatures(emptyNavFeatureCollection())
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const input: NavMapQueryInput = {
      viewport,
      layers: effectiveLayers
    }

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
  }, [appClient, effectiveLayers, viewport])

  return (
    <>
      <MapViewportBridge onViewportChange={setViewport} />

      {features.airways.map((airway) => (
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

      {features.airports.map((airport) => {
        const featureKey = `airport:${airport.id}`
        const isSelected = selectedFeatureKey === featureKey
        const kind = getAirportMapSymbolKind(airport)
        const isMajor = kind === 'airport'
        const size = isMajor ? 24 : 19
        const isLabelVisible = isSelected || viewport.zoom >= (isMajor ? 7 : 9)

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
              click: () => onSelectFeature?.(featureKey)
            }}
          >
            <Tooltip
              permanent={isLabelVisible}
              direction="right"
              opacity={1}
              className={`map-nav-tooltip map-nav-tooltip--airport ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="map-info-card map-info-card--nav">
                <strong>{airport.ident}</strong>
                {isSelected ? (
                  <>
                    <span className="map-info-card-kicker">
                      {isMajor ? 'MAJOR AIRPORT' : 'REGIONAL AIRPORT'}
                    </span>
                    {airport.name ? (
                      <span className="map-info-card-description">{airport.name}</span>
                    ) : null}
                    <dl className="map-info-card-grid">
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
                  </>
                ) : null}
              </div>
            </Tooltip>
          </Marker>
        )
      })}

      {features.vors.map((vor) => {
        const featureKey = `vor:${vor.id}`
        const isSelected = selectedFeatureKey === featureKey
        const kind = getVorMapSymbolKind(vor)
        const ident = vor.ident ?? (kind === 'dme' ? 'DME' : 'VOR')
        const frequency = vor.frequency ? formatNavFrequency(vor.frequency) : null

        return (
          <Marker
            key={featureKey}
            position={[vor.lat, vor.lon]}
            icon={createMapSymbolLeafletIcon(kind, isSelected ? 'selected' : 'default', 20)}
            title={frequency ? `${ident} · ${frequency}` : ident}
            riseOnHover
            zIndexOffset={isSelected ? 900 : 320}
            eventHandlers={{
              click: () => onSelectFeature?.(featureKey)
            }}
          >
            <Tooltip
              permanent={isSelected || viewport.zoom >= 9}
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
            </Tooltip>
          </Marker>
        )
      })}

      {features.ndbs.map((ndb) => {
        const featureKey = `ndb:${ndb.id}`
        const isSelected = selectedFeatureKey === featureKey
        const ident = ndb.ident ?? 'NDB'

        return (
          <Marker
            key={featureKey}
            position={[ndb.lat, ndb.lon]}
            icon={createMapSymbolLeafletIcon('ndb', isSelected ? 'selected' : 'default', 19)}
            title={ndb.frequency ? `${ident} · ${ndb.frequency}` : ident}
            riseOnHover
            zIndexOffset={isSelected ? 900 : 300}
            eventHandlers={{
              click: () => onSelectFeature?.(featureKey)
            }}
          >
            <Tooltip
              permanent={isSelected || viewport.zoom >= 9}
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
            </Tooltip>
          </Marker>
        )
      })}

      {features.waypoints.map((waypoint) => {
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
              click: () => onSelectFeature?.(featureKey)
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
