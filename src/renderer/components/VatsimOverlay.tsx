import { divIcon } from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type {
  VatsimMapFeatureCollection,
  VatsimMapLayerVisibility,
  VatsimMetarFeature,
  VatsimSelectableFeature,
  VatsimStatus
} from '@shared/vatsim-types'
import type { NavMapViewport } from '@shared/nav-map-types'
import { getAppClient } from '../client'

const ATIS_ICON = divIcon({
  className: 'vatsim-atis-icon-shell',
  html: '<span class="vatsim-atis-icon-shape">A</span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
})

// The Lucide plane path points north-east in its unrotated viewBox.
const PILOT_ICON_BASE_HEADING_DEG = 45

export function VatsimOverlay({
  layerVisibility,
  selectedFeature,
  airportWeatherEnabled,
  onSelectFeature,
  onStatusChange,
  onWeatherChange
}: {
  layerVisibility: VatsimMapLayerVisibility
  selectedFeature: VatsimSelectableFeature | null
  airportWeatherEnabled: boolean
  onSelectFeature: (feature: VatsimSelectableFeature | null) => void
  onStatusChange: (status: VatsimStatus) => void
  onWeatherChange: (weather: VatsimMetarFeature[]) => void
}) {
  const { t } = useTranslation()
  const map = useMap()
  const appClient = getAppClient()
  const [viewport, setViewport] = useState<NavMapViewport>(() => readViewport(map))
  const [revision, setRevision] = useState(0)
  const [features, setFeatures] = useState<VatsimMapFeatureCollection | null>(null)
  const requestIdRef = useRef(0)
  const updateViewport = useCallback((next: NavMapViewport) => {
    setViewport((current) => isSameViewport(current, next) ? current : next)
  }, [])
  const selectedFeatureId = selectedFeature?.id ?? null
  const effectiveLayers = useMemo(
    () => getEffectiveLayers(layerVisibility, airportWeatherEnabled, viewport.zoom),
    [airportWeatherEnabled, layerVisibility, viewport.zoom]
  )

  useEffect(() => appClient.onVatsimChanged((status) => {
    onStatusChange(status)
    setRevision(status.revision)
  }), [appClient, onStatusChange])

  useEffect(() => {
    let active = true
    void appClient.getVatsimStatus().then((status) => {
      if (active) onStatusChange(status)
    }).catch(() => void 0)
    return () => {
      active = false
    }
  }, [appClient, onStatusChange])

  useEffect(() => {
    if (!hasActiveDataLayer(effectiveLayers)) {
      setFeatures(null)
      onWeatherChange([])
      return
    }

    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(() => {
      void appClient.getVatsimMapFeatures({ viewport, layers: effectiveLayers })
        .then((result) => {
          if (requestIdRef.current !== requestId) return
          setFeatures(result)
          onStatusChange(result.status)
          onWeatherChange(result.weather)
        })
        .catch(() => void 0)
    }, 120)

    return () => window.clearTimeout(timer)
  }, [appClient, effectiveLayers, onStatusChange, onWeatherChange, revision, viewport])

  return (
    <>
      <VatsimViewportBridge onViewportChange={updateViewport} />

      {effectiveLayers.controllerCoverage ? features?.controllers.map((controller) => (
        <Circle
          key={`coverage:${controller.id}`}
          center={[controller.lat, controller.lon]}
          radius={controller.coverageRadiusNm * 1852}
          interactive={false}
          pathOptions={{
            color: '#7c5cff',
            fillColor: '#7c5cff',
            fillOpacity: 0.055,
            opacity: 0.34,
            weight: 1.25,
            className: 'vatsim-controller-coverage'
          }}
        />
      )) : null}

      {features?.pilotClusters.map((cluster) => (
        <CircleMarker
          key={cluster.id}
          center={[cluster.lat, cluster.lon]}
          radius={Math.min(22, 9 + Math.log2(cluster.count + 1) * 2.3)}
          pathOptions={{
            color: '#2dd4bf',
            fillColor: '#0f766e',
            fillOpacity: 0.88,
            opacity: 0.95,
            weight: 2,
            className: 'vatsim-pilot-cluster'
          }}
          eventHandlers={{ click: () => map.flyTo([cluster.lat, cluster.lon], Math.max(6, viewport.zoom + 2)) }}
        >
          <Tooltip permanent direction="center" className="vatsim-cluster-label">
            {cluster.count}
          </Tooltip>
        </CircleMarker>
      ))}

      {layerVisibility.controllers ? features?.controllers.map((controller) => (
        <CircleMarker
          key={controller.id}
          center={[controller.lat, controller.lon]}
          radius={selectedFeatureId === controller.id ? 10 : 8}
          pathOptions={{
            color: '#c4b5fd',
            fillColor: '#6d28d9',
            fillOpacity: 0.92,
            opacity: 1,
            weight: selectedFeatureId === controller.id ? 4 : 2,
            className: 'vatsim-controller-marker'
          }}
          eventHandlers={{ click: () => onSelectFeature(controller) }}
        >
          <Tooltip
            permanent={effectiveLayers.labels && viewport.zoom >= 7}
            direction="right"
            className="vatsim-map-tooltip"
          >
            <strong>{controller.callsign}</strong>
            {controller.frequencies[0] ? <span>{controller.frequencies[0]}</span> : null}
          </Tooltip>
        </CircleMarker>
      )) : null}

      {features?.atis.map((atis) => (
        <Marker
          key={atis.id}
          position={[atis.lat, atis.lon]}
          icon={ATIS_ICON}
          zIndexOffset={520}
          eventHandlers={{ click: () => onSelectFeature(atis) }}
        >
          <Tooltip direction="right" className="vatsim-map-tooltip">
            <strong>{atis.callsign}</strong>
            {atis.frequency ? <span>{atis.frequency}</span> : null}
          </Tooltip>
        </Marker>
      ))}

      {features?.pilots.map((pilot) => (
        <Marker
          key={pilot.id}
          position={[pilot.lat, pilot.lon]}
          icon={createPilotIcon(pilot.headingDeg, selectedFeatureId === pilot.id)}
          zIndexOffset={selectedFeatureId === pilot.id ? 1000 : 620}
          eventHandlers={{ click: () => onSelectFeature(pilot) }}
        >
          {selectedFeatureId === pilot.id ? (
            <Tooltip permanent direction="right" className="vatsim-map-tooltip is-selected">
              <strong>{pilot.callsign}</strong>
              <span>{`${pilot.altitudeFt.toLocaleString()} ${t('vatsim.unitFeet')}`}</span>
            </Tooltip>
          ) : null}
        </Marker>
      ))}
    </>
  )
}

function VatsimViewportBridge({ onViewportChange }: { onViewportChange: (value: NavMapViewport) => void }) {
  const map = useMapEvents({
    moveend: () => onViewportChange(readViewport(map)),
    zoomend: () => onViewportChange(readViewport(map))
  })

  useEffect(() => onViewportChange(readViewport(map)), [map, onViewportChange])
  return null
}

function readViewport(map: ReturnType<typeof useMap>): NavMapViewport {
  const bounds = map.getBounds()
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
    zoom: map.getZoom()
  }
}

function isSameViewport(left: NavMapViewport, right: NavMapViewport): boolean {
  return left.zoom === right.zoom
    && left.north === right.north
    && left.south === right.south
    && left.east === right.east
    && left.west === right.west
}

function getEffectiveLayers(
  requested: VatsimMapLayerVisibility,
  airportWeatherEnabled: boolean,
  zoom: number
): VatsimMapLayerVisibility {
  return {
    pilots: requested.pilots,
    controllers: requested.controllers || requested.controllerCoverage,
    controllerCoverage: requested.controllerCoverage,
    atis: requested.atis && zoom >= 6,
    weather: airportWeatherEnabled && zoom >= 6,
    labels: requested.labels
  }
}

function hasActiveDataLayer(layers: VatsimMapLayerVisibility): boolean {
  return layers.pilots || layers.controllers || layers.controllerCoverage || layers.atis || layers.weather
}

function createPilotIcon(headingDeg: number, selected: boolean) {
  const heading = Number.isFinite(headingDeg) ? ((headingDeg % 360) + 360) % 360 : 0
  const iconRotation = (heading - PILOT_ICON_BASE_HEADING_DEG + 360) % 360
  return divIcon({
    className: `vatsim-pilot-icon-shell ${selected ? 'is-selected' : ''}`,
    html: `<svg class="vatsim-pilot-icon-shape" style="transform:rotate(${iconRotation}deg)" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}
