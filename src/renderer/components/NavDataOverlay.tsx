import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { NavMapFeatureCollection, NavMapLayerVisibility, NavMapQueryInput } from '@shared/nav-map-types'
import { getAppClient } from '../client'

interface MapViewportState {
  north: number
  south: number
  east: number
  west: number
  zoom: number
}

export function NavDataOverlay({
  layerVisibility
}: {
  layerVisibility: NavMapLayerVisibility
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
            color: 'var(--primary)',
            weight: 1.5,
            opacity: 0.55
          }}
        >
          <Tooltip sticky>{`${airway.name} ${airway.airwayType}`}</Tooltip>
        </Polyline>
      ))}

      {features.airports.map((airport) => (
        <CircleMarker
          key={`airport:${airport.id}`}
          center={[airport.lat, airport.lon]}
          radius={5}
          pathOptions={{
            color: 'var(--background)',
            weight: 1,
            fillColor: 'var(--primary)',
            fillOpacity: 0.92
          }}
        >
          <Tooltip direction="top" offset={[0, -4]}>
            {airport.ident}
            {airport.name ? ` · ${airport.name}` : ''}
          </Tooltip>
        </CircleMarker>
      ))}

      {features.vors.map((vor) => (
        <CircleMarker
          key={`vor:${vor.id}`}
          center={[vor.lat, vor.lon]}
          radius={4}
          pathOptions={{
            color: 'var(--background)',
            weight: 1,
            fillColor: 'var(--primary)',
            fillOpacity: 0.88
          }}
        >
          <Tooltip direction="top" offset={[0, -4]}>
            {vor.ident ?? 'VOR'}
            {vor.frequency ? ` · ${formatNavFrequency(vor.frequency)}` : ''}
          </Tooltip>
        </CircleMarker>
      ))}

      {features.ndbs.map((ndb) => (
        <CircleMarker
          key={`ndb:${ndb.id}`}
          center={[ndb.lat, ndb.lon]}
          radius={3.5}
          pathOptions={{
            color: 'var(--background)',
            weight: 1,
            fillColor: 'var(--primary)',
            fillOpacity: 0.88
          }}
        >
          <Tooltip direction="top" offset={[0, -4]}>
            {ndb.ident ?? 'NDB'}
            {ndb.frequency ? ` · ${ndb.frequency}` : ''}
          </Tooltip>
        </CircleMarker>
      ))}

      {features.waypoints.map((waypoint) => (
        <CircleMarker
          key={`waypoint:${waypoint.id}`}
          center={[waypoint.lat, waypoint.lon]}
          radius={3}
          pathOptions={{
            color: 'var(--background)',
            weight: 1,
            fillColor: 'var(--primary)',
            fillOpacity: 0.82
          }}
        >
          <Tooltip direction="top" offset={[0, -4]}>
            {waypoint.ident}
            {waypoint.type ? ` · ${waypoint.type}` : ''}
          </Tooltip>
        </CircleMarker>
      ))}
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
