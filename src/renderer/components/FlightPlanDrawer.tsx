import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BuildFlightPlanResult,
  FlightPlanSelection,
  NavAirportProcedures,
  NavDataStatus
} from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { filterProceduresByRunway, parseApproachProcedureId, runwayMatches } from '../utils/navProcedures'
import { toast } from './ui/use-toast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { Textarea } from './ui/textarea'

interface StoredFlightPlanDraft {
  departureAirport: string
  destinationAirport: string
  enrouteText: string
  departureRunway: string
  departureProcedureId: string
  arrivalRunway: string
  arrivalProcedureId: string
  approachProcedureId: string
  arrivalTransitionId: string
}

interface FlightPlanDrawerProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
  onPlanBuilt: (result: BuildFlightPlanResult) => void
  onClearPlan: () => void
  onSelectionChange: (selection: FlightPlanSelection | null) => void
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
const FLIGHT_PLAN_DRAFT_STORAGE_KEY = 'nextefb.flight-plan-draft.v1'

export function FlightPlanDrawer({
  isOpen,
  onClose,
  onOpenSettings,
  onPlanBuilt,
  onClearPlan,
  onSelectionChange
}: FlightPlanDrawerProps) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const settings = useAppStore((state) => state.settings)
  const storedDraftRef = useRef<StoredFlightPlanDraft | null>(null)
  if (storedDraftRef.current === null) {
    storedDraftRef.current = readStoredFlightPlanDraft()
  }

  const [departureAirport, setDepartureAirport] = useState(storedDraftRef.current.departureAirport)
  const [destinationAirport, setDestinationAirport] = useState(storedDraftRef.current.destinationAirport)
  const [enrouteText, setEnrouteText] = useState(storedDraftRef.current.enrouteText)
  const [departureRunway, setDepartureRunway] = useState(storedDraftRef.current.departureRunway)
  const [departureProcedureId, setDepartureProcedureId] = useState(storedDraftRef.current.departureProcedureId)
  const [arrivalRunway, setArrivalRunway] = useState(storedDraftRef.current.arrivalRunway)
  const [arrivalProcedureId, setArrivalProcedureId] = useState(storedDraftRef.current.arrivalProcedureId)
  const [approachProcedureId, setApproachProcedureId] = useState(storedDraftRef.current.approachProcedureId)
  const [arrivalTransitionId, setArrivalTransitionId] = useState(storedDraftRef.current.arrivalTransitionId)
  const [depCandidates, setDepCandidates] = useState<string[]>([])
  const [destCandidates, setDestCandidates] = useState<string[]>([])
  const [depProcedures, setDepProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [destProcedures, setDestProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [isLoading, setIsLoading] = useState(false)
  const [navStatus, setNavStatus] = useState<NavDataStatus | null>(null)
  const buildRequestIdRef = useRef(0)
  const lastClearedSignatureRef = useRef('')
  const prevNavDataReadyRef = useRef(false)
  const onPlanBuiltRef = useRef(onPlanBuilt)
  const onClearPlanRef = useRef(onClearPlan)
  const onSelectionChangeRef = useRef(onSelectionChange)

  onPlanBuiltRef.current = onPlanBuilt
  onClearPlanRef.current = onClearPlan
  onSelectionChangeRef.current = onSelectionChange

  const navDataReady = Boolean(navStatus?.exists && navStatus?.activePath)

  useEffect(() => {
    if (navDataReady && !prevNavDataReadyRef.current) {
      lastClearedSignatureRef.current = ''
    }
    prevNavDataReadyRef.current = navDataReady
  }, [navDataReady])

  useEffect(() => {
    onSelectionChangeRef.current({
      departureAirport: departureAirport.trim().toUpperCase(),
      destinationAirport: destinationAirport.trim().toUpperCase(),
      departureRunway: departureRunway || null,
      departureProcedureId: departureProcedureId || null,
      arrivalRunway: arrivalRunway || null,
      arrivalProcedureId: arrivalProcedureId || null,
      approachProcedureId: approachProcedureId || null,
      arrivalTransitionId: arrivalTransitionId || null
    })
  }, [
    arrivalProcedureId,
    arrivalRunway,
    arrivalTransitionId,
    departureAirport,
    departureProcedureId,
    departureRunway,
    destinationAirport,
    approachProcedureId
  ])

  useEffect(() => {
    persistStoredFlightPlanDraft({
      departureAirport,
      destinationAirport,
      enrouteText,
      departureRunway,
      departureProcedureId,
      arrivalRunway,
      arrivalProcedureId,
      approachProcedureId,
      arrivalTransitionId
    })
  }, [
    arrivalProcedureId,
    arrivalRunway,
    arrivalTransitionId,
    departureAirport,
    departureProcedureId,
    departureRunway,
    destinationAirport,
    enrouteText,
    approachProcedureId
  ])

  useEffect(() => {
    if (!isOpen) return

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
  }, [appClient, isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!navDataReady) {
      setDepCandidates([])
      return
    }

    const token = departureAirport.trim().toUpperCase()
    if (token.length < 2) {
      setDepCandidates([])
      return
    }

    const timer = window.setTimeout(() => {
      void appClient.searchNavAirports(token).then((airports) => {
        setDepCandidates(airports.map((airport) => airport.ident))
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [appClient, departureAirport, isOpen, navDataReady])

  useEffect(() => {
    if (!isOpen) return
    if (!navDataReady) {
      setDestCandidates([])
      return
    }

    const token = destinationAirport.trim().toUpperCase()
    if (token.length < 2) {
      setDestCandidates([])
      return
    }

    const timer = window.setTimeout(() => {
      void appClient.searchNavAirports(token).then((airports) => {
        setDestCandidates(airports.map((airport) => airport.ident))
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [appClient, destinationAirport, isOpen, navDataReady])

  useEffect(() => {
    const ident = departureAirport.trim().toUpperCase()
    if (!ident || !navDataReady) {
      setDepProcedures(EMPTY_PROCEDURES)
      return
    }

    let active = true
    void appClient.getNavAirportProcedures(ident).then((procedures) => {
      if (!active) return
      setDepProcedures(procedures)
    })

    return () => {
      active = false
    }
  }, [appClient, departureAirport, isOpen, navDataReady])

  useEffect(() => {
    const ident = destinationAirport.trim().toUpperCase()
    if (!ident || !navDataReady) {
      setDestProcedures(EMPTY_PROCEDURES)
      return
    }

    let active = true
    void appClient.getNavAirportProcedures(ident).then((procedures) => {
      if (!active) return
      setDestProcedures(procedures)
    })

    return () => {
      active = false
    }
  }, [appClient, destinationAirport, isOpen, navDataReady])

  const departureProcedureOptions = useMemo(
    () => filterProceduresByRunway(depProcedures.departures, departureRunway),
    [depProcedures.departures, departureRunway]
  )

  const arrivalProcedureOptions = useMemo(
    () => filterProceduresByRunway(destProcedures.arrivals, arrivalRunway),
    [arrivalRunway, destProcedures.arrivals]
  )

  const approachProcedureOptions = useMemo(
    () => filterProceduresByRunway(destProcedures.approaches, arrivalRunway),
    [arrivalRunway, destProcedures.approaches]
  )

  const selectedApproachProcedureId = useMemo(
    () => parseApproachProcedureId(approachProcedureId),
    [approachProcedureId]
  )

  const transitionOptions = useMemo(() => {
    if (!selectedApproachProcedureId) {
      return []
    }

    return destProcedures.transitions.filter(
      (transition) =>
        transition.approachId === selectedApproachProcedureId && runwayMatches(transition.runwayName, arrivalRunway)
    )
  }, [arrivalRunway, destProcedures.transitions, selectedApproachProcedureId])

  useEffect(() => {
    if (!departureProcedureOptions.length) {
      setDepartureProcedureId('')
      return
    }

    if (!departureProcedureOptions.some((procedure) => procedure.id === departureProcedureId)) {
      setDepartureProcedureId('')
    }
  }, [departureProcedureId, departureProcedureOptions])

  useEffect(() => {
    if (!depProcedures.runways.length) {
      setDepartureRunway('')
      return
    }

    if (!depProcedures.runways.some((runway) => runway.name === departureRunway)) {
      setDepartureRunway('')
    }
  }, [departureRunway, depProcedures.runways])

  useEffect(() => {
    if (!arrivalProcedureOptions.length) {
      setArrivalProcedureId('')
      return
    }

    if (!arrivalProcedureOptions.some((procedure) => procedure.id === arrivalProcedureId)) {
      setArrivalProcedureId('')
    }
  }, [arrivalProcedureId, arrivalProcedureOptions])

  useEffect(() => {
    if (!destProcedures.runways.length) {
      setArrivalRunway('')
      return
    }

    if (!destProcedures.runways.some((runway) => runway.name === arrivalRunway)) {
      setArrivalRunway('')
    }
  }, [arrivalRunway, destProcedures.runways])

  useEffect(() => {
    if (!approachProcedureOptions.length) {
      setApproachProcedureId('')
      setArrivalTransitionId('')
      return
    }

    if (!approachProcedureOptions.some((procedure) => procedure.id === approachProcedureId)) {
      setApproachProcedureId('')
      setArrivalTransitionId('')
    }
  }, [approachProcedureId, approachProcedureOptions])

  useEffect(() => {
    if (!transitionOptions.length) {
      setArrivalTransitionId('')
      return
    }

    if (!transitionOptions.some((transition) => transition.id === arrivalTransitionId)) {
      setArrivalTransitionId('')
    }
  }, [arrivalTransitionId, transitionOptions])

  const handleImportSimBrief = async () => {
    setIsLoading(true)
    try {
      const result = await appClient.importSimBrief({
        username: settings?.simbrief.username,
        userId: settings?.simbrief.userId
      })
      setDepartureAirport(result.departureAirport)
      setDestinationAirport(result.destinationAirport)
      setEnrouteText(result.routeText)
      toast.success(t('feedback.imported'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SIMBRIEF_IMPORT_FAILED'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    const departureIdent = departureAirport.trim().toUpperCase()
    const destinationIdent = destinationAirport.trim().toUpperCase()
    const currentSignature = buildRouteSignature({
      departureAirport: departureIdent,
      destinationAirport: destinationIdent,
      enrouteText,
      departureRunway,
      departureProcedureId,
      arrivalRunway,
      arrivalProcedureId,
      approachProcedureId,
      arrivalTransitionId
    })

    if (!navDataReady) {
      if (currentSignature !== lastClearedSignatureRef.current) {
        lastClearedSignatureRef.current = currentSignature
        buildRequestIdRef.current += 1
        onClearPlanRef.current()
      }
      setIsLoading(false)
      return
    }

    if (currentSignature === lastClearedSignatureRef.current) {
      return
    }

    if (!departureIdent || !destinationIdent) {
      lastClearedSignatureRef.current = currentSignature
      buildRequestIdRef.current += 1
      onClearPlanRef.current()
      setIsLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      const requestId = ++buildRequestIdRef.current
      setIsLoading(true)

      void appClient
        .buildFlightPlan({
          departureAirport: departureIdent,
          destinationAirport: destinationIdent,
          enrouteText,
          departureRunway: departureRunway || null,
          departureProcedureId: departureProcedureId || null,
          arrivalRunway: arrivalRunway || null,
          arrivalProcedureId: arrivalProcedureId || null,
          approachProcedureId: approachProcedureId || null,
          arrivalTransitionId: arrivalTransitionId || null
        })
        .then((result) => {
          if (requestId !== buildRequestIdRef.current) {
            return
          }
          lastClearedSignatureRef.current = ''
          onPlanBuiltRef.current(result)
        })
        .catch((error) => {
          if (requestId !== buildRequestIdRef.current) {
            return
          }
          const message = error instanceof Error ? error.message : 'ROUTE_BUILD_FAILED'
          toast.error(message)
        })
        .finally(() => {
          if (requestId === buildRequestIdRef.current) {
            setIsLoading(false)
          }
        })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [
    appClient,
    arrivalProcedureId,
    arrivalRunway,
    arrivalTransitionId,
    departureAirport,
    departureProcedureId,
    departureRunway,
    destinationAirport,
    enrouteText,
    isOpen,
    navDataReady
  ])

  if (!isOpen) {
    return null
  }

  return (
    <section className="flight-plan-drawer-layer">
      <aside className="flight-plan-drawer">
        <header className="flight-plan-head">
          <strong>{t('flightPlan.title')}</strong>
          <div className="settings-inline-row">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onOpenSettings}
              aria-label={t('flightPlan.openSettings')}
              title={t('flightPlan.openSettings')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19 12a7 7 0 0 0-.05-.82l2.02-1.57-1.99-3.45-2.42.82a7 7 0 0 0-1.42-.82L14.7 4h-3.4l-.44 2.16a7 7 0 0 0-1.42.82l-2.42-.82-1.99 3.45 2.02 1.57A7 7 0 0 0 7 12a7 7 0 0 0 .05.82l-2.02 1.57 1.99 3.45 2.42-.82a7 7 0 0 0 1.42.82L11.3 20h3.4l.44-2.16a7 7 0 0 0 1.42-.82l2.42.82 1.99-3.45-2.02-1.57c.03-.27.05-.54.05-.82Z" />
              </svg>
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label={t('flightPlan.close')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6L18 18M18 6L6 18" />
              </svg>
            </Button>
          </div>
        </header>

        <div className="flight-plan-body">
          {!navDataReady ? (
            <div className="settings-note settings-note-card flight-plan-alert">
              <strong>{t('flightPlan.navDataRequired')}</strong>
              <span>{t('flightPlan.navDataRequiredHint')}</span>
              <div className="settings-inline-row">
                <Button type="button" variant="secondary" onClick={onOpenSettings}>
                  {t('flightPlan.navDataOpenSettings')}
                </Button>
              </div>
            </div>
          ) : null}

          <section className="flight-plan-section">
            <div className="flight-plan-section-head">
              <strong>{t('flightPlan.departureSection')}</strong>
              <span>{t('flightPlan.departureSectionHint')}</span>
            </div>

            <label className="settings-field">
              <span>{t('flightPlan.departureAirport')}</span>
              <Input
                value={departureAirport}
                onChange={(event) => setDepartureAirport(event.target.value.toUpperCase())}
                list="departure-airports"
                placeholder={t('flightPlan.airportPlaceholder')}
                disabled={!navDataReady}
              />
              <datalist id="departure-airports">
                {depCandidates.map((ident) => (
                  <option key={ident} value={ident} />
                ))}
              </datalist>
            </label>

            <label className="settings-field">
              <span>{t('flightPlan.departureRunway')}</span>
              <Select
                value={departureRunway || NONE_SELECT_VALUE}
                onValueChange={(value) => setDepartureRunway(value === NONE_SELECT_VALUE ? '' : value)}
                disabled={!navDataReady}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>{t('flightPlan.notSpecified')}</SelectItem>
                  {depProcedures.runways.map((runway) => (
                    <SelectItem key={runway.name} value={runway.name}>
                      {runway.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="settings-field">
              <span>{t('flightPlan.departureProcedure')}</span>
              <Select
                value={departureProcedureId || NONE_SELECT_VALUE}
                onValueChange={(value) => setDepartureProcedureId(value === NONE_SELECT_VALUE ? '' : value)}
                disabled={!navDataReady}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>{t('flightPlan.notSpecified')}</SelectItem>
                  {departureProcedureOptions.map((procedure) => (
                    <SelectItem key={procedure.id} value={procedure.id}>
                      {procedure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </section>

          <section className="flight-plan-section">
            <div className="flight-plan-section-head">
              <strong>{t('flightPlan.routeSection')}</strong>
              <span>{t('flightPlan.routeSectionHint')}</span>
            </div>

            <label className="settings-field">
              <span>{t('flightPlan.enroute')}</span>
              <Textarea
                className="flight-plan-textarea"
                value={enrouteText}
                onChange={(event) => setEnrouteText(event.target.value.toUpperCase())}
                placeholder={t('flightPlan.enroutePlaceholder')}
                disabled={!navDataReady}
              />
            </label>
          </section>

          <section className="flight-plan-section">
            <div className="flight-plan-section-head">
              <strong>{t('flightPlan.arrivalSection')}</strong>
              <span>{t('flightPlan.arrivalSectionHint')}</span>
            </div>

            <label className="settings-field">
              <span>{t('flightPlan.destinationAirport')}</span>
              <Input
                value={destinationAirport}
                onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())}
                list="destination-airports"
                placeholder={t('flightPlan.airportPlaceholder')}
                disabled={!navDataReady}
              />
              <datalist id="destination-airports">
                {destCandidates.map((ident) => (
                  <option key={ident} value={ident} />
                ))}
              </datalist>
            </label>

            <label className="settings-field">
              <span>{t('flightPlan.arrivalRunway')}</span>
              <Select
                value={arrivalRunway || NONE_SELECT_VALUE}
                onValueChange={(value) => setArrivalRunway(value === NONE_SELECT_VALUE ? '' : value)}
                disabled={!navDataReady}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>{t('flightPlan.notSpecified')}</SelectItem>
                  {destProcedures.runways.map((runway) => (
                    <SelectItem key={runway.name} value={runway.name}>
                      {runway.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="settings-field">
              <span>{t('flightPlan.arrivalProcedure')}</span>
              <Select
                value={arrivalProcedureId || NONE_SELECT_VALUE}
                onValueChange={(value) => setArrivalProcedureId(value === NONE_SELECT_VALUE ? '' : value)}
                disabled={!navDataReady}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>{t('flightPlan.notSpecified')}</SelectItem>
                  {arrivalProcedureOptions.map((procedure) => (
                    <SelectItem key={procedure.id} value={procedure.id}>
                      {procedure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="settings-field">
              <span>{t('flightPlan.approachProcedure')}</span>
              <Select
                value={approachProcedureId || NONE_SELECT_VALUE}
                onValueChange={(value) => setApproachProcedureId(value === NONE_SELECT_VALUE ? '' : value)}
                disabled={!navDataReady}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>{t('flightPlan.notSpecified')}</SelectItem>
                  {approachProcedureOptions.map((procedure) => (
                    <SelectItem key={procedure.id} value={procedure.id}>
                      {procedure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="settings-field">
              <span>{t('flightPlan.arrivalTransition')}</span>
              <Select
                value={arrivalTransitionId || NONE_SELECT_VALUE}
                onValueChange={(value) => setArrivalTransitionId(value === NONE_SELECT_VALUE ? '' : value)}
                disabled={!navDataReady}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>{t('flightPlan.notSpecified')}</SelectItem>
                  {transitionOptions.map((transition) => (
                    <SelectItem key={transition.id} value={transition.id}>
                      {transition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </section>

          <div className="button-row">
            <Button type="button" variant="secondary" disabled={isLoading || !navDataReady} onClick={handleImportSimBrief}>
              {t('flightPlan.importSimbrief')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => {
                lastClearedSignatureRef.current = buildRouteSignature({
                  departureAirport: departureAirport.trim().toUpperCase(),
                  destinationAirport: destinationAirport.trim().toUpperCase(),
                  enrouteText,
                  departureRunway,
                  departureProcedureId,
                  arrivalRunway,
                  arrivalProcedureId,
                  approachProcedureId,
                  arrivalTransitionId
                })
                buildRequestIdRef.current += 1
                onClearPlanRef.current()
              }}
            >
              {t('flightPlan.clear')}
            </Button>
          </div>
        </div>
      </aside>
    </section>
  )
}

function buildRouteSignature(input: {
  departureAirport: string
  destinationAirport: string
  enrouteText: string
  departureRunway: string
  departureProcedureId: string
  arrivalRunway: string
  arrivalProcedureId: string
  approachProcedureId: string
  arrivalTransitionId: string
}): string {
  return [
    input.departureAirport,
    input.destinationAirport,
    input.enrouteText,
    input.departureRunway,
    input.departureProcedureId,
    input.arrivalRunway,
    input.arrivalProcedureId,
    input.approachProcedureId,
    input.arrivalTransitionId
  ].join('|')
}

function readStoredFlightPlanDraft(): StoredFlightPlanDraft {
  const fallback: StoredFlightPlanDraft = {
    departureAirport: '',
    destinationAirport: '',
    enrouteText: '',
    departureRunway: '',
    departureProcedureId: '',
    arrivalRunway: '',
    arrivalProcedureId: '',
    approachProcedureId: '',
    arrivalTransitionId: ''
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(FLIGHT_PLAN_DRAFT_STORAGE_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<StoredFlightPlanDraft>
    return {
      departureAirport: typeof parsed.departureAirport === 'string' ? parsed.departureAirport : '',
      destinationAirport: typeof parsed.destinationAirport === 'string' ? parsed.destinationAirport : '',
      enrouteText: typeof parsed.enrouteText === 'string' ? parsed.enrouteText : '',
      departureRunway: typeof parsed.departureRunway === 'string' ? parsed.departureRunway : '',
      departureProcedureId: typeof parsed.departureProcedureId === 'string' ? parsed.departureProcedureId : '',
      arrivalRunway: typeof parsed.arrivalRunway === 'string' ? parsed.arrivalRunway : '',
      arrivalProcedureId: typeof parsed.arrivalProcedureId === 'string' ? parsed.arrivalProcedureId : '',
      approachProcedureId: typeof parsed.approachProcedureId === 'string' ? parsed.approachProcedureId : '',
      arrivalTransitionId: typeof parsed.arrivalTransitionId === 'string' ? parsed.arrivalTransitionId : ''
    }
  } catch {
    return fallback
  }
}

function persistStoredFlightPlanDraft(input: StoredFlightPlanDraft): void {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(FLIGHT_PLAN_DRAFT_STORAGE_KEY, JSON.stringify(input))
}
