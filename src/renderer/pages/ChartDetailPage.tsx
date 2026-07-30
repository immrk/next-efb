import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Pencil, X } from 'lucide-react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import type { ChartTitleMode, ChartType, GeoReferencePoint } from '@shared/chart-types'
import type {
  NavAirportProcedures,
  NavDataStatus,
  NavProcedureOption
} from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { MapDisplayToolbar } from '../components/MapDisplayToolbar'
import { MapReferenceMarker } from '../components/MapReferenceMarker'
import { NavDataOverlay } from '../components/NavDataOverlay'
import { useAppStore } from '../store/useAppStore'
import { usePersistentMapDisplaySettings } from '../hooks/usePersistentMapDisplaySettings'
import { ChartImagePreview } from '../components/ChartImagePreview'
import { useChartDetailData } from '../hooks/useChartDetailData'
import { getMapTileConfig } from '../utils/mapTileProviders'
import { runwayMatches } from '../utils/navProcedures'
import { notifyChartChanged } from '../utils/chartSync'
import { toast } from '../components/ui/use-toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { MultiSelect, type MultiSelectOption } from '../components/ui/multi-select'
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

const NONE_SELECT_VALUE = '__none__'
const BINDABLE_CHART_TYPES: ChartType[] = ['sid', 'star', 'approach']

function isBindableChartType(value: ChartType): boolean {
  return BINDABLE_CHART_TYPES.includes(value)
}

function createReferencePointId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-')
}

function getProcedureOptionsByChartType(
  procedures: NavAirportProcedures,
  chartType: ChartType
): NavProcedureOption[] {
  const sortByName = (items: NavProcedureOption[]) =>
    [...items].sort((left, right) => left.name.localeCompare(right.name))

  switch (chartType) {
    case 'sid':
      return sortByName(procedures.departures)
    case 'star':
      return sortByName(procedures.arrivals)
    case 'approach':
      return sortByName(procedures.approaches)
    default:
      return []
  }
}

function getProcedureLabelKeyByChartType(chartType: ChartType): string {
  switch (chartType) {
    case 'sid':
      return 'flightPlan.departureProcedure'
    case 'star':
      return 'flightPlan.arrivalProcedure'
    case 'approach':
    default:
      return 'flightPlan.approachProcedure'
  }
}

function buildProcedureDerivedTitle(
  runways: Array<{ displayName: string }>,
  procedures: Array<{ name: string }>
): string {
  if (procedures.length === 0) {
    return ''
  }

  const runwayPrefix =
    runways.length > 0 ? `${runways.map((runway) => runway.displayName).join(', ')} ` : ''
  const firstProcedureName = procedures[0]?.name ?? ''

  if (procedures.length === 1) {
    return `${runwayPrefix}${firstProcedureName}`.trim()
  }

  return `${runwayPrefix}${firstProcedureName}...(${procedures.length})`.trim()
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

const EMPTY_PROCEDURES: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [],
  transitions: [],
  approaches: []
}

export function ChartDetailPage({ chartId, onBack, onSaved, onDeleted }: ChartDetailPageProps) {
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const { t } = useTranslation()
  const settings = useAppStore((state) => state.settings)
  const { chart, asset, points, setChart, setPoints } = useChartDetailData(chartId)
  const { navLayerVisibility, toggleNavLayer } = usePersistentMapDisplaySettings()
  const tileConfig = getMapTileConfig(settings?.mapTileProvider)
  const [navStatus, setNavStatus] = useState<NavDataStatus | null>(null)
  const [titleMode, setTitleMode] = useState<ChartTitleMode>('manual')
  const [manualTitle, setManualTitle] = useState('')
  const [airportCode, setAirportCode] = useState('')
  const [chartType, setChartType] = useState<ChartType>('general')
  const [selectedRunwayNames, setSelectedRunwayNames] = useState<string[]>([])
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([])
  const [openProcedurePicker, setOpenProcedurePicker] = useState<
    'runway' | 'procedure' | null
  >(null)
  const [navProcedures, setNavProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [navProceduresLoading, setNavProceduresLoading] = useState(false)
  const [navProceduresError, setNavProceduresError] = useState('')
  const [draftMapPoints, setDraftMapPoints] = useState<Array<{ lat: number; lon: number }>>([])
  const [draftChartPoints, setDraftChartPoints] = useState<Array<{ x: number; y: number }>>([])
  const [mapSearchTarget, setMapSearchTarget] = useState<{ lat: number; lon: number; key: number } | null>(null)
  const [draftInitializedForChartId, setDraftInitializedForChartId] = useState<string | null>(null)
  const [mapAutoFitKey, setMapAutoFitKey] = useState(0)
  const [chartAutoFitKey, setChartAutoFitKey] = useState(0)
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const navDataReady = Boolean(navStatus?.activePath)
  const mapCenterLat = 31.2304
  const mapCenterLon = 121.4737

  const addDraftMapPoint = (point: { lat: number; lon: number }) => {
    setDraftMapPoints((current) => [...current.slice(-1), point].slice(0, 2))
  }

  const chartTypeLabel: Record<ChartType, string> = {
    general: t('chartType.general'),
    airport: t('chartType.airport'),
    sid: t('chartType.sid'),
    star: t('chartType.star'),
    approach: t('chartType.approach')
  }

  const resetMetadataDraft = (sourceChart: typeof chart | null) => {
    if (!sourceChart) return
    setManualTitle(sourceChart.title)
    setAirportCode(sourceChart.airportCode ?? '')
    setChartType(sourceChart.chartType)
    setTitleMode(sourceChart.titleMode)
    setSelectedRunwayNames(sourceChart.boundRunwayNames)
    setSelectedProcedureIds(sourceChart.boundApproachProcedureIds)
    setOpenProcedurePicker(null)
    setNavProceduresError('')
  }

  const closeMetaModal = () => {
    resetMetadataDraft(chart)
    setIsMetaModalOpen(false)
  }

  useEffect(() => {
    resetMetadataDraft(chart)
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

  const normalizedAirportCode = airportCode.trim().toUpperCase()
  const isProcedureModeActive = titleMode === 'approach-procedure'
  const effectiveProcedureChartType = isProcedureModeActive
    ? isBindableChartType(chartType)
      ? chartType
      : 'approach'
    : chartType
  const hasProcedureLookupContext = Boolean(normalizedAirportCode) && isProcedureModeActive

  useEffect(() => {
    if (!hasProcedureLookupContext) {
      setNavProcedures(EMPTY_PROCEDURES)
      setNavProceduresError('')
      setNavProceduresLoading(false)
      return
    }

    let active = true
    setNavProceduresLoading(true)
    setNavProceduresError('')

    void appClient
      .getNavAirportProcedures(normalizedAirportCode)
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
  }, [appClient, hasProcedureLookupContext, normalizedAirportCode, t])

  useEffect(() => {
    if (titleMode !== 'approach-procedure') {
      return
    }

    if (navProceduresLoading) {
      return
    }

    if (normalizedAirportCode && navProcedures.airport?.ident !== normalizedAirportCode) {
      return
    }

    const validProcedureIds = new Set(
      getProcedureOptionsByChartType(navProcedures, effectiveProcedureChartType)
        .filter((procedure) =>
          selectedRunwayNames.length === 0
            ? true
            : selectedRunwayNames.some((runwayName) => runwayMatches(procedure.runwayName, runwayName))
        )
        .map((procedure) => procedure.id)
    )
    setSelectedProcedureIds((current) => current.filter((procedureId) => validProcedureIds.has(procedureId)))
  }, [
    navProcedures.airport?.ident,
    navProceduresLoading,
    normalizedAirportCode,
    titleMode,
    navProcedures.departures,
    navProcedures.arrivals,
    navProcedures.approaches,
    effectiveProcedureChartType,
    selectedRunwayNames
  ])

  const canOpenProcedureModeTab = navDataReady
  const canUseProcedureMode = Boolean(normalizedAirportCode) && navDataReady
  const availableRunwayOptions = useMemo(
    () => [...navProcedures.runways].sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [navProcedures.runways]
  )
  const availableProcedureOptions = useMemo(
    () =>
      getProcedureOptionsByChartType(navProcedures, effectiveProcedureChartType).filter((procedure) =>
        selectedRunwayNames.length === 0
          ? true
          : selectedRunwayNames.some((runwayName) => runwayMatches(procedure.runwayName, runwayName))
      ),
    [navProcedures, effectiveProcedureChartType, selectedRunwayNames]
  )
  const runwayMultiSelectOptions = useMemo<MultiSelectOption[]>(
    () =>
      availableRunwayOptions.map((runway) => ({
        value: runway.name,
        label: runway.displayName,
        description: [
          runway.lengthM ? `${Math.round(runway.lengthM)} m` : null,
          runway.surface
        ]
          .filter(Boolean)
          .join(' · '),
        searchText: runway.name
      })),
    [availableRunwayOptions]
  )
  const procedureMultiSelectOptions = useMemo<MultiSelectOption[]>(
    () =>
      availableProcedureOptions.map((procedure) => ({
        value: procedure.id,
        label: procedure.name,
        description: procedure.runwayName
          ? `RWY ${procedure.runwayName}`
          : t('chartDetail.procedureAnyRunway'),
        searchText: procedure.runwayName ?? ''
      })),
    [availableProcedureOptions, t]
  )
  const selectedRunwayOptions = useMemo(
    () => availableRunwayOptions.filter((runway) => selectedRunwayNames.includes(runway.name)),
    [availableRunwayOptions, selectedRunwayNames]
  )
  const selectedProcedureOptions = useMemo(
    () => availableProcedureOptions.filter((procedure) => selectedProcedureIds.includes(procedure.id)),
    [availableProcedureOptions, selectedProcedureIds]
  )
  const derivedProcedureTitle = useMemo(
    () => buildProcedureDerivedTitle(selectedRunwayOptions, selectedProcedureOptions),
    [selectedRunwayOptions, selectedProcedureOptions]
  )

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
    const nextBoundProcedureIds =
      nextTitleMode === 'approach-procedure'
        ? Array.from(new Set(selectedProcedureIds.filter((procedureId): procedureId is string => Boolean(procedureId))))
        : []
    const nextChartType: ChartType =
      nextTitleMode === 'approach-procedure'
        ? isBindableChartType(chartType)
          ? chartType
          : 'approach'
        : chartType
    const nextProcedureOptions = getProcedureOptionsByChartType(navProcedures, nextChartType)
    const selectedProceduresForSave =
      nextTitleMode === 'approach-procedure'
        ? nextBoundProcedureIds
            .map(
              (procedureId) =>
                nextProcedureOptions.find((procedure) => procedure.id === procedureId) ??
                (chart.boundApproachProcedureIds.includes(procedureId)
                  ? {
                      id: procedureId,
                      name: chart.title,
                      procedureType:
                        nextChartType === 'sid'
                          ? 'departure'
                          : nextChartType === 'star'
                            ? 'arrival'
                            : 'approach',
                      runwayName: null
                    }
                  : null)
            )
            .filter((procedure): procedure is NonNullable<typeof procedure> => Boolean(procedure))
        : []

    if (nextTitleMode === 'manual' && !nextManualTitle) {
      toast.error(t('chartDetail.titleRequired'))
      return
    }

    if (nextTitleMode === 'approach-procedure' && selectedProceduresForSave.length === 0) {
      toast.error(t('chartDetail.procedureRequired'))
      return
    }

    try {
        const titleToSave =
          nextTitleMode === 'approach-procedure'
            ? buildProcedureDerivedTitle(selectedRunwayOptions, selectedProceduresForSave)
            : nextManualTitle

        const updated = await appClient.updateChart({
          id: chart.id,
          title: titleToSave,
          airportCode: airportCode || null,
          chartType: nextChartType,
          titleMode: nextTitleMode,
          boundRunwayNames: nextTitleMode === 'approach-procedure' ? selectedRunwayNames : [],
          boundApproachProcedureIds: nextBoundProcedureIds
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

    try {
      const nextPoints: GeoReferencePoint[] = [0, 1].map((index) => ({
        id: createReferencePointId(),
        chartId: chart.id,
        index: (index + 1) as 1 | 2,
        mapLat: draftMapPoints[index].lat,
        mapLon: draftMapPoints[index].lon,
        chartX: draftChartPoints[index].x,
        chartY: draftChartPoints[index].y
      }))

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
          <ArrowLeft className="size-4" />
        </Button>

        <div className="chart-editor-summary">
          <strong>{chart?.title ?? t('chartDetail.title')}</strong>
          <span>{`${chart?.airportCode ?? 'UNSPEC'} · ${chartTypeLabel[chart?.chartType ?? 'general']}`}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!runtime.canWrite}
            onClick={() => {
              resetMetadataDraft(chart)
              setIsMetaModalOpen(true)
            }}
            aria-label={t('chartDetail.editMeta')}
          >
            <Pencil className="size-4" />
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
                onClick={() => setDraftMapPoints([])}
              >
                {t('chartDetail.clearMapPoints')}
              </Button>
            </div>
          </div>

          <div className="chart-editor-map-stage">
            <div className="chart-editor-map-toolbar">
              <MapDisplayToolbar
                className="chart-editor-map-toolbar-inner"
                navLayerVisibility={navLayerVisibility}
                onToggleLayer={toggleNavLayer}
                onSearchSelect={(result) =>
                  setMapSearchTarget({
                    lat: result.lat,
                    lon: result.lon,
                    key: Date.now()
                  })
                }
              />
            </div>
            <MapContainer
              center={[mapCenterLat, mapCenterLon]}
              zoom={10}
              className="detail-leaflet-map"
            >
              <TileLayer
                attribution={tileConfig.attribution}
                url={tileConfig.url}
                referrerPolicy="strict-origin-when-cross-origin"
                {...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})}
              />
              <NavDataOverlay
                layerVisibility={navLayerVisibility}
                onPickPoint={addDraftMapPoint}
              />
              <ClickCaptureLayer onAddPoint={addDraftMapPoint} />
              {draftMapPoints.map((point, index) => (
                <MapReferenceMarker
                  key={`${index}:${point.lat}:${point.lon}`}
                  point={point}
                  index={index}
                  pointCount={draftMapPoints.length}
                  removeLabel={t('chartDetail.removeMapPoint', { index: index + 1 })}
                  onDelete={(deleteIndex) =>
                    setDraftMapPoints((current) =>
                      current.filter((_, currentIndex) => currentIndex !== deleteIndex)
                    )
                  }
                  onMove={(moveIndex, nextPoint) =>
                    setDraftMapPoints((current) =>
                      current.map((currentPoint, currentIndex) =>
                        currentIndex === moveIndex ? nextPoint : currentPoint
                      )
                    )
                  }
                />
              ))}
              <AutoFitMapPoints points={draftMapPoints} fitKey={mapAutoFitKey} />
              <FlyToSearchTarget target={mapSearchTarget} />
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
              aircraft={null}
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
          onClick={closeMetaModal}
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
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={closeMetaModal}
                  aria-label={t('common.close')}
                >
                <X className="size-4" />
              </Button>
            </header>

            <div className="chart-meta-modal-body">
              <Tabs
                value={titleMode}
                onValueChange={(value) => {
                  const nextMode = value as ChartTitleMode
                  setTitleMode(nextMode)
                  setOpenProcedurePicker(null)
                  if (nextMode === 'approach-procedure' && !isBindableChartType(chartType)) {
                    setChartType('approach')
                  }
                }}
                className="chart-meta-tabs"
              >
                <TabsList className="chart-meta-tabs-list">
                  <TabsTrigger value="manual">{t('chartDetail.modeManual')}</TabsTrigger>
                  <TabsTrigger value="approach-procedure" disabled={!canOpenProcedureModeTab}>
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
                    <Select
                      value={chartType}
                      onValueChange={(value) => {
                        setChartType(value as ChartType)
                        setOpenProcedurePicker(null)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {titleMode === 'approach-procedure' ? (
                          <>
                            <SelectItem value="sid">{t('chartType.sid')}</SelectItem>
                            <SelectItem value="star">{t('chartType.star')}</SelectItem>
                            <SelectItem value="approach">{t('chartType.approach')}</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="general">{t('chartType.general')}</SelectItem>
                            <SelectItem value="airport">{t('chartType.airport')}</SelectItem>
                            <SelectItem value="sid">{t('chartType.sid')}</SelectItem>
                            <SelectItem value="star">{t('chartType.star')}</SelectItem>
                            <SelectItem value="approach">{t('chartType.approach')}</SelectItem>
                          </>
                        )}
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
                  <div className="chart-procedure-selectors">
                    <MultiSelect
                      label={t('chartDetail.procedureRunway')}
                      options={runwayMultiSelectOptions}
                      value={selectedRunwayNames}
                      open={openProcedurePicker === 'runway'}
                      onOpenChange={(open) =>
                        setOpenProcedurePicker(open ? 'runway' : null)
                      }
                      onValueChange={setSelectedRunwayNames}
                      placeholder={t('chartDetail.runwayMultiSelectPlaceholder')}
                      searchPlaceholder={t('chartDetail.multiSelectSearchPlaceholder')}
                      selectAllLabel={t('chartDetail.multiSelectSelectVisible')}
                      clearVisibleLabel={t('chartDetail.multiSelectClearVisible')}
                      selectionSummary={t('chartDetail.multiSelectSelectionSummary', {
                        selected: selectedRunwayNames.length,
                        total: runwayMultiSelectOptions.length
                      })}
                      emptyMessage={t('chartDetail.runwayEmpty')}
                      noResultsMessage={t('chartDetail.multiSelectNoSearchResult')}
                      disabled={!canUseProcedureMode || navProceduresLoading}
                    />

                    <MultiSelect
                      label={t(getProcedureLabelKeyByChartType(effectiveProcedureChartType))}
                      options={procedureMultiSelectOptions}
                      value={selectedProcedureIds}
                      open={openProcedurePicker === 'procedure'}
                      onOpenChange={(open) =>
                        setOpenProcedurePicker(open ? 'procedure' : null)
                      }
                      onValueChange={setSelectedProcedureIds}
                      placeholder={t('chartDetail.procedureMultiSelectPlaceholder')}
                      searchPlaceholder={t('chartDetail.multiSelectSearchPlaceholder')}
                      selectAllLabel={t('chartDetail.multiSelectSelectVisible')}
                      clearVisibleLabel={t('chartDetail.multiSelectClearVisible')}
                      selectionSummary={t('chartDetail.multiSelectSelectionSummary', {
                        selected: selectedProcedureIds.length,
                        total: procedureMultiSelectOptions.length
                      })}
                      emptyMessage={t('chartDetail.procedureEmpty')}
                      noResultsMessage={t('chartDetail.multiSelectNoSearchResult')}
                      disabled={!canUseProcedureMode || navProceduresLoading}
                    />
                  </div>

                  <div className="chart-meta-derived-title">
                    <span>{t('chartDetail.procedureDerivedTitle')}</span>
                    <strong>
                      {derivedProcedureTitle || t('chartDetail.procedureDerivedEmpty')}
                    </strong>
                  </div>

                  {navProceduresLoading ? (
                    <div className="chart-meta-hint">{t('chartDetail.procedureLoading')}</div>
                  ) : null}

                  {navProceduresError ? <div className="chart-meta-hint danger-copy">{navProceduresError}</div> : null}
                </TabsContent>
              </Tabs>
            </div>

            <footer className="chart-meta-modal-foot">
              <Button type="button" variant="secondary" onClick={closeMetaModal}>
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
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsDeleteModalOpen(false)}
                aria-label={t('common.close')}
              >
                <X className="size-4" />
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
