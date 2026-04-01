import { useEffect, useMemo, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { ChartTitleMode, ChartType, GeoReferencePoint } from '@shared/chart-types'
import type { NavAirportProcedures, NavDataStatus } from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { ChartImagePreview } from '../components/ChartImagePreview'
import { useChartDetailData } from '../hooks/useChartDetailData'
import { getMapTileConfig } from '../utils/mapTileProviders'
import { filterProceduresByRunway } from '../utils/navProcedures'
import { notifyChartChanged } from '../utils/chartSync'
import { toast } from '../components/ui/use-toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'

interface ChartDetailPageProps {
  chartId: string
  onBack: () => void
  onSaved: () => void
  onDeleted: () => void
}

function createMapDot(label: string) {
  return divIcon({
    className: 'map-reference-icon',
    html: `<div class="map-reference-pin"><span>${label}</span></div>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38]
  })
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

function AutoFitMapPoints({
  points,
  fitKey
}: {
  points: Array<{ lat: number; lon: number }>
  fitKey: number
}) {
  const map = useMap()

  useEffect(() => {
    if (fitKey <= 0) return
    if (points.length !== 2) return
    const [a, b] = points
    const samePoint = a.lat === b.lat && a.lon === b.lon

    if (samePoint) {
      map.flyTo([a.lat, a.lon], 14, { animate: true, duration: 0.5 })
      return
    }

    map.flyToBounds(
      [
        [a.lat, a.lon],
        [b.lat, b.lon]
      ],
      {
        animate: true,
        duration: 0.55,
        padding: [52, 52],
        maxZoom: 15
      }
    )
  }, [fitKey, map, points])

  return null
}

const EMPTY_PROCEDURES: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [],
  transitions: [],
  approaches: []
}

const NONE_SELECT_VALUE = '__none__'

export function ChartDetailPage({ chartId, onBack, onSaved, onDeleted }: ChartDetailPageProps) {
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const { t } = useTranslation()
  const aircraft = useAppStore((state) => state.aircraft)
  const settings = useAppStore((state) => state.settings)
  const { chart, asset, points, setChart, setPoints } = useChartDetailData(chartId)
  const tileConfig = getMapTileConfig(settings?.mapTileProvider)
  const aircraftPositionUsable = aircraft ? isAircraftPositionUsable(aircraft) : false
  const [navStatus, setNavStatus] = useState<NavDataStatus | null>(null)
  const [titleMode, setTitleMode] = useState<ChartTitleMode>('manual')
  const [manualTitle, setManualTitle] = useState('')
  const [airportCode, setAirportCode] = useState('')
  const [chartType, setChartType] = useState<ChartType>('general')
  const [boundApproachProcedureId, setBoundApproachProcedureId] = useState('')
  const [boundApproachRunway, setBoundApproachRunway] = useState('')
  const [navProcedures, setNavProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [navProceduresLoading, setNavProceduresLoading] = useState(false)
  const [navProceduresError, setNavProceduresError] = useState('')
  const [draftMapPoints, setDraftMapPoints] = useState<Array<{ lat: number; lon: number }>>([])
  const [draftChartPoints, setDraftChartPoints] = useState<Array<{ x: number; y: number }>>([])
  const [draftInitializedForChartId, setDraftInitializedForChartId] = useState<string | null>(null)
  const [mapAutoFitKey, setMapAutoFitKey] = useState(0)
  const [chartAutoFitKey, setChartAutoFitKey] = useState(0)
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const navDataReady = Boolean(navStatus?.exists && navStatus?.activePath)
  const mapCenterLat = aircraftPositionUsable ? (aircraft?.lat ?? 31.2304) : 31.2304
  const mapCenterLon = aircraftPositionUsable ? (aircraft?.lon ?? 121.4737) : 121.4737

  const chartTypeLabel: Record<ChartType, string> = {
    general: t('chartType.general'),
    airport: t('chartType.airport'),
    sid: t('chartType.sid'),
    star: t('chartType.star'),
    approach: t('chartType.approach')
  }

  useEffect(() => {
    if (!chart) return
    setManualTitle(chart.title)
    setAirportCode(chart.airportCode ?? '')
    setChartType(chart.chartType)
    setTitleMode(chart.titleMode)
    setBoundApproachProcedureId(chart.boundApproachProcedureId ?? '')
    setBoundApproachRunway('')
  }, [chart])

  useEffect(() => {
    const refreshNavStatus = () => {
      void appClient.getNavDataStatus().then(setNavStatus)
    }

    refreshNavStatus()
    const offSettings = appClient.onSettingsChanged(() => {
      refreshNavStatus()
    })

    return () => {
      offSettings()
    }
  }, [appClient])

  useEffect(() => {
    if (!navDataReady) {
      setNavProcedures(EMPTY_PROCEDURES)
      setNavProceduresError('')
      setNavProceduresLoading(false)
      return
    }

    if (!airportCode.trim() || chartType !== 'approach') {
      setNavProcedures(EMPTY_PROCEDURES)
      setNavProceduresError('')
      setNavProceduresLoading(false)
      return
    }

    let active = true
    setNavProceduresLoading(true)
    setNavProceduresError('')

    void appClient
      .getNavAirportProcedures(airportCode.trim().toUpperCase())
      .then((procedures) => {
        if (!active) return
        setNavProcedures(procedures)
      })
      .catch((error) => {
        if (!active) return
        setNavProcedures(EMPTY_PROCEDURES)
        setNavProceduresError(error instanceof Error ? error.message : t('feedback.failed'))
      })
      .finally(() => {
        if (active) {
          setNavProceduresLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [appClient, airportCode, chartType, navDataReady, t])

  useEffect(() => {
    if (chartType !== 'approach' && titleMode !== 'manual') {
      setTitleMode('manual')
      setBoundApproachProcedureId('')
      setBoundApproachRunway('')
    }
  }, [chartType, titleMode])

  useEffect(() => {
    if (titleMode !== 'approach-procedure') {
      return
    }

    const selectedProcedure = navProcedures.approaches.find((procedure) => procedure.id === boundApproachProcedureId)
    if (!selectedProcedure) {
      if (boundApproachRunway) {
        setBoundApproachRunway('')
      }
      return
    }

    if (selectedProcedure.runwayName?.trim() && selectedProcedure.runwayName !== boundApproachRunway) {
      setBoundApproachRunway(selectedProcedure.runwayName)
    }
  }, [boundApproachProcedureId, boundApproachRunway, navProcedures.approaches, titleMode])

  const filteredApproachProcedures = useMemo(
    () => filterProceduresByRunway(navProcedures.approaches, boundApproachRunway),
    [boundApproachRunway, navProcedures.approaches]
  )

  const selectedApproachProcedure = useMemo(
    () => navProcedures.approaches.find((procedure) => procedure.id === boundApproachProcedureId) ?? null,
    [boundApproachProcedureId, navProcedures.approaches]
  )

  useEffect(() => {
    if (titleMode !== 'approach-procedure') {
      return
    }

    if (!boundApproachProcedureId) {
      return
    }

    if (!filteredApproachProcedures.some((procedure) => procedure.id === boundApproachProcedureId)) {
      setBoundApproachProcedureId('')
    }
  }, [boundApproachProcedureId, filteredApproachProcedures, titleMode])

  const canUseProcedureMode =
    chartType === 'approach' && Boolean(airportCode.trim()) && (navDataReady || Boolean(boundApproachProcedureId))
  const displayTitle = titleMode === 'approach-procedure' ? selectedApproachProcedure?.name ?? manualTitle : manualTitle

  useEffect(() => {
    setDraftMapPoints([])
    setDraftChartPoints([])
    setDraftInitializedForChartId(null)
    setMapAutoFitKey(0)
    setChartAutoFitKey(0)
  }, [chartId])

  useEffect(() => {
    if (draftInitializedForChartId === chartId) return
    if (points.length !== 2) return

    const sortedPoints = [...points].sort((a, b) => a.index - b.index)
    setDraftMapPoints(
      sortedPoints.map((point) => ({
        lat: point.mapLat,
        lon: point.mapLon
      }))
    )
    setDraftChartPoints(
      sortedPoints.map((point) => ({
        x: point.chartX,
        y: point.chartY
      }))
    )
    setDraftInitializedForChartId(chartId)
    setMapAutoFitKey((value) => value + 1)
    setChartAutoFitKey((value) => value + 1)
  }, [chartId, draftInitializedForChartId, points])

  const saveMetadata = async () => {
    if (!chart) return

    const nextManualTitle = manualTitle.trim()
    const nextTitleMode: ChartTitleMode =
      canUseProcedureMode && titleMode === 'approach-procedure' ? 'approach-procedure' : 'manual'
    const nextBoundProcedureId = nextTitleMode === 'approach-procedure' ? boundApproachProcedureId || null : null
    const selectedProcedureForSave =
      nextTitleMode === 'approach-procedure' && nextBoundProcedureId
        ? navProcedures.approaches.find((procedure) => procedure.id === nextBoundProcedureId) ??
          (chart.boundApproachProcedureId === nextBoundProcedureId
            ? { id: nextBoundProcedureId, name: chart.title }
            : null)
        : null

    if (nextTitleMode === 'manual' && !nextManualTitle) {
      toast.error(t('chartDetail.titleRequired'))
      return
    }

    if (nextTitleMode === 'approach-procedure' && (!nextBoundProcedureId || !selectedProcedureForSave)) {
      toast.error(t('chartDetail.procedureRequired'))
      return
    }

    try {
      const titleToSave = nextTitleMode === 'approach-procedure' ? selectedProcedureForSave?.name ?? chart.title : nextManualTitle

      const updated = await appClient.updateChart({
        id: chart.id,
        title: titleToSave,
        airportCode: airportCode || null,
        chartType,
        titleMode: nextTitleMode,
        boundApproachProcedureId: nextBoundProcedureId
      })
      if (updated) {
        setChart(updated)
        notifyChartChanged()
        onSaved()
        setIsMetaModalOpen(false)
        toast.success(t('feedback.saved'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('feedback.failed'))
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

    try {
      const saved = await appClient.saveChartReferencePoints(chart.id, nextPoints)
      setPoints(saved)
      notifyChartChanged()
      onSaved()
      toast.success(t('feedback.saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('feedback.failed'))
    }
  }

  const deleteChart = async () => {
    if (!chart) return
    if (deleteConfirmText.trim() !== chart.title) return

    try {
      await appClient.deleteChart(chart.id)
      notifyChartChanged()
      onDeleted()
      toast.success(t('feedback.deleted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('feedback.failed'))
    }
  }

  return (
    <section className="chart-editor-page">
      <header className="chart-editor-topbar">
        <Button type="button" variant="outline" size="icon" onClick={onBack} aria-label={t('common.back')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6L9 12L15 18" />
          </svg>
        </Button>

        <div className="chart-editor-summary">
          <strong>{chart?.title ?? t('chartDetail.title')}</strong>
          <span>{`${chart?.airportCode ?? 'UNSPEC'} · ${chartTypeLabel[chart?.chartType ?? 'general']}`}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!runtime.canWrite}
            onClick={() => setIsMetaModalOpen(true)}
            aria-label={t('chartDetail.editMeta')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 16.5V20H7.5L17.81 9.69L14.31 6.19L4 16.5Z" />
              <path d="M13.5 7L17 10.5" />
            </svg>
          </Button>
        </div>

        <div className="chart-editor-actions">
          <div className="chart-editor-counts">
            <Badge variant="outline">{t('chartDetail.countMap', { count: draftMapPoints.length })}</Badge>
            <Badge variant="outline">{t('chartDetail.countChart', { count: draftChartPoints.length })}</Badge>
            <Badge variant="outline">{t('chartDetail.countSaved', { count: points.length })}</Badge>
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={!runtime.canWrite}
            onClick={() => setIsDeleteModalOpen(true)}
          >
            {t('chartDetail.delete')}
          </Button>
          <Button
            type="button"
            onClick={saveReferencePoints}
            disabled={!runtime.canWrite || draftMapPoints.length !== 2 || draftChartPoints.length !== 2}
          >
            {t('chartDetail.saveReference')}
          </Button>
        </div>
      </header>

      <section className="chart-editor-main">
        <section className="chart-editor-pane chart-editor-map-pane">
          <div className="chart-editor-pane-head">
            <h2>{t('chartDetail.mapPickerTitle')}</h2>
            <div className="button-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setDraftMapPoints((current) =>
                    [
                      ...current.slice(-1),
                      {
                        lat: mapCenterLat,
                        lon: mapCenterLon
                      }
                    ].slice(0, 2)
                  )
                }
              >
                {t('chartDetail.captureFromAircraft')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraftMapPoints([])}
              >
                {t('chartDetail.clearMapPoints')}
              </Button>
            </div>
          </div>

          <div className="chart-editor-map-stage">
            <MapContainer
              center={[mapCenterLat, mapCenterLon]}
              zoom={10}
              className="detail-leaflet-map"
            >
              <TileLayer
                attribution={tileConfig.attribution}
                url={tileConfig.url}
                subdomains={tileConfig.subdomains}
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
                  draggable={draftMapPoints.length === 2}
                  eventHandlers={{
                    dragend: (event) => {
                      if (draftMapPoints.length !== 2) return
                      const marker = event.target as {
                        getLatLng: () => { lat: number; lng: number }
                      }
                      const latLng = marker.getLatLng()
                      setDraftMapPoints((current) =>
                        current.map((currentPoint, currentIndex) =>
                          currentIndex === index
                            ? {
                                lat: latLng.lat,
                                lon: latLng.lng
                              }
                            : currentPoint
                        )
                      )
                    }
                  }}
                />
              ))}
              {aircraftPositionUsable ? (
                <Marker
                  position={[mapCenterLat, mapCenterLon]}
                  icon={createMapDot('A')}
                  interactive={false}
                />
              ) : null}
              <AutoFitMapPoints points={draftMapPoints} fitKey={mapAutoFitKey} />
            </MapContainer>
          </div>
        </section>

        <section className="chart-editor-pane chart-editor-preview-pane">
          <div className="chart-editor-pane-head">
            <h2>{t('chartDetail.viewerTitle')}</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDraftChartPoints([])}
            >
              {t('chartDetail.clearChartPoints')}
            </Button>
          </div>
          <ChartImagePreview
            chartTitle={chart?.title ?? 'chart'}
            asset={asset}
            points={points}
            aircraft={aircraft}
            draftChartPoints={draftChartPoints}
            autoFocusKey={chartAutoFitKey}
            onChartClick={(point) =>
              setDraftChartPoints((current) => [...current.slice(-1), point].slice(0, 2))
            }
            onDraftChartPointMove={(index, point) =>
              setDraftChartPoints((current) =>
                current.map((currentPoint, currentIndex) =>
                  currentIndex === index ? point : currentPoint
                )
              )
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
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsMetaModalOpen(false)}
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </Button>
            </header>

            <div className="chart-meta-modal-body">
              <Tabs
                value={titleMode}
                onValueChange={(value) => setTitleMode(value as ChartTitleMode)}
                className="chart-meta-tabs"
              >
                <TabsList className="chart-meta-tabs-list">
                  <TabsTrigger value="manual">{t('chartDetail.modeManual')}</TabsTrigger>
                  <TabsTrigger value="approach-procedure" disabled={!canUseProcedureMode}>
                    {t('chartDetail.modeProcedure')}
                  </TabsTrigger>
                </TabsList>

                <div className="chart-meta-grid">
                  <label className="settings-field">
                    <span>{t('chartDetail.fieldAirportCode')}</span>
                    <Input
                      value={airportCode}
                      onChange={(event) => setAirportCode(event.target.value.toUpperCase())}
                      placeholder={t('chartDetail.fieldAirportCodePlaceholder')}
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('chartDetail.fieldChartType')}</span>
                    <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">{t('chartType.general')}</SelectItem>
                        <SelectItem value="airport">{t('chartType.airport')}</SelectItem>
                        <SelectItem value="sid">{t('chartType.sid')}</SelectItem>
                        <SelectItem value="star">{t('chartType.star')}</SelectItem>
                        <SelectItem value="approach">{t('chartType.approach')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <TabsContent value="manual" className="chart-meta-tab-panel">
                  <label className="settings-field">
                    <span>{t('chartDetail.fieldTitle')}</span>
                    <Input
                      value={manualTitle}
                      onChange={(event) => setManualTitle(event.target.value)}
                      placeholder={t('chartDetail.fieldTitlePlaceholder')}
                    />
                  </label>
                </TabsContent>

                <TabsContent value="approach-procedure" className="chart-meta-tab-panel">
                  <div className="settings-note settings-note-card">
                    <strong>{t('chartDetail.procedureModeTitle')}</strong>
                    <span>{canUseProcedureMode ? t('chartDetail.procedureModeHint') : t('chartDetail.procedureModeBlocked')}</span>
                  </div>

                  <label className="settings-field">
                    <span>{t('chartDetail.procedureRunway')}</span>
                    <Select
                      value={boundApproachRunway || NONE_SELECT_VALUE}
                      onValueChange={(value) =>
                        setBoundApproachRunway(value === NONE_SELECT_VALUE ? '' : value)
                      }
                      disabled={!canUseProcedureMode || navProceduresLoading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SELECT_VALUE}>{t('chartDetail.procedureAnyRunway')}</SelectItem>
                        {navProcedures.runways.map((runway) => (
                          <SelectItem key={runway.name} value={runway.name}>
                            {runway.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="settings-field">
                    <span>{t('chartDetail.procedureSelect')}</span>
                    <Select
                      value={boundApproachProcedureId || NONE_SELECT_VALUE}
                      onValueChange={(value) =>
                        setBoundApproachProcedureId(value === NONE_SELECT_VALUE ? '' : value)
                      }
                      disabled={!canUseProcedureMode || navProceduresLoading || filteredApproachProcedures.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('chartDetail.procedureSelectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SELECT_VALUE}>{t('chartDetail.procedureNone')}</SelectItem>
                        {filteredApproachProcedures.map((procedure) => (
                          <SelectItem key={procedure.id} value={procedure.id}>
                            {procedure.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <div className="chart-meta-derived-title">
                    <span>{t('chartDetail.procedureDerivedTitle')}</span>
                    <strong>{displayTitle || t('chartDetail.procedureDerivedEmpty')}</strong>
                  </div>

                  {navProceduresLoading ? (
                    <div className="chart-meta-hint">{t('chartDetail.procedureLoading')}</div>
                  ) : null}

                  {navProceduresError ? <div className="chart-meta-hint danger-copy">{navProceduresError}</div> : null}
                </TabsContent>
              </Tabs>
            </div>

            <footer className="chart-meta-modal-foot">
              <Button type="button" variant="secondary" onClick={() => setIsMetaModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={saveMetadata}>
                {t('chartDetail.saveMeta')}
              </Button>
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
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsDeleteModalOpen(false)}
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </Button>
            </header>

            <div className="chart-meta-modal-body">
              <p className="danger-copy">
                {t('chartDetail.deletePromptPrefix')} <strong>{chart?.title ?? ''}</strong>{' '}
                {t('chartDetail.deletePromptSuffix')}
              </p>
              <div className="settings-field">
                <Input value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} />
              </div>
            </div>

            <footer className="chart-meta-modal-foot">
              <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void deleteChart()}
                disabled={deleteConfirmText.trim() !== (chart?.title ?? '')}
              >
                {t('chartDetail.confirmDelete')}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}
