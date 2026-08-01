import { DomUtil } from 'leaflet'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, Maximize2 } from 'lucide-react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { GeoReferencePoint } from '@shared/chart-types'
import type { FlightPlanPoint, FlightPlanSegment } from '@shared/flight-plan-types'
import type { VatsimMetarFeature, VatsimSelectableFeature, VatsimStatus } from '@shared/vatsim-types'
import { createAircraftLeafletIcon } from './AircraftArrow'
import { ConnectionBadge } from './ConnectionBadge'
import { MapDisplayToolbar } from './MapDisplayToolbar'
import { NavDataOverlay } from './NavDataOverlay'
import { VatsimDetailsDrawer } from './VatsimDetailsDrawer'
import { VatsimOverlay } from './VatsimOverlay'
import { SafeAreaTopInset } from './SafeAreaTopInset'
import { useAppStore } from '../store/useAppStore'
import { usePersistentMapDisplaySettings } from '../hooks/usePersistentMapDisplaySettings'
import { usePersistentVatsimDisplaySettings } from '../hooks/usePersistentVatsimDisplaySettings'
import { useMapOverlayChart } from '../hooks/useMapOverlayChart'
import { getMapTileConfig } from '../utils/mapTileProviders'
import {
  ROUTE_VISUAL_COLORS,
  buildRouteLegs,
  createMapSymbolLeafletIcon,
  findNearestRouteLegIndex,
  formatMapCoordinates,
  getFlightPlanPointSymbolKind,
  getRouteLegGeometry,
  getRouteVisualTheme
} from '../utils/mapVisuals'
import { Button } from './ui/button'

const MAP_VIEW_STORAGE_KEY = 'nextefb.map-view.v1'
const DEFAULT_MAP_ZOOM = 7
const DEFAULT_MAP_CENTERS: Record<'zh-CN' | 'en-US', { lat: number; lon: number }> = {
  'zh-CN': { lat: 31.2304, lon: 121.4737 },
  'en-US': { lat: 40.7128, lon: -74.006 }
}
const INITIAL_VATSIM_STATUS: VatsimStatus = {
  phase: 'connecting',
  revision: 0,
  fetchedAt: null,
  feedUpdatedAt: null,
  nextRefreshAt: null,
  lastError: null,
  counts: { pilots: 0, controllers: 0, atis: 0, connectedClients: 0 }
}

interface StoredMapView {
  lat: number
  lon: number
  zoom: number
}

type MapSelection =
  | { type: 'nav-feature'; key: string }
  | { type: 'route-point'; index: number }
  | { type: 'route-leg'; index: number }
  | null

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

function FlyToSearchTarget({
  target
}: {
  target: { lat: number; lon: number; key: number } | null
}) {
  const map = useMap()

  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 11), {
      animate: true,
      duration: 0.75
    })
  }, [map, target])

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
  const aircraft = useAppStore((state) => state.aircraft)
  const language = useAppStore((state) => state.language)
  const settings = useAppStore((state) => state.settings)
  const { navLayerVisibility, toggleNavLayer } = usePersistentMapDisplaySettings()
  const { vatsimLayerVisibility, toggleVatsimLayer } = usePersistentVatsimDisplaySettings()
  const [initialMapView] = useState<StoredMapView>(() => readStoredMapView(language))
  const aircraftPositionUsable = aircraft ? isAircraftPositionUsable(aircraft) : false
  const lat = aircraftPositionUsable ? (aircraft?.lat ?? initialMapView.lat) : initialMapView.lat
  const lon = aircraftPositionUsable ? (aircraft?.lon ?? initialMapView.lon) : initialMapView.lon
  const heading = aircraftPositionUsable ? (aircraft?.headingDeg ?? 0) : 0
  const [isFollowActive, setIsFollowActive] = useState(false)
  const [routeViewTrigger, setRouteViewTrigger] = useState(0)
  const [mapSelection, setMapSelection] = useState<MapSelection>(null)
  const [vatsimSelection, setVatsimSelection] = useState<VatsimSelectableFeature | null>(null)
  const [vatsimStatus, setVatsimStatus] = useState<VatsimStatus>(INITIAL_VATSIM_STATUS)
  const [vatsimWeather, setVatsimWeather] = useState<VatsimMetarFeature[]>([])
  const [searchTarget, setSearchTarget] = useState<{ lat: number; lon: number; key: number } | null>(null)
  const tileConfig = getMapTileConfig(settings?.mapTileProvider)
  const routeLegs = useMemo(
    () => buildRouteLegs(routeSegments, routePoints),
    [routePoints, routeSegments]
  )
  const activeRouteLegIndex = useMemo(
    () =>
      aircraftPositionUsable
        ? findNearestRouteLegIndex(routeLegs, lat, lon)
        : null,
    [aircraftPositionUsable, lat, lon, routeLegs]
  )
  const routeViewPoints = useMemo(() => {
    const points = routeSegments.length > 0 ? routeSegments.flatMap((segment) => segment.points) : routePoints
    return dedupeRoutePoints(points)
  }, [routePoints, routeSegments])
  const selectedNavFeatureKey =
    mapSelection?.type === 'nav-feature' ? mapSelection.key : null
  const selectedRoutePointIndex =
    mapSelection?.type === 'route-point' && mapSelection.index < routePoints.length
      ? mapSelection.index
      : null
  const selectedRouteLegIndex =
    mapSelection?.type === 'route-leg' && mapSelection.index < routeLegs.length
      ? mapSelection.index
      : null

  return (
    <section className="panel map-panel map-workspace-panel">
      <div className="map-stage">
        <MapContainer
          center={[initialMapView.lat, initialMapView.lon]}
          zoom={initialMapView.zoom}
          className="leaflet-map"
          zoomControl={false}
          attributionControl
          preferCanvas
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
          <NavDataOverlay
            layerVisibility={navLayerVisibility}
            airportWeather={vatsimWeather}
            selectedFeatureKey={selectedNavFeatureKey}
            onSelectFeature={(key) => {
              setVatsimSelection(null)
              setMapSelection((current) =>
                current?.type === 'nav-feature' && current.key === key
                  ? null
                  : { type: 'nav-feature', key }
              )
            }}
          />
          <VatsimOverlay
            layerVisibility={vatsimLayerVisibility}
            selectedFeature={vatsimSelection}
            airportWeatherEnabled={navLayerVisibility.airports}
            onStatusChange={setVatsimStatus}
            onWeatherChange={setVatsimWeather}
            onSelectFeature={(feature) => {
              setMapSelection(null)
              setVatsimSelection((current) => current?.id === feature?.id ? null : feature)
            }}
          />
          <ActiveChartOverlay chartId={activeChartId} />
          {routeLegs.map((leg, index) => {
            const isAircraftActive = activeRouteLegIndex === index
            const isSelected = selectedRouteLegIndex === index
            const geometry = getRouteLegGeometry(leg)
            const theme = getRouteVisualTheme(leg.phase)
            const dashed = Boolean(leg.dashed || leg.phase === 'missed')
            const positions: [[number, number], [number, number]] = [
              [leg.from.lat, leg.from.lon],
              [leg.to.lat, leg.to.lon]
            ]
            const selectLeg = () => {
              setVatsimSelection(null)
              setMapSelection((current) =>
                current?.type === 'route-leg' && current.index === index
                  ? null
                  : { type: 'route-leg', index }
              )
            }

            return (
              <Fragment key={`route-leg:${index}:${leg.from.ident}:${leg.to.ident}`}>
                <Polyline
                  positions={positions}
                  interactive={false}
                  pathOptions={{
                    color: ROUTE_VISUAL_COLORS[theme],
                    weight: 5.5,
                    opacity: dashed ? 0.84 : 0.96,
                    dashArray: dashed ? '9 10' : undefined,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: `map-route-line map-route-line--${theme}`
                  }}
                />
                {isSelected ? (
                  <Polyline
                    positions={positions}
                    interactive={false}
                    pathOptions={{
                      color: ROUTE_VISUAL_COLORS.active,
                      weight: 14,
                      opacity: 0.2,
                      dashArray: dashed ? '9 10' : undefined,
                      lineCap: 'round',
                      lineJoin: 'round',
                      className: 'map-route-selection-glow'
                    }}
                  />
                ) : null}
                {isAircraftActive || isSelected ? (
                  <Polyline
                    positions={positions}
                    interactive={false}
                    pathOptions={{
                      color: ROUTE_VISUAL_COLORS.active,
                      weight: isSelected ? 7 : 6,
                      opacity: 1,
                      dashArray: dashed ? '9 10' : undefined,
                      lineCap: 'round',
                      lineJoin: 'round',
                      className: `map-route-line map-route-line--active ${isSelected ? 'map-route-line--selected' : ''}`
                    }}
                  />
                ) : null}
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color: '#000000',
                    weight: 20,
                    opacity: 0,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'map-route-hit-area'
                  }}
                  eventHandlers={{
                    click: selectLeg
                  }}
                >
                  {isSelected ? (
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -8]}
                      opacity={1}
                      className="map-route-leg-tooltip is-selected"
                    >
                      <div className="map-info-card map-info-card--route-leg">
                        <strong>{`${leg.from.ident} → ${leg.to.ident}`}</strong>
                        <span className="map-info-card-kicker">
                          {(leg.phase ?? 'enroute').toUpperCase()}
                        </span>
                        <dl className="map-info-card-grid">
                          <div>
                            <dt>COURSE</dt>
                            <dd>{`${String(Math.round(geometry.bearingDeg)).padStart(3, '0')}°M`}</dd>
                          </div>
                          <div>
                            <dt>DISTANCE</dt>
                            <dd>
                              {`${geometry.distanceNm < 100 ? geometry.distanceNm.toFixed(1) : geometry.distanceNm.toFixed(0)} NM`}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </Tooltip>
                  ) : null}
                </Polyline>
              </Fragment>
            )
          })}
          {routePoints.map((point, index) => {
            const isSelected = selectedRoutePointIndex === index
            const isEndpoint = index === 0 || index === routePoints.length - 1
            const symbolKind = getFlightPlanPointSymbolKind(
              point,
              index,
              routePoints.length
            )
            const labelDirection =
              index === 0
                ? 'right'
                : index === routePoints.length - 1
                  ? 'left'
                  : index % 2 === 0
                    ? 'top'
                    : 'bottom'

            return (
              <Marker
                key={`${point.ident}:${index}`}
                position={[point.lat, point.lon]}
                icon={createMapSymbolLeafletIcon(
                  symbolKind,
                  isSelected ? 'selected' : 'route',
                  isEndpoint ? 26 : 20
                )}
                title={`${index + 1}. ${point.ident}`}
                riseOnHover
                zIndexOffset={isSelected ? 1100 : isEndpoint ? 760 : 680}
                eventHandlers={{
                  click: () => {
                    setVatsimSelection(null)
                    setMapSelection((current) =>
                      current?.type === 'route-point' && current.index === index
                        ? null
                        : { type: 'route-point', index }
                    )
                  }
                }}
              >
                <Tooltip
                  permanent={isSelected}
                  direction={labelDirection}
                  opacity={1}
                  className={`map-route-point-tooltip ${isSelected ? 'is-selected' : ''}`}
                >
                  <div className="map-info-card map-info-card--route-point">
                    <strong>{point.ident}</strong>
                    {isSelected ? (
                      <>
                        <span className="map-info-card-kicker">
                          {symbolKind.replace('-', ' ').toUpperCase()}
                        </span>
                        <dl className="map-info-card-grid">
                          <div>
                            <dt>SEQUENCE</dt>
                            <dd>{`${index + 1} / ${routePoints.length}`}</dd>
                          </div>
                          <div>
                            <dt>SOURCE</dt>
                            <dd>{point.source.toUpperCase()}</dd>
                          </div>
                          <div className="map-info-card-grid-wide">
                            <dt>POSITION</dt>
                            <dd>{formatMapCoordinates(point.lat, point.lon)}</dd>
                          </div>
                        </dl>
                      </>
                    ) : null}
                  </div>
                </Tooltip>
              </Marker>
            )
          })}
          <FitRouteView points={routeViewPoints} trigger={routeViewTrigger} />
          <FlyToSearchTarget target={searchTarget} />
          <FollowAircraft lat={lat} lon={lon} enabled={aircraftPositionUsable && isFollowActive} />
          <MapViewPersistence />
        </MapContainer>
        <VatsimDetailsDrawer feature={vatsimSelection} onClose={() => setVatsimSelection(null)} />
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
            <Maximize2 className="size-4" />
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
            <LocateFixed className="size-4" />
          </Button>
        </div>
        <div className="map-floating-toolbar">
          <SafeAreaTopInset className="map-safe-area-top" />
          <MapDisplayToolbar
            className="map-toolbar-inline"
            navLayerVisibility={navLayerVisibility}
            onToggleLayer={toggleNavLayer}
            vatsimLayerVisibility={vatsimLayerVisibility}
            vatsimStatus={vatsimStatus}
            onToggleVatsimLayer={toggleVatsimLayer}
            onVatsimStatusChange={setVatsimStatus}
            onSearchSelect={(result) => {
              setIsFollowActive(false)
              if (result.type === 'pilots') {
                if (!vatsimLayerVisibility.pilots) toggleVatsimLayer('pilots')
                setMapSelection(null)
                setVatsimSelection(result.pilot)
              } else {
                setVatsimSelection(null)
              }
              setSearchTarget({
                lat: result.lat,
                lon: result.lon,
                key: Date.now()
              })
            }}
          />
          <ConnectionBadge />
        </div>
      </div>
    </section>
  )
}
