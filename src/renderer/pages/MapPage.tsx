import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChartRecord } from '@shared/chart-types'
import type { BuildFlightPlanResult, FlightPlanPoint, FlightPlanSegment, FlightPlanSelection } from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { ChartMountDrawer } from '../components/ChartMountDrawer'
import { FlightPlanDrawer } from '../components/FlightPlanDrawer'
import { MapPanel } from '../components/MapPanel'
import { Button } from '../components/ui/button'
import { useChartLibraryData } from '../hooks/useChartLibraryData'
import {
  buildManualMountCards,
  buildProcedureMountCards,
  type DockCard,
  type ProcedureMountCard
} from '../utils/chartMountCards'
import type { NavAirportProcedures } from '@shared/flight-plan-types'

interface MapPageProps {
  onOpenChartLibrary: (chartId?: string | null) => void
  onEditChart: (chartId: string) => void
  onOpenSettings: () => void
  flightPlanSelection: FlightPlanSelection | null
  onFlightPlanSelectionChange: (selection: FlightPlanSelection | null) => void
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
  flightPlanSelection,
  onFlightPlanSelectionChange
}: MapPageProps) {
  const appClient = getAppClient()
  const runtime = appClient.getRuntime()
  const { t } = useTranslation()
  const { charts } = useChartLibraryData()
  const [mountedChartIds, setMountedChartIds] = useState<string[]>([])
  const [activeChartId, setActiveChartId] = useState<string | null>(null)
  const [isChartDrawerOpen, setIsChartDrawerOpen] = useState(false)
  const [isFlightPlanDrawerOpen, setIsFlightPlanDrawerOpen] = useState(false)
  const [flightPlanPoints, setFlightPlanPoints] = useState<FlightPlanPoint[]>([])
  const [flightPlanSegments, setFlightPlanSegments] = useState<FlightPlanSegment[]>([])
  const [departureProcedures, setDepartureProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [destinationProcedures, setDestinationProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [pendingDisabledCard, setPendingDisabledCard] = useState<ProcedureMountCard | null>(null)
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false)

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
    setIsOverlayDismissed(false)
  }, [flightPlanSelection, charts])

  const activeDockChartIds = useMemo(
    () =>
      dockCards
        .map((card) => (card.kind === 'procedure' ? (card.state === 'active' ? card.chartId : null) : card.chart.id))
        .filter((chartId): chartId is string => Boolean(chartId)),
    [dockCards]
  )

  useEffect(() => {
    setMountedChartIds((current) => current.filter((chartId) => charts.some((chart) => chart.id === chartId)))
  }, [charts])

  useEffect(() => {
    if (isOverlayDismissed) {
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
  }, [activeChartId, activeDockChartIds, dockCards, isOverlayDismissed])

  useEffect(() => {
    const departureAirport = flightPlanSelection?.departureAirport.trim().toUpperCase()
    const destinationAirport = flightPlanSelection?.destinationAirport.trim().toUpperCase()

    if (!departureAirport && !destinationAirport) {
      setDepartureProcedures(EMPTY_PROCEDURES)
      setDestinationProcedures(EMPTY_PROCEDURES)
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
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [flightPlanSelection])

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

  const handlePlanBuilt = (result: BuildFlightPlanResult) => {
    setFlightPlanPoints(result.points)
    setFlightPlanSegments(result.segments)
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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5V19M5 12H19" />
            </svg>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="chart-dock-add-button"
            onClick={() => setIsFlightPlanDrawerOpen(true)}
            aria-label={t('flightPlan.openDrawer')}
            title={t('flightPlan.openDrawer')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7H7L10 13L14 9L17 13H21" />
              <path d="M7 7L9 5M17 13L19 11" />
            </svg>
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
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12h10M11 7l5 5-5 5" />
                          <path d="M14 5h5v5" />
                        </svg>
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
                        x
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

      <ChartMountDrawer
        mode="overlay"
        isOpen={isChartDrawerOpen}
        charts={charts}
        selectedChartId={activeChartId}
        mountedChartIds={mountedChartIds}
        onClose={() => setIsChartDrawerOpen(false)}
        onSelect={(chartId) => onOpenChartLibrary(chartId)}
        onEdit={runtime.canWrite ? onEditChart : undefined}
        onPin={mountChart}
      />

      <FlightPlanDrawer
        isOpen={isFlightPlanDrawerOpen}
        onClose={() => setIsFlightPlanDrawerOpen(false)}
        onOpenSettings={onOpenSettings}
        onPlanBuilt={handlePlanBuilt}
        onClearPlan={() => {
          setFlightPlanPoints([])
          setFlightPlanSegments([])
        }}
        onSelectionChange={onFlightPlanSelectionChange}
      />

      {pendingDisabledCard ? (
        <div className="chart-meta-modal-backdrop" role="presentation" onClick={() => setPendingDisabledCard(null)}>
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
                variant="outline"
                size="icon"
                onClick={() => setPendingDisabledCard(null)}
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
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
    </section>
  )
}
