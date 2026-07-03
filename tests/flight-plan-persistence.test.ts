import { beforeEach, describe, expect, it } from 'vitest'
import {
  persistStoredChartDockState,
  persistStoredFlightPlanDraft,
  persistStoredFlightPlanResult,
  readStoredChartDockState,
  readStoredFlightPlanDraft,
  readStoredFlightPlanResult
} from '../src/renderer/utils/flightPlanPersistence'

describe('flight plan persistence', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips a complete flight plan and its rendered route', () => {
    const draft = {
      departureAirport: 'ZBAA',
      destinationAirport: 'ZSPD',
      enrouteText: 'DCT P117',
      departureRunway: '36L',
      departureProcedureId: 'departure:1',
      arrivalRunway: '34L',
      arrivalProcedureId: 'arrival:2',
      approachProcedureId: 'approach:3',
      arrivalTransitionId: 'transition:4'
    }
    const result = {
      points: [
        { ident: 'ZBAA', lat: 40.08, lon: 116.58, source: 'airport' as const },
        { ident: 'ZSPD', lat: 31.14, lon: 121.8, source: 'airport' as const }
      ],
      segments: [
        {
          points: [
            { ident: 'ZBAA', lat: 40.08, lon: 116.58, source: 'airport' as const },
            { ident: 'ZSPD', lat: 31.14, lon: 121.8, source: 'airport' as const }
          ],
          phase: 'enroute' as const
        }
      ],
      unresolvedTokens: [],
      summary: 'ZBAA-ZSPD'
    }

    persistStoredFlightPlanDraft(draft)
    persistStoredFlightPlanResult(result)
    persistStoredChartDockState({
      mountedChartIds: ['chart-1'],
      activeChartId: 'chart-1',
      overlayDismissed: false
    })

    expect(readStoredFlightPlanDraft()).toEqual(draft)
    expect(readStoredFlightPlanResult()).toEqual({
      points: result.points,
      segments: result.segments
    })
    expect(readStoredChartDockState()).toEqual({
      mountedChartIds: ['chart-1'],
      activeChartId: 'chart-1',
      overlayDismissed: false
    })
  })

  it('recovers safe defaults from corrupt storage', () => {
    window.localStorage.setItem('nextefb.flight-plan.snapshot.v1', '{broken')

    expect(readStoredFlightPlanDraft().departureAirport).toBe('')
    expect(readStoredFlightPlanResult()).toBeNull()
    expect(readStoredChartDockState().mountedChartIds).toEqual([])
  })
})
