import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { Download, MapPin, Settings, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  BuildFlightPlanInput,
  NavAirportProcedures,
  NavDataStatus,
  NavProcedureOption,
  NavRunwayOption,
  NavTransitionOption
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

interface FlightPlanDrawerProps {
  isOpen: boolean
  draft: BuildFlightPlanInput
  onClose: () => void
  onOpenSettings: () => void
  onDraftChange: (draft: BuildFlightPlanInput) => void
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

function AirportCombobox({
  id,
  value,
  candidates,
  placeholder,
  disabled,
  onValueChange
}: {
  id: string
  value: string
  candidates: string[]
  placeholder: string
  disabled: boolean
  onValueChange: (value: string) => void
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    setActiveIndex((current) => {
      if (candidates.length === 0) return -1
      if (current < 0) return 0
      return Math.min(current, candidates.length - 1)
    })
  }, [candidates])

  const selectCandidate = (candidate: string) => {
    onValueChange(candidate)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (candidates.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => (current + 1) % candidates.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => (current <= 0 ? candidates.length - 1 : current - 1))
      return
    }

    if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      selectCandidate(candidates[activeIndex])
    }
  }

  return (
    <div className="flight-plan-airport-combobox" ref={rootRef}>
      <MapPin className="flight-plan-airport-icon" aria-hidden="true" />
      <Input
        id={id}
        className="flight-plan-airport-input"
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value.toUpperCase())
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(candidates.length > 0)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen && candidates.length > 0}
        aria-controls={listId}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
      />
      {isOpen && candidates.length > 0 ? (
        <div id={listId} className="flight-plan-airport-options" role="listbox">
          {candidates.map((candidate, index) => (
            <Button
              key={candidate}
              id={`${listId}-option-${index}`}
              type="button"
              variant="ghost"
              className={`flight-plan-airport-option ${index === activeIndex ? 'is-active' : ''}`}
              role="option"
              aria-selected={index === activeIndex}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => selectCandidate(candidate)}
            >
              <MapPin aria-hidden="true" />
              <span>{candidate}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function FlightPlanDrawer({
  isOpen,
  draft,
  onClose,
  onOpenSettings,
  onDraftChange
}: FlightPlanDrawerProps) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const settings = useAppStore((state) => state.settings)
  const [depCandidates, setDepCandidates] = useState<string[]>([])
  const [destCandidates, setDestCandidates] = useState<string[]>([])
  const [depProcedures, setDepProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [destProcedures, setDestProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [isLoading, setIsLoading] = useState(false)
  const [navStatus, setNavStatus] = useState<NavDataStatus | null>(null)
  const prevNavDataReadyRef = useRef(false)

  const navDataReady = Boolean(navStatus?.exists && navStatus?.activePath)
  const departureAirport = draft.departureAirport
  const destinationAirport = draft.destinationAirport
  const enrouteText = draft.enrouteText
  const departureRunway = draft.departureRunway ?? ''
  const departureProcedureId = draft.departureProcedureId ?? ''
  const arrivalRunway = draft.arrivalRunway ?? ''
  const arrivalProcedureId = draft.arrivalProcedureId ?? ''
  const approachProcedureId = draft.approachProcedureId ?? ''
  const arrivalTransitionId = draft.arrivalTransitionId ?? ''

  useEffect(() => {
    prevNavDataReadyRef.current = navDataReady
  }, [navDataReady])

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

  const updateDraft = (partial: Partial<BuildFlightPlanInput>) => {
    onDraftChange({
      ...draft,
      ...partial
    })
  }

  useEffect(() => {
    if (!navDataReady) return
    if (departureAirport.trim() && depProcedures.airport?.ident !== departureAirport.trim().toUpperCase()) return

    if (!departureProcedureOptions.length) {
      if (departureProcedureId) {
        updateDraft({ departureProcedureId: null })
      }
      return
    }

    if (!departureProcedureOptions.some((procedure) => procedure.id === departureProcedureId)) {
      updateDraft({ departureProcedureId: null })
    }
  }, [depProcedures.airport?.ident, departureAirport, departureProcedureId, departureProcedureOptions, navDataReady])

  useEffect(() => {
    if (!navDataReady) return
    if (departureAirport.trim() && depProcedures.airport?.ident !== departureAirport.trim().toUpperCase()) return

    if (!depProcedures.runways.length) {
      if (departureRunway) {
        updateDraft({ departureRunway: null, departureProcedureId: null })
      }
      return
    }

    if (!depProcedures.runways.some((runway) => runway.name === departureRunway)) {
      updateDraft({ departureRunway: null, departureProcedureId: null })
    }
  }, [depProcedures.airport?.ident, depProcedures.runways, departureAirport, departureRunway, navDataReady])

  useEffect(() => {
    if (!navDataReady) return
    if (destinationAirport.trim() && destProcedures.airport?.ident !== destinationAirport.trim().toUpperCase()) return

    if (!arrivalProcedureOptions.length) {
      if (arrivalProcedureId) {
        updateDraft({ arrivalProcedureId: null })
      }
      return
    }

    if (!arrivalProcedureOptions.some((procedure) => procedure.id === arrivalProcedureId)) {
      updateDraft({ arrivalProcedureId: null })
    }
  }, [arrivalProcedureId, arrivalProcedureOptions, destProcedures.airport?.ident, destinationAirport, navDataReady])

  useEffect(() => {
    if (!navDataReady) return
    if (destinationAirport.trim() && destProcedures.airport?.ident !== destinationAirport.trim().toUpperCase()) return

    if (!destProcedures.runways.length) {
      if (arrivalRunway || arrivalProcedureId || approachProcedureId || arrivalTransitionId) {
        updateDraft({
          arrivalRunway: null,
          arrivalProcedureId: null,
          approachProcedureId: null,
          arrivalTransitionId: null
        })
      }
      return
    }

    if (!destProcedures.runways.some((runway) => runway.name === arrivalRunway)) {
      updateDraft({
        arrivalRunway: null,
        arrivalProcedureId: null,
        approachProcedureId: null,
        arrivalTransitionId: null
      })
    }
  }, [
    approachProcedureId,
    arrivalProcedureId,
    arrivalRunway,
    arrivalTransitionId,
    destinationAirport,
    destProcedures.airport?.ident,
    destProcedures.runways,
    navDataReady
  ])

  useEffect(() => {
    if (!navDataReady) return
    if (destinationAirport.trim() && destProcedures.airport?.ident !== destinationAirport.trim().toUpperCase()) return

    if (!approachProcedureOptions.length) {
      if (approachProcedureId || arrivalTransitionId) {
        updateDraft({
          approachProcedureId: null,
          arrivalTransitionId: null
        })
      }
      return
    }

    if (!approachProcedureOptions.some((procedure) => procedure.id === approachProcedureId)) {
      updateDraft({
        approachProcedureId: null,
        arrivalTransitionId: null
      })
    }
  }, [
    approachProcedureId,
    approachProcedureOptions,
    arrivalTransitionId,
    destProcedures.airport?.ident,
    destinationAirport,
    navDataReady
  ])

  useEffect(() => {
    if (!navDataReady) return
    if (destinationAirport.trim() && destProcedures.airport?.ident !== destinationAirport.trim().toUpperCase()) return

    if (!transitionOptions.length) {
      if (arrivalTransitionId) {
        updateDraft({ arrivalTransitionId: null })
      }
      return
    }

    if (!transitionOptions.some((transition) => transition.id === arrivalTransitionId)) {
      updateDraft({ arrivalTransitionId: null })
    }
  }, [arrivalTransitionId, destinationAirport, destProcedures.airport?.ident, navDataReady, transitionOptions])

  const handleImportSimBrief = async () => {
    setIsLoading(true)
    try {
      const result = await appClient.importSimBrief({
        username: settings?.simbrief.username
      })
      const [importedDepProcedures, importedDestProcedures] = await Promise.all([
        result.departureAirport ? appClient.getNavAirportProcedures(result.departureAirport) : Promise.resolve(EMPTY_PROCEDURES),
        result.destinationAirport ? appClient.getNavAirportProcedures(result.destinationAirport) : Promise.resolve(EMPTY_PROCEDURES)
      ])
      const matchedDepartureRunway =
        matchRunwayOption(importedDepProcedures.runways, result.departureRunway)?.name ?? null
      const matchedArrivalRunway = matchRunwayOption(importedDestProcedures.runways, result.arrivalRunway)?.name ?? null
      const matchedDepartureProcedureId =
        matchProcedureOption(
          filterProceduresByRunway(importedDepProcedures.departures, matchedDepartureRunway ?? ''),
          result.departureProcedureName,
          getRouteProcedureFallback(result.routeText, 'departure')
        ) ?? null
      const matchedArrivalProcedureId =
        matchProcedureOption(
          filterProceduresByRunway(importedDestProcedures.arrivals, matchedArrivalRunway ?? ''),
          result.arrivalProcedureName,
          getRouteProcedureFallback(result.routeText, 'arrival')
        ) ?? null
      const matchedApproachProcedureId =
        matchProcedureOption(
          filterProceduresByRunway(importedDestProcedures.approaches, matchedArrivalRunway ?? ''),
          result.approachProcedureName
        )?.id ?? null
      const matchedTransitionId =
        matchTransitionOption(
          importedDestProcedures.transitions,
          result.arrivalTransitionName,
          matchedApproachProcedureId,
          matchedArrivalRunway
        )?.id ?? null
      const cleanedEnrouteText = stripMatchedProceduresFromRouteText(
        result.routeText,
        matchedDepartureProcedureId,
        matchedArrivalProcedureId
      )

      setDepProcedures(importedDepProcedures)
      setDestProcedures(importedDestProcedures)
      onDraftChange({
        departureAirport: result.departureAirport,
        destinationAirport: result.destinationAirport,
        enrouteText: cleanedEnrouteText,
        departureRunway: matchedDepartureRunway,
        departureProcedureId: matchedDepartureProcedureId?.id ?? null,
        arrivalRunway: matchedArrivalRunway,
        arrivalProcedureId: matchedArrivalProcedureId?.id ?? null,
        approachProcedureId: matchedApproachProcedureId,
        arrivalTransitionId: matchedTransitionId
      })
      toast.success(t('feedback.imported'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SIMBRIEF_IMPORT_FAILED'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const clearDraft = () => {
    onDraftChange({
      departureAirport: '',
      destinationAirport: '',
      enrouteText: '',
      departureRunway: null,
      departureProcedureId: null,
      arrivalRunway: null,
      arrivalProcedureId: null,
      approachProcedureId: null,
      arrivalTransitionId: null
    })
  }

  if (!isOpen) {
    return null
  }

  return (
    <section className="flight-plan-drawer-layer">
      <aside className="flight-plan-drawer">
        <header className="flight-plan-head">
          <strong>{t('flightPlan.title')}</strong>
          <div className="flight-plan-head-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flight-plan-head-command"
              disabled={isLoading || !navDataReady}
              onClick={handleImportSimBrief}
            >
              <Download className="size-4" />
              <span>{t('flightPlan.importSimbrief')}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flight-plan-head-command"
              disabled={isLoading}
              onClick={clearDraft}
            >
              <Trash2 className="size-4" />
              <span>{t('flightPlan.clear')}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={onOpenSettings}
              aria-label={t('flightPlan.openSettings')}
              title={t('flightPlan.openSettings')}
            >
              <Settings className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label={t('flightPlan.close')}
            >
              <X className="size-4" />
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

            <div className="settings-field">
              <label htmlFor="flight-plan-departure-airport">
                {t('flightPlan.departureAirport')}
              </label>
              <AirportCombobox
                id="flight-plan-departure-airport"
                value={departureAirport}
                candidates={depCandidates}
                onValueChange={(value) =>
                  updateDraft({
                    departureAirport: value,
                    departureRunway: null,
                    departureProcedureId: null
                  })
                }
                placeholder={t('flightPlan.airportPlaceholder')}
                disabled={!navDataReady}
              />
            </div>

            <label className="settings-field">
              <span>{t('flightPlan.departureRunway')}</span>
              <Select
                value={departureRunway || NONE_SELECT_VALUE}
                onValueChange={(value) =>
                  updateDraft({
                    departureRunway: value === NONE_SELECT_VALUE ? null : value,
                    departureProcedureId: null
                  })
                }
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
                onValueChange={(value) =>
                  updateDraft({
                    departureProcedureId: value === NONE_SELECT_VALUE ? null : value
                  })
                }
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
                onChange={(event) =>
                  updateDraft({
                    enrouteText: event.target.value.toUpperCase()
                  })
                }
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

            <div className="settings-field">
              <label htmlFor="flight-plan-destination-airport">
                {t('flightPlan.destinationAirport')}
              </label>
              <AirportCombobox
                id="flight-plan-destination-airport"
                value={destinationAirport}
                candidates={destCandidates}
                onValueChange={(value) =>
                  updateDraft({
                    destinationAirport: value,
                    arrivalRunway: null,
                    arrivalProcedureId: null,
                    approachProcedureId: null,
                    arrivalTransitionId: null
                  })
                }
                placeholder={t('flightPlan.airportPlaceholder')}
                disabled={!navDataReady}
              />
            </div>

            <label className="settings-field">
              <span>{t('flightPlan.arrivalRunway')}</span>
              <Select
                value={arrivalRunway || NONE_SELECT_VALUE}
                onValueChange={(value) =>
                  updateDraft({
                    arrivalRunway: value === NONE_SELECT_VALUE ? null : value,
                    arrivalProcedureId: null,
                    approachProcedureId: null,
                    arrivalTransitionId: null
                  })
                }
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
                onValueChange={(value) =>
                  updateDraft({
                    arrivalProcedureId: value === NONE_SELECT_VALUE ? null : value
                  })
                }
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
                onValueChange={(value) =>
                  updateDraft({
                    approachProcedureId: value === NONE_SELECT_VALUE ? null : value,
                    arrivalTransitionId: null
                  })
                }
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
                onValueChange={(value) =>
                  updateDraft({
                    arrivalTransitionId: value === NONE_SELECT_VALUE ? null : value
                  })
                }
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

        </div>
      </aside>
    </section>
  )
}

function matchRunwayOption(runways: NavRunwayOption[], importedRunway: string | null): NavRunwayOption | null {
  const normalizedImported = normalizeRunwayToken(importedRunway)
  if (!normalizedImported) {
    return null
  }

  return (
    runways.find(
      (runway) =>
        normalizeRunwayToken(runway.name) === normalizedImported ||
        normalizeRunwayToken(runway.displayName) === normalizedImported
    ) ?? null
  )
}

function matchProcedureOption(
  procedures: NavProcedureOption[],
  importedName: string | null,
  fallbackName?: string | null
): NavProcedureOption | null {
  const candidates = [importedName, fallbackName].map(normalizeProcedureToken).filter(Boolean) as string[]
  if (!candidates.length) {
    return null
  }

  for (const candidate of candidates) {
    const exact = procedures.find((procedure) => procedureOptionMatches(procedure, candidate))
    if (exact) {
      return exact
    }
  }

  for (const candidate of candidates) {
    const fuzzy = procedures.find((procedure) => procedureOptionFuzzyMatches(procedure, candidate))
    if (fuzzy) {
      return fuzzy
    }
  }

  return null
}

function stripMatchedProceduresFromRouteText(
  routeText: string,
  departureProcedure: NavProcedureOption | null,
  arrivalProcedure: NavProcedureOption | null
): string {
  const tokens = routeText
    .split(/\s+/u)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)

  if (!tokens.length) {
    return ''
  }

  const cleanedTokens = [...tokens]
  const firstToken = cleanedTokens[0]
  const lastToken = cleanedTokens[cleanedTokens.length - 1]

  if (
    departureProcedure &&
    firstToken &&
    (procedureOptionMatches(departureProcedure, normalizeProcedureToken(firstToken)) ||
      procedureOptionFuzzyMatches(departureProcedure, normalizeProcedureToken(firstToken)))
  ) {
    cleanedTokens.shift()
  }

  const updatedLastToken = cleanedTokens[cleanedTokens.length - 1]
  if (
    arrivalProcedure &&
    updatedLastToken &&
    (procedureOptionMatches(arrivalProcedure, normalizeProcedureToken(updatedLastToken)) ||
      procedureOptionFuzzyMatches(arrivalProcedure, normalizeProcedureToken(updatedLastToken)))
  ) {
    cleanedTokens.pop()
  }

  return cleanedTokens.join(' ')
}

function matchTransitionOption(
  transitions: NavTransitionOption[],
  importedName: string | null,
  approachProcedureId: string | null,
  arrivalRunway: string | null
): NavTransitionOption | null {
  const normalizedImported = normalizeProcedureToken(importedName)
  if (!normalizedImported || !approachProcedureId) {
    return null
  }

  const parsedApproachId = parseApproachProcedureId(approachProcedureId)
  if (!parsedApproachId) {
    return null
  }

  const filtered = transitions.filter(
    (transition) =>
      transition.approachId === parsedApproachId && runwayMatches(transition.runwayName, arrivalRunway ?? '')
  )

  return (
    filtered.find((transition) => procedureNameMatches(transition.name, normalizedImported)) ??
    filtered.find((transition) => procedureNameFuzzyMatches(transition.name, normalizedImported)) ??
    null
  )
}

function getRouteProcedureFallback(routeText: string, phase: 'departure' | 'arrival'): string | null {
  const candidates = routeText
    .split(/\s+/u)
    .map((token) => normalizeProcedureToken(token))
    .filter((token): token is string => Boolean(token))
    .filter((token) => token !== 'DCT' && token !== 'DIRECT')
    .filter(isProcedureLikeToken)

  if (!candidates.length) {
    return null
  }

  return phase === 'departure' ? candidates[0] ?? null : candidates[candidates.length - 1] ?? null
}

function normalizeRunwayToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^RUNWAY\s*/u, '')
    .replace(/^RWY\s*/u, '')
    .replace(/\s+/gu, '')
}

function normalizeProcedureToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/gu, '')
    .replace(/[-/.]/gu, '')
}

function procedureNameMatches(procedureName: string, candidate: string): boolean {
  return normalizeProcedureToken(procedureName) === candidate
}

function procedureNameFuzzyMatches(procedureName: string, candidate: string): boolean {
  const normalizedProcedure = normalizeProcedureToken(procedureName)
  return normalizedProcedure.includes(candidate) || candidate.includes(normalizedProcedure)
}

function procedureOptionMatches(procedure: NavProcedureOption, candidate: string): boolean {
  return getProcedureMatchTokens(procedure).some((token) => token === candidate)
}

function procedureOptionFuzzyMatches(procedure: NavProcedureOption, candidate: string): boolean {
  return getProcedureMatchTokens(procedure).some((token) => token.includes(candidate) || candidate.includes(token))
}

function getProcedureMatchTokens(procedure: NavProcedureOption): string[] {
  const normalizedName = normalizeProcedureToken(procedure.name)
  const candidates = new Set<string>()

  if (normalizedName) {
    candidates.add(normalizedName)
  }

  if (procedure.procedureType === 'arrival' || procedure.procedureType === 'departure') {
    const suffix = procedure.procedureType === 'arrival' ? 'A' : 'D'
    if (normalizedName && !normalizedName.endsWith(suffix)) {
      candidates.add(`${normalizedName}${suffix}`)
    }

    const truncatedAlias = buildTruncatedProcedureAlias(normalizedName, suffix)
    if (truncatedAlias) {
      candidates.add(truncatedAlias)
    }
  }

  return Array.from(candidates)
}

function buildTruncatedProcedureAlias(procedureName: string, suffix: 'A' | 'D'): string | null {
  if (!procedureName) {
    return null
  }

  const withoutSuffix = procedureName.endsWith(suffix) ? procedureName.slice(0, -1) : procedureName
  const match = withoutSuffix.match(/^([A-Z]{5})(\d{1,2})$/u)
  if (!match) {
    return null
  }

  const [, fixPrefix, variant] = match
  return `${fixPrefix.slice(0, 4)}${variant}${suffix}`
}

function isProcedureLikeToken(token: string): boolean {
  if (token.length < 4) return false
  if (!/[0-9]/u.test(token)) return false
  if (/^(?:[A-Z]{1,3}\d+[A-Z]?|N\d+|Q\d+|T\d+|V\d+|J\d+|Y\d+|UL\d+|UM\d+|UY\d+|UT\d+)$/u.test(token)) {
    return false
  }
  if (/^\d{4}[NS]\d{5}[EW]$/u.test(token)) {
    return false
  }
  if (/^[A-Z]{1,2}\d{1,3}$/u.test(token)) {
    return false
  }
  return /^[A-Z0-9]+$/u.test(token)
}
