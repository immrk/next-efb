import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BuildFlightPlanInput,
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
        username: settings?.simbrief.username,
        userId: settings?.simbrief.userId
      })
      onDraftChange({
        departureAirport: result.departureAirport,
        destinationAirport: result.destinationAirport,
        enrouteText: result.routeText,
        departureRunway: null,
        departureProcedureId: null,
        arrivalRunway: null,
        arrivalProcedureId: null,
        approachProcedureId: null,
        arrivalTransitionId: null
      })
      toast.success(t('feedback.imported'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SIMBRIEF_IMPORT_FAILED'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

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
                onChange={(event) =>
                  updateDraft({
                    departureAirport: event.target.value.toUpperCase(),
                    departureRunway: null,
                    departureProcedureId: null
                  })
                }
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

            <label className="settings-field">
              <span>{t('flightPlan.destinationAirport')}</span>
              <Input
                value={destinationAirport}
                onChange={(event) =>
                  updateDraft({
                    destinationAirport: event.target.value.toUpperCase(),
                    arrivalRunway: null,
                    arrivalProcedureId: null,
                    approachProcedureId: null,
                    arrivalTransitionId: null
                  })
                }
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

          <div className="button-row">
            <Button type="button" variant="secondary" disabled={isLoading || !navDataReady} onClick={handleImportSimBrief}>
              {t('flightPlan.importSimbrief')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => {
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
