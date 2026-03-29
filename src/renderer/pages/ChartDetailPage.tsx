import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { ChartType, GeoReferencePoint } from '@shared/chart-types'
import { useAppStore } from '../store/useAppStore'
import { useChartDetailData } from '../hooks/useChartDetailData'
import { useChartRasterAsset } from '../hooks/useChartRasterAsset'
import { projectAircraftToChart } from '../utils/chartMath'

interface ChartDetailPageProps {
  chartId: string
  onBack: () => void
  onSaved: () => void
}

function createMapDot(label: string) {
  return divIcon({
    className: 'map-reference-icon',
    html: `<div class="map-reference-dot">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

function ClickCaptureLayer({
  onAddPoint
}: {
  onAddPoint: (point: { lat: number; lon: number }) => void
}) {
  useMapEvents({
    click(event) {
      onAddPoint({
        lat: event.latlng.lat,
        lon: event.latlng.lng
      })
    }
  })

  return null
}

export function ChartDetailPage({ chartId, onBack, onSaved }: ChartDetailPageProps) {
  const { t } = useTranslation()
  const aircraft = useAppStore((state) => state.aircraft)
  const { chart, asset, points, setChart, setPoints } = useChartDetailData(chartId)
  const [title, setTitle] = useState('')
  const [airportCode, setAirportCode] = useState('')
  const [chartType, setChartType] = useState<ChartType>('general')
  const [draftMapPoints, setDraftMapPoints] = useState<Array<{ lat: number; lon: number }>>([])
  const [draftChartPoints, setDraftChartPoints] = useState<Array<{ x: number; y: number }>>([])
  const imageRef = useRef<HTMLImageElement | null>(null)
  const { rasterUrl, width: rasterWidth, height: rasterHeight, error: rasterError } =
    useChartRasterAsset(asset)

  useEffect(() => {
    if (!chart) return
    setTitle(chart.title)
    setAirportCode(chart.airportCode ?? '')
    setChartType(chart.chartType)
  }, [chart])

  const projected = useMemo(() => projectAircraftToChart(aircraft, points), [aircraft, points])

  const saveMetadata = async () => {
    if (!chart) return
    const updated = await window.msfsApi.updateChart({
      id: chart.id,
      title,
      airportCode: airportCode || null,
      chartType
    })
    if (updated) {
      setChart(updated)
      onSaved()
    }
  }

  const saveReferencePoints = async () => {
    if (!chart || draftMapPoints.length !== 2 || draftChartPoints.length !== 2) return

    const nextPoints: GeoReferencePoint[] = [0, 1].map((index) => ({
      id: crypto.randomUUID(),
      chartId: chart.id,
      index: (index + 1) as 1 | 2,
      mapLat: draftMapPoints[index].lat,
      mapLon: draftMapPoints[index].lon,
      chartX: draftChartPoints[index].x,
      chartY: draftChartPoints[index].y
    }))

    const saved = await window.msfsApi.saveChartReferencePoints(chart.id, nextPoints)
    setPoints(saved)
    onSaved()
  }

  const onChartClick = (event: MouseEvent<HTMLElement>) => {
    const target = imageRef.current ?? event.currentTarget
    const rect = target.getBoundingClientRect()
    const baseWidth = imageRef.current?.naturalWidth ?? rasterWidth ?? (target as HTMLElement).clientWidth
    const baseHeight = imageRef.current?.naturalHeight ?? rasterHeight ?? (target as HTMLElement).clientHeight
    const x = ((event.clientX - rect.left) / rect.width) * baseWidth
    const y = ((event.clientY - rect.top) / rect.height) * baseHeight

    setDraftChartPoints((current) => [...current.slice(-1), { x, y }].slice(0, 2))
  }

  return (
    <>
      <header className="hero page-hero">
        <div>
          <p className="eyebrow">{t('nav.charts')}</p>
          <h1>{chart?.title ?? t('chartDetail.title')}</h1>
          <p className="hero-copy">{t('chartDetail.subtitle')}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onBack}>
          {t('chartDetail.back')}
        </button>
      </header>

      <section className="detail-layout">
        <section className="panel charts-panel">
          <div className="panel-header">
            <h2>{t('chartDetail.metaTitle')}</h2>
            <p>{t('chartDetail.metaSubtitle')}</p>
          </div>

          <div className="settings-field">
            <label>{t('chartDetail.fieldTitle')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="text-input" />
          </div>
          <div className="settings-field">
            <label>{t('chartDetail.fieldAirportCode')}</label>
            <input
              value={airportCode}
              onChange={(e) => setAirportCode(e.target.value)}
              className="text-input"
            />
          </div>
          <div className="settings-field">
            <label>{t('chartDetail.fieldChartType')}</label>
            <select value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)}>
              <option value="general">General</option>
              <option value="airport">Airport</option>
              <option value="sid">SID</option>
              <option value="star">STAR</option>
              <option value="approach">Approach</option>
            </select>
          </div>
          <button type="button" className="primary-button" onClick={saveMetadata}>
            {t('chartDetail.saveMeta')}
          </button>
        </section>

        <section className="panel charts-panel">
          <div className="panel-header">
            <h2>{t('chartDetail.referenceTitle')}</h2>
            <p>{t('chartDetail.referenceSubtitle')}</p>
          </div>

          <div className="reference-checklist">
            <div>{t('chartDetail.referenceMapCount', { count: draftMapPoints.length })}</div>
            <div>{t('chartDetail.referenceChartCount', { count: draftChartPoints.length })}</div>
            <div>{t('chartDetail.referenceSavedCount', { count: points.length })}</div>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={saveReferencePoints}
            disabled={draftMapPoints.length !== 2 || draftChartPoints.length !== 2}
          >
            {t('chartDetail.saveReference')}
          </button>
        </section>

        <section className="panel charts-panel">
          <div className="panel-header">
            <h2>{t('chartDetail.mapPickerTitle')}</h2>
            <p>{t('chartDetail.mapPickerSubtitle')}</p>
          </div>
          <div className="map-picker-card">
            <div className="detail-map-stage">
              <MapContainer
                center={[aircraft?.lat ?? 31.2304, aircraft?.lon ?? 121.4737]}
                zoom={10}
                className="detail-leaflet-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickCaptureLayer
                  onAddPoint={(point) => {
                    setDraftMapPoints((current) => [...current.slice(-1), point].slice(0, 2))
                  }}
                />
                {draftMapPoints.map((point, index) => (
                  <Marker
                    key={`${point.lat}-${point.lon}`}
                    position={[point.lat, point.lon]}
                    icon={createMapDot(String(index + 1))}
                  />
                ))}
                {aircraft ? (
                  <Marker
                    position={[aircraft.lat, aircraft.lon]}
                    icon={createMapDot('A')}
                  />
                ) : null}
              </MapContainer>
            </div>
            {draftMapPoints.map((point, index) => (
              <div key={`${point.lat}-${point.lon}`}>
                P{index + 1}: {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
              </div>
            ))}
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setDraftMapPoints((current) => [
                    ...current.slice(-1),
                    {
                      lat: aircraft?.lat ?? 31.2304,
                      lon: aircraft?.lon ?? 121.4737
                    }
                  ].slice(0, 2))
                }
              >
                {t('chartDetail.captureFromAircraft')}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDraftMapPoints([])}
              >
                {t('chartDetail.clearMapPoints')}
              </button>
            </div>
          </div>
        </section>

        <section className="panel charts-panel full-span">
          <div className="panel-header">
            <h2>{t('chartDetail.viewerTitle')}</h2>
            <p>{t('chartDetail.viewerSubtitle')}</p>
          </div>

          <div className="chart-viewer-shell">
            {!asset ? (
              <div className="empty-state">
                <strong>{t('chartDetail.viewerNoAssetTitle')}</strong>
                <p>{t('chartDetail.viewerNoAssetDescription')}</p>
              </div>
            ) : rasterUrl ? (
              <div className="chart-surface" onClick={onChartClick}>
                <img ref={imageRef} src={rasterUrl} alt={chart?.title ?? 'chart'} className="chart-image" />
                {projected ? (
                  <div className="chart-aircraft-dot" style={{ left: projected.x, top: projected.y }} />
                ) : null}
                {draftChartPoints.map((point, index) => (
                  <div
                    key={`${point.x}-${point.y}`}
                    className="chart-reference-dot"
                    style={{ left: point.x, top: point.y }}
                  >
                    {index + 1}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>{t('chartDetail.viewerEmpty')}</strong>
                <p>{rasterError ?? asset.mimeType}</p>
              </div>
            )}
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDraftChartPoints([])}
              >
                {t('chartDetail.clearChartPoints')}
              </button>
            </div>
          </div>
        </section>
      </section>
    </>
  )
}
