import type {
  BuildFlightPlanInput,
  BuildFlightPlanResult,
  FlightPlanPoint,
  FlightPlanSegment,
  SimBriefFlightDetails,
  SimBriefImportResult
} from '@shared/flight-plan-types'

const FLIGHT_PLAN_STORAGE_KEY = 'nextefb.flight-plan.snapshot.v1'

export interface StoredFlightPlanResult {
  points: FlightPlanPoint[]
  segments: FlightPlanSegment[]
}

export interface StoredChartDockState {
  mountedChartIds: string[]
  activeChartId: string | null
  overlayDismissed: boolean
}

interface StoredFlightPlanSnapshot {
  draft: BuildFlightPlanInput
  result: StoredFlightPlanResult | null
  simBrief: SimBriefImportResult | null
  dock: StoredChartDockState
}

const EMPTY_SNAPSHOT: StoredFlightPlanSnapshot = {
  draft: {
    departureAirport: '',
    destinationAirport: '',
    enrouteText: '',
    departureRunway: null,
    departureProcedureId: null,
    arrivalRunway: null,
    arrivalProcedureId: null,
    approachProcedureId: null,
    arrivalTransitionId: null
  },
  result: null,
  simBrief: null,
  dock: {
    mountedChartIds: [],
    activeChartId: null,
    overlayDismissed: false
  }
}

export function readStoredFlightPlanDraft(): BuildFlightPlanInput {
  return readStoredFlightPlanSnapshot().draft
}

export function readStoredFlightPlanResult(): StoredFlightPlanResult | null {
  return readStoredFlightPlanSnapshot().result
}

export function readStoredSimBriefPlan(): SimBriefImportResult | null {
  return readStoredFlightPlanSnapshot().simBrief
}

export function readStoredChartDockState(): StoredChartDockState {
  return readStoredFlightPlanSnapshot().dock
}

export function persistStoredFlightPlanDraft(draft: BuildFlightPlanInput): void {
  persistStoredFlightPlanSnapshot({
    ...readStoredFlightPlanSnapshot(),
    draft
  })
}

export function persistStoredFlightPlanResult(result: BuildFlightPlanResult | null): void {
  persistStoredFlightPlanSnapshot({
    ...readStoredFlightPlanSnapshot(),
    result: result
      ? {
          points: result.points,
          segments: result.segments
        }
      : null
  })
}

export function persistStoredSimBriefPlan(simBrief: SimBriefImportResult | null): void {
  persistStoredFlightPlanSnapshot({
    ...readStoredFlightPlanSnapshot(),
    simBrief
  })
}

export function persistStoredChartDockState(dock: StoredChartDockState): void {
  persistStoredFlightPlanSnapshot({
    ...readStoredFlightPlanSnapshot(),
    dock
  })
}

function readStoredFlightPlanSnapshot(): StoredFlightPlanSnapshot {
  if (typeof window === 'undefined') {
    return EMPTY_SNAPSHOT
  }

  try {
    const raw = window.localStorage.getItem(FLIGHT_PLAN_STORAGE_KEY)
    if (!raw) return EMPTY_SNAPSHOT

    const parsed = JSON.parse(raw) as Partial<StoredFlightPlanSnapshot>
    return {
      draft: normalizeDraft(parsed.draft),
      result: normalizeResult(parsed.result),
      simBrief: normalizeSimBriefPlan(parsed.simBrief),
      dock: normalizeDockState(parsed.dock)
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

function persistStoredFlightPlanSnapshot(snapshot: StoredFlightPlanSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FLIGHT_PLAN_STORAGE_KEY, JSON.stringify(snapshot))
}

function normalizeDraft(draft: unknown): BuildFlightPlanInput {
  if (!draft || typeof draft !== 'object') return EMPTY_SNAPSHOT.draft

  const value = draft as Partial<BuildFlightPlanInput>
  return {
    departureAirport: typeof value.departureAirport === 'string' ? value.departureAirport : '',
    destinationAirport: typeof value.destinationAirport === 'string' ? value.destinationAirport : '',
    enrouteText: typeof value.enrouteText === 'string' ? value.enrouteText : '',
    departureRunway: typeof value.departureRunway === 'string' ? value.departureRunway : null,
    departureProcedureId: typeof value.departureProcedureId === 'string' ? value.departureProcedureId : null,
    arrivalRunway: typeof value.arrivalRunway === 'string' ? value.arrivalRunway : null,
    arrivalProcedureId: typeof value.arrivalProcedureId === 'string' ? value.arrivalProcedureId : null,
    approachProcedureId: typeof value.approachProcedureId === 'string' ? value.approachProcedureId : null,
    arrivalTransitionId: typeof value.arrivalTransitionId === 'string' ? value.arrivalTransitionId : null
  }
}

function normalizeResult(result: unknown): StoredFlightPlanResult | null {
  if (!result || typeof result !== 'object') return null

  const value = result as Partial<StoredFlightPlanResult>
  return {
    points: Array.isArray(value.points) ? (value.points as FlightPlanPoint[]) : [],
    segments: Array.isArray(value.segments) ? (value.segments as FlightPlanSegment[]) : []
  }
}

function normalizeSimBriefPlan(value: unknown): SimBriefImportResult | null {
  if (!value || typeof value !== 'object') return null

  const plan = value as Partial<SimBriefImportResult>
  if (
    plan.source !== 'simbrief' ||
    typeof plan.departureAirport !== 'string' ||
    typeof plan.destinationAirport !== 'string' ||
    typeof plan.routeText !== 'string'
  ) {
    return null
  }

  return {
    departureAirport: plan.departureAirport,
    destinationAirport: plan.destinationAirport,
    alternateAirport: normalizeOptionalString(plan.alternateAirport),
    routeText: plan.routeText,
    departureRunway: normalizeOptionalString(plan.departureRunway),
    arrivalRunway: normalizeOptionalString(plan.arrivalRunway),
    departureProcedureName: normalizeOptionalString(plan.departureProcedureName),
    arrivalProcedureName: normalizeOptionalString(plan.arrivalProcedureName),
    approachProcedureName: normalizeOptionalString(plan.approachProcedureName),
    arrivalTransitionName: normalizeOptionalString(plan.arrivalTransitionName),
    source: 'simbrief',
    details: normalizeSimBriefDetails(plan.details)
  }
}

function normalizeSimBriefDetails(value: unknown): SimBriefFlightDetails {
  const details =
    value && typeof value === 'object'
      ? (value as Partial<SimBriefFlightDetails>)
      : {}

  return {
    flightNumber: normalizeOptionalString(details.flightNumber),
    callsign: normalizeOptionalString(details.callsign),
    departureIata: normalizeOptionalString(details.departureIata),
    destinationIata: normalizeOptionalString(details.destinationIata),
    alternateIata: normalizeOptionalString(details.alternateIata),
    aircraftType: normalizeOptionalString(details.aircraftType),
    aircraftName: normalizeOptionalString(details.aircraftName),
    registration: normalizeOptionalString(details.registration),
    scheduledOut: normalizeOptionalString(details.scheduledOut),
    scheduledOff: normalizeOptionalString(details.scheduledOff),
    scheduledOn: normalizeOptionalString(details.scheduledOn),
    scheduledIn: normalizeOptionalString(details.scheduledIn),
    airTimeSeconds: normalizeOptionalString(details.airTimeSeconds),
    blockTimeSeconds: normalizeOptionalString(details.blockTimeSeconds),
    initialAltitude: normalizeOptionalString(details.initialAltitude),
    cruiseProfile: normalizeOptionalString(details.cruiseProfile),
    costIndex: normalizeOptionalString(details.costIndex),
    routeDistance: normalizeOptionalString(details.routeDistance),
    averageWindDirection: normalizeOptionalString(details.averageWindDirection),
    averageWindSpeed: normalizeOptionalString(details.averageWindSpeed),
    windComponent: normalizeOptionalString(details.windComponent),
    isaDeviation: normalizeOptionalString(details.isaDeviation),
    releaseNumber: normalizeOptionalString(details.releaseNumber),
    airacCycle: normalizeOptionalString(details.airacCycle),
    ofpLayout: normalizeOptionalString(details.ofpLayout),
    units: normalizeOptionalString(details.units),
    navlog: normalizeOptionalString(details.navlog),
    etops: normalizeOptionalString(details.etops),
    enrouteBurn: normalizeOptionalString(details.enrouteBurn),
    passengerCount: normalizeOptionalString(details.passengerCount),
    emptyWeight: normalizeOptionalString(details.emptyWeight),
    estimatedZfw: normalizeOptionalString(details.estimatedZfw),
    estimatedTow: normalizeOptionalString(details.estimatedTow),
    estimatedLandingWeight: normalizeOptionalString(details.estimatedLandingWeight),
    blockFuel: normalizeOptionalString(details.blockFuel),
    baggageWeight: normalizeOptionalString(details.baggageWeight),
    payloadWeight: normalizeOptionalString(details.payloadWeight),
    maxZfw: normalizeOptionalString(details.maxZfw),
    maxTow: normalizeOptionalString(details.maxTow),
    maxLandingWeight: normalizeOptionalString(details.maxLandingWeight),
    atcFlightPlan: normalizeOptionalString(details.atcFlightPlan),
    briefingText: normalizeOptionalString(details.briefingText)
  }
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeDockState(dock: unknown): StoredChartDockState {
  if (!dock || typeof dock !== 'object') {
    return EMPTY_SNAPSHOT.dock
  }

  const value = dock as Partial<StoredChartDockState>
  return {
    mountedChartIds: Array.isArray(value.mountedChartIds)
      ? value.mountedChartIds.filter((chartId): chartId is string => typeof chartId === 'string')
      : [],
    activeChartId: typeof value.activeChartId === 'string' ? value.activeChartId : null,
    overlayDismissed: Boolean(value.overlayDismissed)
  }
}
