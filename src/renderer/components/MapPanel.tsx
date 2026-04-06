import { DomUtil } from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { GeoReferencePoint } from '@shared/chart-types'
import type { FlightPlanPoint, FlightPlanSegment } from '@shared/flight-plan-types'
import type { NavMapFeatureCollection, NavMapLayerVisibility, NavMapQueryInput } from '@shared/nav-map-types'
import type { MapTileProvider } from '@shared/types'
import { createAircraftLeafletIcon } from './AircraftArrow'
import { ConnectionBadge } from './ConnectionBadge'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { useMapOverlayChart } from '../hooks/useMapOverlayChart'
import { getMapTileConfig } from '../utils/mapTileProviders'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from './ui/select'

const MAP_VIEW_STORAGE_KEY = 'nextefb.map-view.v1'
const DEFAULT_MAP_ZOOM = 7
const DEFAULT_NAV_LAYER_VISIBILITY: NavMapLayerVisibility = {
  airports: true,
  waypoints: true,
  vors: true,
  ndbs: true,
  airways: true
}
const DEFAULT_MAP_CENTERS: Record<'zh-CN' | 'en-US', { lat: number; lon: number }> = {
  'zh-CN': { lat: 31.2304, lon: 121.4737 },
  'en-US': { lat: 40.7128, lon: -74.006 }
}

interface StoredMapView {
  lat: number
  lon: number
  zoom: number
}

interface MapViewportState {
  north: number
  south: number
  east: number
  west: number
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

function readStoredMapView(language: 'zh-CN' | 'en-US'): StoredMapView {
  const defaultCenter = DEFAULT_MAP_CENTERS[language]

  if (typeof window === 'undefined') {
    return { ...defaultCenter, zoom: DEFAULT_MAP_ZOOM }
  }

  try {
    const raw = window.localStorage.getItem(MAP_VIEW_STORAGE_KEY)
    if (!raw) return { ...defaultCenter, zoom: DEFAULT_MAP_ZOOM }
    const parsed = JSON.parse(raw) as Partial<StoredMapView>
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lon !== 'number' ||
      typeof parsed.zoom !== 'number'
    ) {
      return { ...defaultCenter, zoom: DEFAULT_MAP_ZOOM }
    }
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon) || !Number.isFinite(parsed.zoom)) {
      return { ...defaultCenter, zoom: DEFAULT_MAP_ZOOM }
    }
    return {
      lat: Math.max(-90, Math.min(90, parsed.lat)),
      lon: Math.max(-180, Math.min(180, parsed.lon)),
      zoom: Math.max(1, Math.min(19, parsed.zoom))
    }
  } catch {
    return { ...defaultCenter, zoom: DEFAULT_MAP_ZOOM }
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

function FitRouteView({
  points,
  trigger
}: {
  points: FlightPlanPoint[]
  trigger: number
}) {
  const map = useMap()

  useEffect(() => {
    if (trigger === 0 || points.length === 0) return

    if (points.length === 1) {
      const [point] = points
      map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 11), {
        animate: true,
        duration: 0.75
      })
      return
    }

    map.fitBounds(
      points.map((point) => [point.lat, point.lon] as [number, number]),
      {
        padding: [48, 48],
        animate: true
      }
    )
  }, [map, points, trigger])

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

function ActiveChartOverlay({ chartId }: { chartId: string | null }) {
  const overlay = useMapOverlayChart(chartId)
  const settings = useAppStore((state) => state.settings)

  if (!chartId) return null

  return (
    <ChartOverlay
      rasterUrl={overlay.rasterUrl}
      width={overlay.width}
      height={overlay.height}
      points={overlay.points}
      opacity={Math.max(0, Math.min(1, (settings?.chartOpacity ?? 100) / 100))}
      zIndex={120}
    />
  )
}

function dedupeRoutePoints(points: FlightPlanPoint[]): FlightPlanPoint[] {
  const output: FlightPlanPoint[] = []
  for (const point of points) {
    const prev = output[output.length - 1]
    if (prev && Math.abs(prev.lat - point.lat) < 1e-7 && Math.abs(prev.lon - point.lon) < 1e-7) {
      continue
    }
    output.push(point)
  }
  return output
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

function NavDataOverlay({
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
            color: airway.airwayType === 'JET' ? '#89d0ff' : '#77e5c2',
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
            color: '#06253a',
            weight: 1,
            fillColor: '#ff8f6a',
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
            color: '#073451',
            weight: 1,
            fillColor: '#7ec7ff',
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
            color: '#4a2d07',
            weight: 1,
            fillColor: '#f5c76d',
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
            color: '#234508',
            weight: 1,
            fillColor: '#c9f27d',
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

function formatNavFrequency(value: number): string {
  if (!Number.isFinite(value)) return '--'
  if (value >= 1000) {
    return (value / 100).toFixed(2)
  }
  return String(value)
}

export function MapPanel({
  activeChartId,
  routePoints,
  routeSegments
}: {
  activeChartId: string | null
  routePoints: FlightPlanPoint[]
  routeSegments: FlightPlanSegment[]
}) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const aircraft = useAppStore((state) => state.aircraft)
  const language = useAppStore((state) => state.language)
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const [initialMapView] = useState<StoredMapView>(() => readStoredMapView(language))
  const aircraftPositionUsable = aircraft ? isAircraftPositionUsable(aircraft) : false
  const lat = aircraftPositionUsable ? (aircraft?.lat ?? initialMapView.lat) : initialMapView.lat
  const lon = aircraftPositionUsable ? (aircraft?.lon ?? initialMapView.lon) : initialMapView.lon
  const heading = aircraftPositionUsable ? (aircraft?.headingDeg ?? 0) : 0
  const [isFollowActive, setIsFollowActive] = useState(false)
  const [routeViewTrigger, setRouteViewTrigger] = useState(0)
  const [navLayerVisibility, setNavLayerVisibility] = useState<NavMapLayerVisibility>(
    DEFAULT_NAV_LAYER_VISIBILITY
  )
  const tileConfig = getMapTileConfig(settings?.mapTileProvider)
  const routeViewPoints = useMemo(() => {
    const points = routeSegments.length > 0 ? routeSegments.flatMap((segment) => segment.points) : routePoints
    return dedupeRoutePoints(points)
  }, [routePoints, routeSegments])

  const updateMapTileProvider = async (mapTileProvider: MapTileProvider): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ mapTileProvider })
    setSettings(nextSettings)
  }

  const toggleNavLayer = (key: keyof NavMapLayerVisibility) => {
    setNavLayerVisibility((current) => ({
      ...current,
      [key]: !current[key]
    }))
  }

  return (
    <section className="panel map-panel map-workspace-panel">
      <div className="map-stage">
        <MapContainer
          center={[initialMapView.lat, initialMapView.lon]}
          zoom={initialMapView.zoom}
          className="leaflet-map"
          zoomControl={false}
          attributionControl
        >
          <TileLayer
            attribution={tileConfig.attribution}
            url={tileConfig.url}
            updateWhenIdle={false}
            referrerPolicy="strict-origin-when-cross-origin"
            {...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})}
          />
          {aircraftPositionUsable ? (
            <Marker
              position={[lat, lon]}
              icon={createAircraftLeafletIcon(heading)}
              title={t('map.aircraftMarker')}
            />
          ) : null}
          <NavDataOverlay layerVisibility={navLayerVisibility} />
          <ActiveChartOverlay chartId={activeChartId} />
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
          <FitRouteView points={routeViewPoints} trigger={routeViewTrigger} />
          <FollowAircraft lat={lat} lon={lon} enabled={aircraftPositionUsable && isFollowActive} />
          <MapViewPersistence />
        </MapContainer>
        <div className="map-coordinates">
          <span>{`${t('map.lat')} ${formatCoord(aircraftPositionUsable ? aircraft?.lat : undefined)}`}</span>
          <span>{`${t('map.lon')} ${formatCoord(aircraftPositionUsable ? aircraft?.lon : undefined)}`}</span>
        </div>
        <div className="map-control-stack">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="map-route-fit-button"
            aria-label={t('map.fitRoute')}
            title={t('map.fitRoute')}
            disabled={routeViewPoints.length === 0}
            onClick={() => {
              setIsFollowActive(false)
              setRouteViewTrigger((current) => current + 1)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 4H9V6H6V9H4V4ZM15 4H20V9H18V6H15V4ZM4 15H6V18H9V20H4V15ZM18 15H20V20H15V18H18V15Z" />
            </svg>
          </Button>
          <Button
            type="button"
            variant={isFollowActive ? 'default' : 'outline'}
            size="icon"
            className={`map-recenter-button ${isFollowActive ? 'is-active' : ''}`}
            aria-label={isFollowActive ? t('map.followAircraftStop') : t('map.followAircraftStart')}
            title={isFollowActive ? t('map.followAircraftStop') : t('map.followAircraftStart')}
            disabled={!aircraftPositionUsable}
            aria-pressed={isFollowActive}
            onClick={() => setIsFollowActive((current) => !current)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.75A9.25 9.25 0 1 0 21.25 12A9.26 9.26 0 0 0 12 2.75Zm0 2A7.25 7.25 0 1 1 4.75 12A7.26 7.26 0 0 1 12 4.75Zm0 1.75A5.5 5.5 0 1 0 17.5 12A5.51 5.51 0 0 0 12 6.5Zm0 2A3.5 3.5 0 1 1 8.5 12A3.5 3.5 0 0 1 12 8.5Z" />
            </svg>
          </Button>
        </div>
        <div className="map-floating-toolbar">
          <div className="map-nav-layer-group" role="group" aria-label="Navigation layers">
            <Button
              type="button"
              variant={navLayerVisibility.airports ? 'default' : 'outline'}
              className="map-nav-layer-button"
              onClick={() => toggleNavLayer('airports')}
            >
              APT
            </Button>
            <Button
              type="button"
              variant={navLayerVisibility.airways ? 'default' : 'outline'}
              className="map-nav-layer-button"
              onClick={() => toggleNavLayer('airways')}
            >
              AWY
            </Button>
            <Button
              type="button"
              variant={navLayerVisibility.vors ? 'default' : 'outline'}
              className="map-nav-layer-button"
              onClick={() => toggleNavLayer('vors')}
            >
              VOR
            </Button>
            <Button
              type="button"
              variant={navLayerVisibility.ndbs ? 'default' : 'outline'}
              className="map-nav-layer-button"
              onClick={() => toggleNavLayer('ndbs')}
            >
              NDB
            </Button>
            <Button
              type="button"
              variant={navLayerVisibility.waypoints ? 'default' : 'outline'}
              className="map-nav-layer-button"
              onClick={() => toggleNavLayer('waypoints')}
            >
              WPT
            </Button>
          </div>
          <Select
            value={settings?.mapTileProvider ?? 'osm'}
            onValueChange={(value) => {
              void updateMapTileProvider(value as MapTileProvider)
            }}
          >
            <SelectTrigger
              className="map-provider-trigger map-provider-trigger-icon"
              aria-label={t('settings.mapTileProvider')}
              title={t('settings.mapTileProvider')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="map-provider-icon">
                <path d="M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z" />
                <path d="M9 3V18M15 6V21" />
              </svg>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="esriWorldStreet">{t('settings.mapTileProviderEsriWorldStreet')}</SelectItem>
              <SelectItem value="osm">{t('settings.mapTileProviderOsm')}</SelectItem>
              <SelectItem value="osmHot">{t('settings.mapTileProviderOsmHot')}</SelectItem>
              <SelectItem value="cartoLight">{t('settings.mapTileProviderCartoLight')}</SelectItem>
              <SelectItem value="cartoVoyager">{t('settings.mapTileProviderCartoVoyager')}</SelectItem>
              <SelectItem value="osmfr">{t('settings.mapTileProviderOsmFr')}</SelectItem>
            </SelectContent>
          </Select>
          <ConnectionBadge />
        </div>
      </div>
    </section>
  )
}
