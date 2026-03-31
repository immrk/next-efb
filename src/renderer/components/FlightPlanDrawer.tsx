import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BuildFlightPlanResult, NavAirportProcedures, NavDataStatus } from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { toast } from './ui/use-toast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Textarea } from './ui/textarea'

interface FlightPlanDrawerProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
  onPlanBuilt: (result: BuildFlightPlanResult) => void
  onClearPlan: () => void
}

const EMPTY_PROCEDURES: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [],
  approaches: []
}

export function FlightPlanDrawer({
  isOpen,
  onClose,
  onOpenSettings,
  onPlanBuilt,
  onClearPlan
}: FlightPlanDrawerProps) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const settings = useAppStore((state) => state.settings)
  const [navStatus, setNavStatus] = useState<NavDataStatus | null>(null)
  const [departureAirport, setDepartureAirport] = useState('')
  const [destinationAirport, setDestinationAirport] = useState('')
  const [enrouteText, setEnrouteText] = useState('')
  const [departureRunway, setDepartureRunway] = useState<string>('')
  const [arrivalRunway, setArrivalRunway] = useState<string>('')
  const [departureProcedureId, setDepartureProcedureId] = useState<string>('')
  const [approachProcedureId, setApproachProcedureId] = useState<string>('')
  const [depCandidates, setDepCandidates] = useState<string[]>([])
  const [destCandidates, setDestCandidates] = useState<string[]>([])
  const [depProcedures, setDepProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [destProcedures, setDestProcedures] = useState<NavAirportProcedures>(EMPTY_PROCEDURES)
  const [summary, setSummary] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    void appClient.getNavDataStatus().then(setNavStatus)
  }, [appClient, isOpen])

  useEffect(() => {
    if (!isOpen) return
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
  }, [appClient, departureAirport, isOpen])

  useEffect(() => {
    if (!isOpen) return
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
  }, [appClient, destinationAirport, isOpen])

  useEffect(() => {
    const ident = departureAirport.trim().toUpperCase()
    if (!ident) {
      setDepProcedures(EMPTY_PROCEDURES)
      setDepartureProcedureId('')
      setDepartureRunway('')
      return
    }

    void appClient.getNavAirportProcedures(ident).then((procedures) => {
      setDepProcedures(procedures)
      if (!procedures.runways.some((runway) => runway.name === departureRunway)) {
        setDepartureRunway('')
      }
      if (!procedures.departures.some((procedure) => procedure.id === departureProcedureId)) {
        setDepartureProcedureId('')
      }
    })
  }, [appClient, departureAirport, departureProcedureId, departureRunway])

  useEffect(() => {
    const ident = destinationAirport.trim().toUpperCase()
    if (!ident) {
      setDestProcedures(EMPTY_PROCEDURES)
      setApproachProcedureId('')
      setArrivalRunway('')
      return
    }

    void appClient.getNavAirportProcedures(ident).then((procedures) => {
      setDestProcedures(procedures)
      if (!procedures.runways.some((runway) => runway.name === arrivalRunway)) {
        setArrivalRunway('')
      }
      if (!procedures.approaches.some((procedure) => procedure.id === approachProcedureId)) {
        setApproachProcedureId('')
      }
    })
  }, [appClient, destinationAirport, approachProcedureId, arrivalRunway])

  const canBuild = useMemo(() => {
    return Boolean(departureAirport.trim() && destinationAirport.trim())
  }, [departureAirport, destinationAirport])

  const handleImportSimBrief = async () => {
    setIsLoading(true)
    setErrorMessage('')
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
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBuild = async () => {
    if (!canBuild) return
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await appClient.buildFlightPlan({
        departureAirport: departureAirport.trim().toUpperCase(),
        destinationAirport: destinationAirport.trim().toUpperCase(),
        enrouteText,
        departureRunway: departureRunway || null,
        arrivalRunway: arrivalRunway || null,
        departureProcedureId: departureProcedureId || null,
        arrivalProcedureId: null,
        approachProcedureId: approachProcedureId || null
      })
      setSummary(result.summary)
      setWarnings(result.unresolvedTokens)
      onPlanBuilt(result)
      toast.success(t('feedback.updated'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ROUTE_BUILD_FAILED'
      setErrorMessage(message)
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
              variant="icon"
              onClick={onOpenSettings}
              aria-label={t('flightPlan.openSettings')}
              title={t('flightPlan.openSettings')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
                <path d="M19.4 15A1 1 0 0 0 19.6 16.1L19.7 16.2A1 1 0 1 1 18.3 17.6L18.2 17.5A1 1 0 0 0 17.1 17.3A1 1 0 0 0 16.5 18.2V18.5A1 1 0 1 1 14.5 18.5V18.3A1 1 0 0 0 13.8 17.4A1 1 0 0 0 12.7 17.7L12.6 17.8A1 1 0 0 1 11.2 16.4L11.3 16.3A1 1 0 0 0 11.5 15.2A1 1 0 0 0 10.6 14.6H10.3A1 1 0 1 1 10.3 12.6H10.5A1 1 0 0 0 11.4 11.9A1 1 0 0 0 11.1 10.8L11 10.7A1 1 0 1 1 12.4 9.3L12.5 9.4A1 1 0 0 0 13.6 9.6A1 1 0 0 0 14.2 8.7V8.4A1 1 0 1 1 16.2 8.4V8.6A1 1 0 0 0 16.9 9.5A1 1 0 0 0 18 9.2L18.1 9.1A1 1 0 0 1 19.5 10.5L19.4 10.6A1 1 0 0 0 19.2 11.7A1 1 0 0 0 20.1 12.3H20.4A1 1 0 1 1 20.4 14.3H20.2A1 1 0 0 0 19.4 15Z" />
              </svg>
            </Button>
            <Button type="button" variant="icon" onClick={onClose} aria-label={t('flightPlan.close')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6L18 18M18 6L6 18" />
              </svg>
            </Button>
          </div>
        </header>

        <div className="flight-plan-body">
          <div className="settings-note-card">
            <strong>{t('flightPlan.navStatus')}</strong>
            <span>{navStatus?.exists ? t('flightPlan.navReady') : t('flightPlan.navMissing')}</span>
          </div>

          <label className="settings-field">
            <span>{t('flightPlan.departureAirport')}</span>
            <Input
              value={departureAirport}
              onChange={(event) => setDepartureAirport(event.target.value.toUpperCase())}
              list="departure-airports"
              placeholder={t('flightPlan.airportPlaceholder')}
            />
            <datalist id="departure-airports">
              {depCandidates.map((ident) => (
                <option key={ident} value={ident} />
              ))}
            </datalist>
          </label>

          <label className="settings-field">
            <span>{t('flightPlan.departureRunway')}</span>
            <Select value={departureRunway} onChange={(event) => setDepartureRunway(event.target.value)}>
              <option value="">{t('flightPlan.notSpecified')}</option>
              {depProcedures.runways.map((runway) => (
                <option key={runway.name} value={runway.name}>
                  {runway.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="settings-field">
            <span>{t('flightPlan.departureProcedure')}</span>
            <Select value={departureProcedureId} onChange={(event) => setDepartureProcedureId(event.target.value)}>
              <option value="">{t('flightPlan.notSpecified')}</option>
              {depProcedures.departures.map((procedure) => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="settings-field">
            <span>{t('flightPlan.enroute')}</span>
            <Textarea
              className="flight-plan-textarea"
              value={enrouteText}
              onChange={(event) => setEnrouteText(event.target.value.toUpperCase())}
              placeholder={t('flightPlan.enroutePlaceholder')}
            />
          </label>

          <label className="settings-field">
            <span>{t('flightPlan.destinationAirport')}</span>
            <Input
              value={destinationAirport}
              onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())}
              list="destination-airports"
              placeholder={t('flightPlan.airportPlaceholder')}
            />
            <datalist id="destination-airports">
              {destCandidates.map((ident) => (
                <option key={ident} value={ident} />
              ))}
            </datalist>
          </label>

          <label className="settings-field">
            <span>{t('flightPlan.arrivalRunway')}</span>
            <Select value={arrivalRunway} onChange={(event) => setArrivalRunway(event.target.value)}>
              <option value="">{t('flightPlan.notSpecified')}</option>
              {destProcedures.runways.map((runway) => (
                <option key={runway.name} value={runway.name}>
                  {runway.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="settings-field">
            <span>{t('flightPlan.approachProcedure')}</span>
            <Select value={approachProcedureId} onChange={(event) => setApproachProcedureId(event.target.value)}>
              <option value="">{t('flightPlan.notSpecified')}</option>
              {destProcedures.approaches.map((procedure) => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.name}
                </option>
              ))}
            </Select>
          </label>

          <div className="button-row">
            <Button type="button" variant="secondary" disabled={isLoading} onClick={handleImportSimBrief}>
              {t('flightPlan.importSimbrief')}
            </Button>
            <Button type="button" variant="secondary" disabled={isLoading} onClick={onClearPlan}>
              {t('flightPlan.clear')}
            </Button>
            <Button type="button" disabled={!canBuild || isLoading} onClick={handleBuild}>
              {t('flightPlan.build')}
            </Button>
          </div>

          {summary ? <div className="settings-note-card">{summary}</div> : null}
          {warnings.length > 0 ? (
            <div className="settings-note-card">
              <strong>{t('flightPlan.unresolved')}</strong>
              <span>{warnings.join(', ')}</span>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="settings-note-card danger-copy">
              <strong>{t('flightPlan.error')}</strong>
              <span>{errorMessage}</span>
            </div>
          ) : null}
        </div>
      </aside>
    </section>
  )
}
