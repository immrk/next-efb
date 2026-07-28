import { beforeEach, describe, expect, it } from 'vitest'
import {
  persistStoredChartDockState,
  persistStoredFlightPlanDraft,
  persistStoredFlightPlanResult,
  persistStoredSimBriefPlan,
  readStoredChartDockState,
  readStoredFlightPlanDraft,
  readStoredFlightPlanResult,
  readStoredSimBriefPlan
} from '../../../src/renderer/utils/flightPlanPersistence'
import type { SimBriefImportResult } from '../../../src/shared/flight-plan-types'

describe('flight plan persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns safe defaults without stored data', () => {
    expect(readStoredFlightPlanDraft()).toEqual({
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
    expect(readStoredFlightPlanResult()).toBeNull()
    expect(readStoredChartDockState()).toEqual({
      mountedChartIds: [],
      activeChartId: null,
      overlayDismissed: false
    })
  })

  it('persists draft, result and dock state without overwriting siblings', () => {
    const draft = {
      departureAirport: 'ZBAA',
      destinationAirport: 'ZSPD',
      enrouteText: 'DCT FIX1',
      departureRunway: '36R',
      departureProcedureId: 'approach:1',
      arrivalRunway: '17L',
      arrivalProcedureId: 'approach:2',
      approachProcedureId: 'approach:3',
      arrivalTransitionId: 'transition:4'
    }
    const result = {
      points: [
        { ident: 'ZBAA', lat: 40, lon: 116, source: 'airport' as const }
      ],
      segments: [],
      unresolvedTokens: [],
      summary: 'test'
    }
    const dock = {
      mountedChartIds: ['a', 'b'],
      activeChartId: 'b',
      overlayDismissed: true
    }

    persistStoredFlightPlanDraft(draft)
    persistStoredFlightPlanResult(result)
    persistStoredChartDockState(dock)

    expect(readStoredFlightPlanDraft()).toEqual(draft)
    expect(readStoredFlightPlanResult()).toEqual({
      points: result.points,
      segments: result.segments
    })
    expect(readStoredChartDockState()).toEqual(dock)

    persistStoredFlightPlanResult(null)
    expect(readStoredFlightPlanResult()).toBeNull()
    expect(readStoredFlightPlanDraft()).toEqual(draft)
  })

  it('persists a full SimBrief briefing without truncating its contents', () => {
    const briefingText = [
      '[ OFP ]',
      ...Array.from(
        { length: 1118 },
        (_, index) => `OFP LINE ${String(index + 1).padStart(4, '0')}`
      ),
      'Vertical profile'
    ].join('\n')
    const plan = {
      departureAirport: 'ZSPD',
      destinationAirport: 'ZSAM',
      alternateAirport: 'ZSFZ',
      routeText: 'NXD84D NXD W131 AKDIM',
      departureRunway: '16R',
      arrivalRunway: '05',
      departureProcedureName: null,
      arrivalProcedureName: null,
      approachProcedureName: null,
      arrivalTransitionName: null,
      source: 'simbrief',
      details: {
        briefingText
      }
    } as SimBriefImportResult

    persistStoredSimBriefPlan(plan)

    const restored = readStoredSimBriefPlan()
    expect(restored?.details.briefingText).toBe(briefingText)
    expect(restored?.details.briefingText?.split('\n')).toHaveLength(1120)
    expect(restored?.details.briefingText).toMatch(/Vertical profile$/u)
  })

  it('normalizes malformed and legacy stored snapshots', () => {
    window.localStorage.setItem(
      'nextefb.flight-plan.snapshot.v1',
      JSON.stringify({
        draft: {
          departureAirport: 'ZBAA',
          destinationAirport: 42,
          departureRunway: '36R'
        },
        result: { points: 'bad', segments: [] },
        dock: {
          mountedChartIds: ['ok', 42, null],
          activeChartId: 99,
          overlayDismissed: 'yes'
        }
      })
    )

    expect(readStoredFlightPlanDraft()).toMatchObject({
      departureAirport: 'ZBAA',
      destinationAirport: '',
      departureRunway: '36R',
      arrivalRunway: null
    })
    expect(readStoredFlightPlanResult()).toEqual({ points: [], segments: [] })
    expect(readStoredChartDockState()).toEqual({
      mountedChartIds: ['ok'],
      activeChartId: null,
      overlayDismissed: true
    })

    window.localStorage.setItem('nextefb.flight-plan.snapshot.v1', '{bad')
    expect(readStoredFlightPlanResult()).toBeNull()
  })
})
