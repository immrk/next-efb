import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Plus, Route, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChartRecord } from '@shared/chart-types'
import type {
  BuildFlightPlanInput,
  FlightPlanPoint,
  FlightPlanSegment,
  FlightPlanSelection
} from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { ChartMountDrawer } from '../components/ChartMountDrawer'
import { FlightPlanDrawer } from '../components/FlightPlanDrawer'
import { MapPanel } from '../components/MapPanel'
import { SafeAreaTopInset } from '../components/SafeAreaTopInset'
import { Button } from '../components/ui/button'
import { useChartAirportLibraryData } from '../hooks/useChartAirportLibraryData'
import {
  buildManualMountCards,
  buildProcedureMountCards,
  type DockCard,
  type ProcedureMountCard
} from '../utils/chartMountCards'
import {
  persistStoredChartDockState,
  readStoredChartDockState
} from '../utils/flightPlanPersistence'
import type { NavAirportProcedures } from '@shared/flight-plan-types'

interface MapPageProps {
  onOpenChartLibrary: (chartId?: string | null) => void
  onEditChart: (chartId: string) => void
  onOpenSettings: () => void
  flightPlanDraft: BuildFlightPlanInput
  flightPlanPoints: FlightPlanPoint[]
  flightPlanSegments: FlightPlanSegment[]
  isImportingFlightPlan: boolean
  navDataReady: boolean
  onFlightPlanDraftChange: (draft: BuildFlightPlanInput) => void
  onImportFlightPlan: () => Promise<void> | void
  onClearFlightPlan: () => void
}

const EMPTY_PROCEDURES: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [],
  transitions: [],
  approaches: []
}

export function MapPage({
  onOpenChartLibrary,
  onEditChart,
  onOpenSettings,
  flightPlanDraft,
  flightPlanPoints,
  flightPlanSegments,
  isImportingFlightPlan,
  navDataReady,
  onFlightPlanDraftChange,
  onImportFlightPlan,
  onClearFlightPlan
}: MapPageProps) {
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const { t } = useTranslation()
  const chartLibrary = useChartAirportLibraryData()
  const storedDockState = readStoredChartDockState()
  const [mountedChartIds, setMountedChartIds] = useState<string[]>(storedDockState.mountedChartIds)
  const [activeChartId, setActiveChartId] = useState<string | null>(storedDockState.activeChartId)
  const [isChartDrawerOpen, setIsChartDrawerOpen] = useState(false)
  const [isFlightPlanDrawerOpen, setIsFlightPlanDrawerOpen] = useState(false)
  const [departureProcedures, setDepartureProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [destinationProcedures, setDestinationProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [pendingDisabledCard, setPendingDisabledCard] = useState<ProcedureMountCard | null>(null)
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(storedDockState.overlayDismissed)
  const [proceduresReadySelectionKey, setProceduresReadySelectionKey] = useState('')
  const [contextCharts, setContextCharts] = useState<ChartRecord[]>([])
  const [areContextChartsReady, setAreContextChartsReady] = useState(false)

  const flightPlanSelection = useMemo<FlightPlanSelection>(
    () => ({
      departureAirport: flightPlanDraft.departureAirport.trim().toUpperCase(),
      destinationAirport: flightPlanDraft.destinationAirport.trim().toUpperCase(),
      departureRunway: flightPlanDraft.departureRunway,
      departureProcedureId: flightPlanDraft.departureProcedureId,
      arrivalRunway: flightPlanDraft.arrivalRunway,
      arrivalProcedureId: flightPlanDraft.arrivalProcedureId,
      approachProcedureId: flightPlanDraft.approachProcedureId,
      arrivalTransitionId: flightPlanDraft.arrivalTransitionId
    }),
    [flightPlanDraft]
  )
  const selectionKey = useMemo(() => buildSelectionKey(flightPlanSelection), [flightPlanSelection])
  const routeAirportCodes = useMemo(
    () => Array.from(new Set([
      flightPlanSelection.departureAirport,
      flightPlanSelection.destinationAirport
    ].filter(Boolean))),
    [flightPlanSelection.departureAirport, flightPlanSelection.destinationAirport]
  )
  const routeAirportKey = routeAirportCodes.join('|')
  const mountedChartKey = mountedChartIds.join('|')
  const charts = useMemo(
    () => deduplicateCharts([...contextCharts, ...chartLibrary.charts]),
    [chartLibrary.charts, contextCharts]
  )
  const previousSelectionKeyRef = useRef(selectionKey)
  const autoCards = useMemo(
    () =>
      buildProcedureMountCards(charts, flightPlanSelection, {
        departure: departureProcedures,
        destination: destinationProcedures
      }),
    [charts, departureProcedures, destinationProcedures, flightPlanSelection]
  )

  const autoChartIds = useMemo(
    () => new Set(autoCards.flatMap((card) => (card.chartId ? [card.chartId] : []))),
    [autoCards]
  )

  const manualCharts = useMemo(
    () =>
      mountedChartIds
        .map((chartId) => charts.find((chart) => chart.id === chartId))
        .filter((chart): chart is ChartRecord => Boolean(chart && chart.isGeoreferenced && !autoChartIds.has(chart.id))),
    [autoChartIds, charts, mountedChartIds]
  )

  const manualCards = useMemo(
    () =>
      buildManualMountCards(manualCharts, autoChartIds),
    [autoChartIds, manualCharts]
  )

  const dockCards = useMemo<DockCard[]>(() => [...autoCards, ...manualCards], [autoCards, manualCards])

  useEffect(() => {
    if (previousSelectionKeyRef.current !== selectionKey) {
      setIsOverlayDismissed(false)
    }
    previousSelectionKeyRef.current = selectionKey
  }, [selectionKey])

  useEffect(() => {
    let active = true
    setAreContextChartsReady(false)
    const airportRequests = routeAirportCodes.map((airportCode) =>
      appClient.listChartsByAirport(airportCode)
    )
    const mountedRequests = mountedChartIds.map((chartId) => appClient.getChart(chartId))

    void Promise.all([
      ...airportRequests,
      ...mountedRequests
    ]).then(
      (results) => {
        if (!active) return
        const nextCharts = results.flatMap((result) =>
          Array.isArray(result) ? result : result ? [result] : []
        )
        setContextCharts(deduplicateCharts(nextCharts))
        setAreContextChartsReady(true)
      },
      () => {
        if (!active) return
        setAreContextChartsReady(false)
      }
    )

    return () => {
      active = false
    }
  }, [appClient, chartLibrary.revision, mountedChartKey, routeAirportKey])

  useEffect(() => {
    persistStoredChartDockState({
      mountedChartIds,
      activeChartId,
      overlayDismissed: isOverlayDismissed
    })
  }, [activeChartId, isOverlayDismissed, mountedChartIds])

  const activeDockChartIds = useMemo(
    () =>
      dockCards
        .map((card) => (card.kind === 'procedure' ? (card.state === 'active' ? card.chartId : null) : card.chart.id))
        .filter((chartId): chartId is string => Boolean(chartId)),
    [dockCards]
  )

  useEffect(() => {
    if (!areContextChartsReady) return
    setMountedChartIds((current) => current.filter((chartId) => charts.some((chart) => chart.id === chartId)))
    setActiveChartId((current) => (current && charts.some((chart) => chart.id === current) ? current : null))
  }, [areContextChartsReady, charts])

  useEffect(() => {
    if (isOverlayDismissed) {
      return
    }

    if (flightPlanSelection && proceduresReadySelectionKey !== selectionKey) {
      return
    }

    if (activeChartId && activeDockChartIds.includes(activeChartId)) {
      return
    }

    const activeProcedureCard = dockCards.find(
      (card): card is ProcedureMountCard =>
        card.kind === 'procedure' && card.state === 'active' && Boolean(card.chartId)
    )

    const nextActive =
      activeProcedureCard?.chartId ??
      dockCards.find((card) => card.kind === 'manual')?.chart.id ??
      null

    setActiveChartId(nextActive)
  }, [
    activeChartId,
    activeDockChartIds,
    dockCards,
    flightPlanSelection,
    isOverlayDismissed,
    proceduresReadySelectionKey,
    selectionKey
  ])

  useEffect(() => {
    const departureAirport = flightPlanSelection?.departureAirport.trim().toUpperCase()
    const destinationAirport = flightPlanSelection?.destinationAirport.trim().toUpperCase()

    if (!departureAirport && !destinationAirport) {
      setDepartureProcedures(EMPTY_PROCEDURES)
      setDestinationProcedures(EMPTY_PROCEDURES)
      setProceduresReadySelectionKey(selectionKey)
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      if (departureAirport) {
        void appClient.getNavAirportProcedures(departureAirport).then((procedures) => {
          if (active) {
            setDepartureProcedures(procedures)
          }
        })
      } else {
        setDepartureProcedures(EMPTY_PROCEDURES)
      }

      if (destinationAirport) {
        void appClient.getNavAirportProcedures(destinationAirport).then((procedures) => {
          if (active) {
            setDestinationProcedures(procedures)
          }
        })
      } else {
        setDestinationProcedures(EMPTY_PROCEDURES)
      }

      if (active) {
        setProceduresReadySelectionKey(selectionKey)
      }
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [appClient, flightPlanSelection, selectionKey])

  const mountChart = (chartId: string) => {
    const chart = charts.find((item) => item.id === chartId)
    if (!chart?.isGeoreferenced) return

    setMountedChartIds((current) => (current.includes(chartId) ? current : [...current, chartId]))
    setIsOverlayDismissed(false)
    setActiveChartId(chartId)
  }

  const unmountChart = (chartId: string) => {
    if (chartId === activeChartId) {
      setActiveChartId(null)
      setIsOverlayDismissed(true)
    }
    setMountedChartIds((current) => current.filter((id) => id !== chartId))
  }

  const handleDockCardClick = (card: DockCard) => {
    if (card.kind === 'manual') {
      if (card.chart.id === activeChartId) {
        setIsOverlayDismissed(true)
        setActiveChartId(null)
        return
      }

      setIsOverlayDismissed(false)
      setActiveChartId(card.chart.id)
      return
    }

    if (card.state === 'active' && card.chartId) {
      if (card.chartId === activeChartId) {
        setIsOverlayDismissed(true)
        setActiveChartId(null)
        return
      }

      setIsOverlayDismissed(false)
      setActiveChartId(card.chartId)
      return
    }

    setIsOverlayDismissed(false)
    setPendingDisabledCard(card)
  }

  const handleDisabledCardAction = () => {
    if (!pendingDisabledCard) return

    if (pendingDisabledCard.chartId) {
      onEditChart(pendingDisabledCard.chartId)
    } else {
      onOpenChartLibrary()
    }

    setPendingDisabledCard(null)
  }

  const openChartInLibrary = (chartId: string) => {
    onOpenChartLibrary(chartId)
  }

  return (
    <section className="map-workspace">
      <MapPanel
        activeChartId={activeChartId}
        routePoints={flightPlanPoints}
        routeSegments={flightPlanSegments}
      />

      <div className="map-workspace-overlays">
        <div className="map-route-launcher">
          <SafeAreaTopInset className="map-safe-area-top" />
          <Button
            type="button"
            variant="default"
            className="map-route-launcher-button"
            onClick={() => setIsFlightPlanDrawerOpen(true)}
            aria-label={t('flightPlan.launchEditor')}
            title={t('flightPlan.launchEditor')}
          >
            <Route className="size-4" />
            <span>{t('flightPlan.launchEditor')}</span>
          </Button>
        </div>

        <ChartMountDrawer
          mode="overlay"
          isOpen={isChartDrawerOpen}
          charts={chartLibrary.charts}
          airports={chartLibrary.airports}
          expandedAirportCode={chartLibrary.expandedAirportCode}
          isAirportLoading={chartLibrary.isLoadingCharts}
          isLoadingAirports={chartLibrary.isLoadingAirports}
          searchValue={chartLibrary.search}
          selectedChartId={activeChartId}
          mountedChartIds={mountedChartIds}
          onClose={() => setIsChartDrawerOpen(false)}
          onSelect={(chartId) => onOpenChartLibrary(chartId)}
          onEdit={runtime.canWrite ? onEditChart : undefined}
          onPin={mountChart}
          onExpandedAirportChange={chartLibrary.setExpandedAirportCode}
          onSearchValueChange={chartLibrary.setSearch}
        />

        <FlightPlanDrawer
          isOpen={isFlightPlanDrawerOpen}
          draft={flightPlanDraft}
          onClose={() => setIsFlightPlanDrawerOpen(false)}
          onOpenSettings={onOpenSettings}
          onDraftChange={onFlightPlanDraftChange}
          onImport={onImportFlightPlan}
          onClear={onClearFlightPlan}
          isImporting={isImportingFlightPlan}
          navDataReady={navDataReady}
        />

        {pendingDisabledCard ? (
          <div
            className="chart-meta-modal-backdrop"
            role="presentation"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setPendingDisabledCard(null)}
          >
            <section
              className="chart-meta-modal chart-mount-reason-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t('mapMount.reasonTitle')}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="chart-meta-modal-head">
                <h3>{t('mapMount.reasonTitle')}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setPendingDisabledCard(null)}
                  aria-label={t('common.close')}
                >
                  <X className="size-4" />
                </Button>
              </header>

              <div className="chart-meta-modal-body">
                <div className="settings-note settings-note-card">
                  <strong>
                    {pendingDisabledCard.state === 'missing-georef'
                      ? t('mapMount.noGeorefTitle')
                      : t('mapMount.noChartTitle')}
                  </strong>
                  <span>
                    {pendingDisabledCard.state === 'missing-georef'
                      ? t('mapMount.noGeorefBody', {
                          procedure: pendingDisabledCard.procedureName,
                          chart: pendingDisabledCard.chartTitle ?? ''
                        })
                      : t('mapMount.noChartBody', {
                          procedure: pendingDisabledCard.procedureName
                        })}
                  </span>
                </div>
              </div>

              <footer className="chart-meta-modal-foot">
                <Button type="button" variant="secondary" onClick={() => setPendingDisabledCard(null)}>
                  {t('common.cancel')}
                </Button>
                <Button type="button" onClick={handleDisabledCardAction}>
                  {pendingDisabledCard.chartId ? t('mapMount.goBindGeo') : t('mapMount.goChartLibrary')}
                </Button>
              </footer>
            </section>
          </div>
        ) : null}
      </div>

      <section className="chart-dock">
        <div className="chart-dock-main">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="chart-dock-add-button"
            onClick={() => setIsChartDrawerOpen(true)}
            aria-label={t('charts.add')}
          >
            <Plus className="size-4" />
          </Button>

          {dockCards.length > 0 ? (
            <div className="chart-dock-bar chart-dock-card-strip">
              {dockCards.map((card) => {
                const isActive = card.kind === 'manual' ? card.chart.id === activeChartId : card.chartId === activeChartId

                return (
                  <article
                    key={card.id}
                    className={`mounted-chart-card chart-dock-card ${isActive ? 'active' : ''} ${
                      card.kind === 'procedure' && card.state !== 'active' ? 'disabled' : ''
                    }`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className="mounted-chart-main"
                      onClick={() => handleDockCardClick(card)}
                    >
                      <div className="mounted-chart-copy">
                        <strong>
                          {card.kind === 'manual' ? card.chart.title : card.procedureName}
                        </strong>
                        <span>
                          {card.kind === 'manual'
                            ? `${card.chart.airportCode ?? 'UNSPEC'} · ${t(`chartType.${card.chart.chartType}`)}`
                            : `${card.airportCode} · ${t(`chartType.${card.chartType}`)}`}
                        </span>
                      </div>
                      {card.kind === 'procedure' && card.state !== 'active' ? (
                        <span className={`mounted-chart-pill ${card.state}`}>
                          {card.state === 'missing-georef' ? t('mapMount.noGeoref') : t('mapMount.noChart')}
                        </span>
                      ) : card.kind === 'manual' ? (
                        <span className="mounted-chart-pill manual">{t('mapMount.manual')}</span>
                      ) : null}
                    </Button>

                    {isActive && (card.kind === 'manual' ? card.chart.id : card.chartId) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mounted-chart-action"
                        onClick={() =>
                          openChartInLibrary(card.kind === 'manual' ? card.chart.id : card.chartId!)
                        }
                        aria-label={t('charts.openInLibraryAria', {
                          title: card.kind === 'manual' ? card.chart.title : card.procedureName
                        })}
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                    ) : null}

                    {card.kind === 'manual' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mounted-chart-remove"
                        onClick={() => unmountChart(card.chart.id)}
                        aria-label={t('charts.unmountAria', { title: card.chart.title })}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="chart-dock-empty-inline">{t('charts.emptyTitle')}</div>
          )}
        </div>
      </section>
    </section>
  )
}

function buildSelectionKey(selection: FlightPlanSelection | null): string {
  if (!selection) return 'none'

  return [
    selection.departureAirport,
    selection.destinationAirport,
    selection.departureRunway ?? '',
    selection.departureProcedureId ?? '',
    selection.arrivalRunway ?? '',
    selection.arrivalProcedureId ?? '',
    selection.approachProcedureId ?? '',
    selection.arrivalTransitionId ?? ''
  ].join('|')
}

function deduplicateCharts(charts: ChartRecord[]): ChartRecord[] {
  return Array.from(new Map(charts.map((chart) => [chart.id, chart])).values())
}
