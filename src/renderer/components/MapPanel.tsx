import { DomUtil } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { GeoReferencePoint } from '@shared/chart-types'
import type { MapTileProvider } from '@shared/types'
import { createAircraftLeafletIcon } from './AircraftArrow'
import { ConnectionBadge } from './ConnectionBadge'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { useMapOverlayChart } from '../hooks/useMapOverlayChart'
import { getMapTileConfig } from '../utils/mapTileProviders'

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
  activeChartId
}: {
  mountedChartIds: string[]
  activeChartId: string | null
}) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const aircraft = useAppStore((state) => state.aircraft)
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const lat = aircraft?.lat ?? 31.2304
  const lon = aircraft?.lon ?? 121.4737
  const heading = aircraft?.headingDeg ?? 0
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
          center={[lat, lon]}
          zoom={7}
          className="leaflet-map"
          zoomControl
          attributionControl
        >
          <TileLayer
            attribution={tileConfig.attribution}
            url={tileConfig.url}
            subdomains={tileConfig.subdomains}
          />
          <Marker
            position={[lat, lon]}
            icon={createAircraftLeafletIcon(heading)}
            title={t('map.aircraftMarker')}
          />
          {mountedChartIds.map((chartId, index) => (
            <MountedChartOverlay
              key={chartId}
              chartId={chartId}
              isActive={chartId === activeChartId}
              stackIndex={index}
            />
          ))}
          <FollowAircraft lat={lat} lon={lon} enabled={settings?.followAircraft ?? true} />
          <RecenterMap lat={lat} lon={lon} trigger={recenterTrigger} />
        </MapContainer>
        <div className="map-coordinates">
          <span>{`${t('map.lat')} ${formatCoord(aircraft?.lat)}`}</span>
          <span>{`${t('map.lon')} ${formatCoord(aircraft?.lon)}`}</span>
        </div>
        <button
          type="button"
          className="map-recenter-button"
          aria-label={t('map.recenter')}
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
