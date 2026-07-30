import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { MapPin, Settings, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  BuildFlightPlanInput,
  NavAirportProcedures
} from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { filterProceduresByRunway, parseApproachProcedureId, runwayMatches } from '../utils/navProcedures'
import { Button } from './ui/button'
import { FlightPlanCommands } from './FlightPlanCommands'
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
  onImport: () => Promise<void> | void
  onClear: () => void
  isImporting: boolean
  navDataReady: boolean
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
  onDraftChange,
  onImport,
  onClear,
  isImporting,
  navDataReady
}: FlightPlanDrawerProps) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const [depCandidates, setDepCandidates] = useState<string[]>([])
  const [destCandidates, setDestCandidates] = useState<string[]>([])
  const [depProcedures, setDepProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [destProcedures, setDestProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)

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

  if (!isOpen) {
    return null
  }

  return (
    <section className="flight-plan-drawer-layer">
      <aside className="flight-plan-drawer">
        <header className="flight-plan-head">
          <strong>{t('flightPlan.title')}</strong>
          <div className="flight-plan-head-actions">
            <FlightPlanCommands
              isImporting={isImporting}
              importDisabled={!navDataReady}
              onImport={onImport}
              onClear={onClear}
            />
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
