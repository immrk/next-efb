import { DomUtil, divIcon } from 'leaflet'
import { useEffect, useRef } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { GeoReferencePoint } from '@shared/chart-types'
import { useAppStore } from '../store/useAppStore'
import { useMapOverlayChart } from '../hooks/useMapOverlayChart'

function formatCoord(value: number | undefined): string {
  if (typeof value !== 'number') return '--'
  return value.toFixed(4)
}

function createAircraftIcon(headingDeg: number) {
  return divIcon({
    className: 'aircraft-div-icon',
    html: `<div class="aircraft-map-marker" style="transform: rotate(${headingDeg}deg)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
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

function ChartOverlay({
  rasterUrl,
  width,
  height,
  points
}: {
  rasterUrl: string | null
  width: number | null
  height: number | null
  points: GeoReferencePoint[]
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
  }, [height, map, points, rasterUrl, width])

  return null
}

export function MapPanel({ selectedChartId }: { selectedChartId: string | null }) {
  const { t } = useTranslation()
  const aircraft = useAppStore((state) => state.aircraft)
  const settings = useAppStore((state) => state.settings)
  const lat = aircraft?.lat ?? 31.2304
  const lon = aircraft?.lon ?? 121.4737
  const heading = aircraft?.headingDeg ?? 0
  const overlay = useMapOverlayChart(selectedChartId)

  return (
    <section className="panel map-panel">
      <div className="panel-header">
        <h2>{t('map.title')}</h2>
        <p>{t('map.subtitle')}</p>
      </div>

      <div className="map-stage">
        <MapContainer
          center={[lat, lon]}
          zoom={7}
          className="leaflet-map"
          zoomControl
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[lat, lon]}
            icon={createAircraftIcon(heading)}
            title={t('map.aircraftMarker')}
          />
          <ChartOverlay
            rasterUrl={overlay.rasterUrl}
            width={overlay.width}
            height={overlay.height}
            points={overlay.points}
          />
          <FollowAircraft
            lat={lat}
            lon={lon}
            enabled={settings?.followAircraft ?? true}
          />
        </MapContainer>
        <div className="map-coordinates">
          <span>LAT {formatCoord(aircraft?.lat)}</span>
          <span>LON {formatCoord(aircraft?.lon)}</span>
        </div>
      </div>
    </section>
  )
}
