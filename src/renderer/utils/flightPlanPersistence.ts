import type { BuildFlightPlanInput, BuildFlightPlanResult, FlightPlanPoint, FlightPlanSegment } from '@shared/flight-plan-types'

const FLIGHT_PLAN_STORAGE_KEY = 'nextefb.flight-plan.snapshot.v1'

interface StoredFlightPlanResult {
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
