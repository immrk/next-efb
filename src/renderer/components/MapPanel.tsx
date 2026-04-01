import { DomUtil } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { GeoReferencePoint } from '@shared/chart-types'
import type { FlightPlanPoint, FlightPlanSegment } from '@shared/flight-plan-types'
import type { MapTileProvider } from '@shared/types'
import { createAircraftLeafletIcon } from './AircraftArrow'
import { ConnectionBadge } from './ConnectionBadge'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { useMapOverlayChart } from '../hooks/useMapOverlayChart'
import { getMapTileConfig } from '../utils/mapTileProviders'

const MAP_VIEW_STORAGE_KEY = 'nextefb.map-view.v1'
const DEFAULT_MAP_CENTER = { lat: 31.2304, lon: 121.4737 }
const DEFAULT_MAP_ZOOM = 7

interface StoredMapView {
  lat: number
  lon: number
  zoom: number
}

function isAircraftPositionUsable(aircraft: {
  connected: boolean
  lat: number
  lon: number
  altitudeFt: number
}): boolean {
  if (!aircraft.connected) return false
  if (!Number.isFinite(aircraft.lat) || !Number.isFinite(aircraft.lon)) return false
  if (Math.abs(aircraft.lat) > 90 || Math.abs(aircraft.lon) > 180) return false
  return !(aircraft.lat === 0 && aircraft.lon === 0 && aircraft.altitudeFt === 0)
}

function readStoredMapView(): StoredMapView {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
  }

  try {
    const raw = window.localStorage.getItem(MAP_VIEW_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
    const parsed = JSON.parse(raw) as Partial<StoredMapView>
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lon !== 'number' ||
      typeof parsed.zoom !== 'number'
    ) {
      return { ...DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
    }
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon) || !Number.isFinite(parsed.zoom)) {
      return { ...DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
    }
    return {
      lat: Math.max(-90, Math.min(90, parsed.lat)),
      lon: Math.max(-180, Math.min(180, parsed.lon)),
      zoom: Math.max(1, Math.min(19, parsed.zoom))
    }
  } catch {
    return { ...DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
  }
}

function MapViewPersistence() {
  const map = useMap()

  useEffect(() => {
    const persist = () => {
      const center = map.getCenter()
      const zoom = map.getZoom()
      const payload: StoredMapView = {
        lat: center.lat,
        lon: center.lng,
        zoom
      }
      window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(payload))
    }

    map.on('moveend', persist)
    map.on('zoomend', persist)
    persist()

    return () => {
      map.off('moveend', persist)
      map.off('zoomend', persist)
    }
  }, [map])

  return null
}

function formatCoord(value: number | undefined): string {
  if (typeof value !== 'number') return '--'
  return value.toFixed(4)
}

function FollowAircraft({
  lat,
  lon,
  enabled
}: {
  lat: number
  lon: number
  enabled: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) return
    map.flyTo([lat, lon], map.getZoom(), {
      animate: true,
      duration: 0.75
    })
  }, [enabled, lat, lon, map])

  return null
}

function RecenterMap({
  lat,
  lon,
  trigger
}: {
  lat: number
  lon: number
  trigger: number
}) {
  const map = useMap()

  useEffect(() => {
    if (trigger === 0) return
    map.flyTo([lat, lon], map.getZoom(), {
      animate: true,
      duration: 0.6
    })
  }, [lat, lon, map, trigger])

  return null
}

function ChartOverlay({
  rasterUrl,
  width,
  height,
  points,
  opacity,
  zIndex
}: {
  rasterUrl: string | null
  width: number | null
  height: number | null
  points: GeoReferencePoint[]
  opacity: number
  zIndex: number
}) {
  const map = useMap()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!rasterUrl || !width || !height || points.length !== 2) return

    const pane = map.getPanes().overlayPane
    const container = containerRef.current ?? DomUtil.create('div', 'chart-overlay-container', pane)
    const image = imageRef.current ?? DomUtil.create('img', 'chart-overlay-image', container)

    containerRef.current = container
    imageRef.current = image
    image.src = rasterUrl
    image.style.width = `${width}px`
    image.style.height = `${height}px`
    image.style.opacity = String(opacity)
    container.style.zIndex = String(zIndex)

    const [p1, p2] = points

    const update = () => {
      const layerA = map.latLngToLayerPoint([p1.mapLat, p1.mapLon])
      const layerB = map.latLngToLayerPoint([p2.mapLat, p2.mapLon])
      const chartA = { x: p1.chartX, y: p1.chartY }
      const chartB = { x: p2.chartX, y: p2.chartY }
      const vMap = { x: layerB.x - layerA.x, y: layerB.y - layerA.y }
      const vChart = { x: chartB.x - chartA.x, y: chartB.y - chartA.y }
      const chartLen = Math.hypot(vChart.x, vChart.y)
      const mapLen = Math.hypot(vMap.x, vMap.y)

      if (!chartLen || !mapLen) return

      const scale = mapLen / chartLen
      const angle = Math.atan2(vMap.y, vMap.x) - Math.atan2(vChart.y, vChart.x)
      const a = scale * Math.cos(angle)
      const b = scale * Math.sin(angle)
      const c = -scale * Math.sin(angle)
      const d = scale * Math.cos(angle)
      const e = layerA.x - a * chartA.x - c * chartA.y
      const f = layerA.y - b * chartA.x - d * chartA.y

      image.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`
    }

    update()
    map.on('zoom viewreset move moveend resize', update)

    return () => {
      map.off('zoom viewreset move moveend resize', update)
      container.remove()
      containerRef.current = null
      imageRef.current = null
    }
  }, [height, map, opacity, points, rasterUrl, width, zIndex])

  return null
}

function MountedChartOverlay({
  chartId,
  isActive,
  stackIndex
}: {
  chartId: string
  isActive: boolean
  stackIndex: number
}) {
  const overlay = useMapOverlayChart(chartId)

  return (
    <ChartOverlay
      rasterUrl={overlay.rasterUrl}
      width={overlay.width}
      height={overlay.height}
      points={overlay.points}
      opacity={isActive ? 0.78 : 0.34}
      zIndex={100 + stackIndex}
    />
  )
}

export function MapPanel({
  mountedChartIds,
  activeChartId,
  routePoints,
  routeSegments
}: {
  mountedChartIds: string[]
  activeChartId: string | null
  routePoints: FlightPlanPoint[]
  routeSegments: FlightPlanSegment[]
}) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const aircraft = useAppStore((state) => state.aircraft)
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const [initialMapView] = useState<StoredMapView>(() => readStoredMapView())
  const aircraftPositionUsable = aircraft ? isAircraftPositionUsable(aircraft) : false
  const lat = aircraftPositionUsable ? (aircraft?.lat ?? initialMapView.lat) : initialMapView.lat
  const lon = aircraftPositionUsable ? (aircraft?.lon ?? initialMapView.lon) : initialMapView.lon
  const heading = aircraftPositionUsable ? (aircraft?.headingDeg ?? 0) : 0
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const tileConfig = getMapTileConfig(settings?.mapTileProvider)

  const updateMapTileProvider = async (mapTileProvider: MapTileProvider): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ mapTileProvider })
    setSettings(nextSettings)
  }

  return (
    <section className="panel map-panel map-workspace-panel">
      <div className="map-stage">
        <MapContainer
          center={[initialMapView.lat, initialMapView.lon]}
          zoom={initialMapView.zoom}
          className="leaflet-map"
          zoomControl
          attributionControl
        >
          <TileLayer
            attribution={tileConfig.attribution}
            url={tileConfig.url}
            subdomains={tileConfig.subdomains}
          />
          {aircraftPositionUsable ? (
            <Marker
              position={[lat, lon]}
              icon={createAircraftLeafletIcon(heading)}
              title={t('map.aircraftMarker')}
            />
          ) : null}
          {mountedChartIds.map((chartId, index) => (
            <MountedChartOverlay
              key={chartId}
              chartId={chartId}
              isActive={chartId === activeChartId}
              stackIndex={index}
            />
          ))}
          {routeSegments.length > 0
            ? routeSegments.map((segment, index) =>
                segment.points.length > 1 ? (
                  <Polyline
                    key={`segment:${index}`}
                    positions={segment.points.map((point) => [point.lat, point.lon])}
                    pathOptions={{
                      color: segment.color ?? '#ffcf5a',
                      weight: 3,
                      opacity: segment.dashed ? 0.75 : 0.92,
                      dashArray: segment.dashed ? '10 10' : undefined,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }}
                  />
                ) : null
              )
            : routePoints.length > 1 ? (
                <Polyline
                  positions={routePoints.map((point) => [point.lat, point.lon])}
                  pathOptions={{ color: '#ffcf5a', weight: 3, opacity: 0.9 }}
                />
              )
            : null}
          {routePoints.map((point, index) => (
            <CircleMarker
              key={`${point.ident}:${index}`}
              center={[point.lat, point.lon]}
              radius={index === 0 || index === routePoints.length - 1 ? 6 : 4}
              pathOptions={{
                color: '#0a1a2b',
                weight: 1,
                fillColor: index === 0 || index === routePoints.length - 1 ? '#ff7f50' : '#ffd46c',
                fillOpacity: 0.95
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>{`${index + 1}. ${point.ident}`}</Tooltip>
            </CircleMarker>
          ))}
          <FollowAircraft
            lat={lat}
            lon={lon}
            enabled={aircraftPositionUsable && (settings?.followAircraft ?? true)}
          />
          <RecenterMap lat={lat} lon={lon} trigger={aircraftPositionUsable ? recenterTrigger : 0} />
          <MapViewPersistence />
        </MapContainer>
        <div className="map-coordinates">
          <span>{`${t('map.lat')} ${formatCoord(aircraftPositionUsable ? aircraft?.lat : undefined)}`}</span>
          <span>{`${t('map.lon')} ${formatCoord(aircraftPositionUsable ? aircraft?.lon : undefined)}`}</span>
        </div>
        <button
          type="button"
          className="map-recenter-button"
          aria-label={t('map.recenter')}
          disabled={!aircraftPositionUsable}
          onClick={() => setRecenterTrigger((current) => current + 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3L18 16H13V21H11V16H6L12 3Z" />
          </svg>
        </button>
        <div className="map-floating-toolbar">
          <label className="map-provider-chip" aria-label={t('settings.mapTileProvider')}>
            <select
              value={settings?.mapTileProvider ?? 'osm'}
              onChange={(event) => {
                void updateMapTileProvider(event.target.value as MapTileProvider)
              }}
            >
              <option value="osm">{t('settings.mapTileProviderOsm')}</option>
              <option value="cartoLight">{t('settings.mapTileProviderCartoLight')}</option>
              <option value="osmfr">{t('settings.mapTileProviderOsmFr')}</option>
            </select>
          </label>
          <ConnectionBadge />
        </div>
      </div>
    </section>
  )
}
