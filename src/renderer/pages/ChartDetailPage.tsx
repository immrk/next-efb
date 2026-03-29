import { useEffect, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { ChartType, GeoReferencePoint } from '@shared/chart-types'
import { useAppStore } from '../store/useAppStore'
import { ChartImagePreview } from '../components/ChartImagePreview'
import { useChartDetailData } from '../hooks/useChartDetailData'
import { notifyChartChanged } from '../utils/chartSync'

interface ChartDetailPageProps {
  chartId: string
  onBack: () => void
  onSaved: () => void
  onDeleted: () => void
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

export function ChartDetailPage({ chartId, onBack, onSaved, onDeleted }: ChartDetailPageProps) {
  const { t } = useTranslation()
  const aircraft = useAppStore((state) => state.aircraft)
  const { chart, asset, points, setChart, setPoints } = useChartDetailData(chartId)

  const [title, setTitle] = useState('')
  const [airportCode, setAirportCode] = useState('')
  const [chartType, setChartType] = useState<ChartType>('general')
  const [draftMapPoints, setDraftMapPoints] = useState<Array<{ lat: number; lon: number }>>([])
  const [draftChartPoints, setDraftChartPoints] = useState<Array<{ x: number; y: number }>>([])
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const chartTypeLabel: Record<ChartType, string> = {
    general: t('chartType.general'),
    airport: t('chartType.airport'),
    sid: t('chartType.sid'),
    star: t('chartType.star'),
    approach: t('chartType.approach')
  }

  useEffect(() => {
    if (!chart) return
    setTitle(chart.title)
    setAirportCode(chart.airportCode ?? '')
    setChartType(chart.chartType)
  }, [chart])

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
      notifyChartChanged()
      onSaved()
      setIsMetaModalOpen(false)
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
    notifyChartChanged()
    onSaved()
  }

  const deleteChart = async () => {
    if (!chart) return
    if (deleteConfirmText.trim() !== chart.title) return

    await window.msfsApi.deleteChart(chart.id)
    notifyChartChanged()
    onDeleted()
  }

  return (
    <section className="chart-editor-page">
      <header className="chart-editor-topbar">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t('common.back')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6L9 12L15 18" />
          </svg>
        </button>

        <div className="chart-editor-summary">
          <strong>{chart?.title ?? t('chartDetail.title')}</strong>
          <span>{`${chart?.airportCode ?? 'UNSPEC'} · ${chartTypeLabel[chart?.chartType ?? 'general']}`}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setIsMetaModalOpen(true)}
            aria-label={t('chartDetail.editMeta')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 16.5V20H7.5L17.81 9.69L14.31 6.19L4 16.5Z" />
              <path d="M13.5 7L17 10.5" />
            </svg>
          </button>
        </div>

        <div className="chart-editor-actions">
          <div className="chart-editor-counts">
            <span>{t('chartDetail.countMap', { count: draftMapPoints.length })}</span>
            <span>{t('chartDetail.countChart', { count: draftChartPoints.length })}</span>
            <span>{t('chartDetail.countSaved', { count: points.length })}</span>
          </div>
          <button
            type="button"
            className="secondary-button danger-button"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            {t('chartDetail.delete')}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={saveReferencePoints}
            disabled={draftMapPoints.length !== 2 || draftChartPoints.length !== 2}
          >
            {t('chartDetail.saveReference')}
          </button>
        </div>
      </header>

      <section className="chart-editor-main">
        <section className="chart-editor-pane chart-editor-map-pane">
          <div className="chart-editor-pane-head">
            <h2>{t('chartDetail.mapPickerTitle')}</h2>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setDraftMapPoints((current) =>
                    [
                      ...current.slice(-1),
                      {
                        lat: aircraft?.lat ?? 31.2304,
                        lon: aircraft?.lon ?? 121.4737
                      }
                    ].slice(0, 2)
                  )
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

          <div className="chart-editor-map-stage">
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
        </section>

        <section className="chart-editor-pane chart-editor-preview-pane">
          <div className="chart-editor-pane-head">
            <h2>{t('chartDetail.viewerTitle')}</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDraftChartPoints([])}
            >
              {t('chartDetail.clearChartPoints')}
            </button>
          </div>
          <ChartImagePreview
            chartTitle={chart?.title ?? 'chart'}
            asset={asset}
            points={points}
            aircraft={aircraft}
            draftChartPoints={draftChartPoints}
            onChartClick={(point) =>
              setDraftChartPoints((current) => [...current.slice(-1), point].slice(0, 2))
            }
          />
        </section>
      </section>

      {isMetaModalOpen ? (
        <div
          className="chart-meta-modal-backdrop"
          role="presentation"
          onClick={() => setIsMetaModalOpen(false)}
        >
          <section
            className="chart-meta-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('chartDetail.editMeta')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="chart-meta-modal-head">
              <h3>{t('chartDetail.metaTitle')}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsMetaModalOpen(false)}
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="chart-meta-modal-body">
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
                  <option value="general">{t('chartType.general')}</option>
                  <option value="airport">{t('chartType.airport')}</option>
                  <option value="sid">{t('chartType.sid')}</option>
                  <option value="star">{t('chartType.star')}</option>
                  <option value="approach">{t('chartType.approach')}</option>
                </select>
              </div>
            </div>

            <footer className="chart-meta-modal-foot">
              <button type="button" className="secondary-button" onClick={() => setIsMetaModalOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="primary-button" onClick={saveMetadata}>
                {t('chartDetail.saveMeta')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {isDeleteModalOpen ? (
        <div
          className="chart-meta-modal-backdrop"
          role="presentation"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <section
            className="chart-meta-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('chartDetail.deleteDialogTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="chart-meta-modal-head">
              <h3>{t('chartDetail.deleteDialogTitle')}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsDeleteModalOpen(false)}
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="chart-meta-modal-body">
              <p className="danger-copy">
                {t('chartDetail.deletePromptPrefix')} <strong>{chart?.title ?? ''}</strong>{' '}
                {t('chartDetail.deletePromptSuffix')}
              </p>
              <div className="settings-field">
                <input
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  className="text-input"
                />
              </div>
            </div>

            <footer className="chart-meta-modal-foot">
              <button type="button" className="secondary-button" onClick={() => setIsDeleteModalOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="secondary-button danger-button"
                onClick={() => void deleteChart()}
                disabled={deleteConfirmText.trim() !== (chart?.title ?? '')}
              >
                {t('chartDetail.confirmDelete')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}
