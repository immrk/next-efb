import { describe, expect, it } from 'vitest'
import type {
  FlightPlanSelection,
  NavAirportProcedures
} from '@shared/flight-plan-types'
import { createChart } from '../../helpers/factories'
import {
  buildManualMountCards,
  buildProcedureMountCards
} from '../../../src/renderer/utils/chartMountCards'

const selection: FlightPlanSelection = {
  departureAirport: 'zbaa',
  destinationAirport: 'ZSPD',
  departureRunway: '36R',
  departureProcedureId: 'departure-1',
  arrivalRunway: '17L',
  arrivalProcedureId: 'arrival-1',
  approachProcedureId: 'approach-1',
  arrivalTransitionId: null
}

const departure: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [
    {
      id: 'departure-1',
      name: 'PEK 1D',
      procedureType: 'departure',
      runwayName: '36R'
    }
  ],
  arrivals: [],
  approaches: [],
  transitions: []
}

const destination: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [
    {
      id: 'arrival-1',
      name: 'SAS 1A',
      procedureType: 'arrival',
      runwayName: '17L'
    }
  ],
  approaches: [
    {
      id: 'approach-1',
      name: 'ILS Z 17L',
      procedureType: 'approach',
      runwayName: '17L'
    }
  ],
  transitions: []
}

describe('chart mount card derivation', () => {
  it('matches charts by bound procedure and normalized title', () => {
    const charts = [
      createChart({
        id: 'sid',
        airportCode: 'ZBAA',
        chartType: 'sid',
        title: 'Different title',
        boundApproachProcedureIds: ['departure-1']
      }),
      createChart({
        id: 'star',
        airportCode: ' zspd ',
        chartType: 'star',
        title: ' sas 1a ',
        boundApproachProcedureIds: []
      }),
      createChart({
        id: 'approach',
        airportCode: 'ZSPD',
        chartType: 'approach',
        title: 'ILS Z 17L',
        boundApproachProcedureIds: [],
        isGeoreferenced: false
      })
    ]

    expect(
      buildProcedureMountCards(charts, selection, { departure, destination })
    ).toEqual([
      expect.objectContaining({
        procedureKind: 'departure',
        chartId: 'sid',
        state: 'active'
      }),
      expect.objectContaining({
        procedureKind: 'arrival',
        chartId: 'star',
        state: 'active'
      }),
      expect.objectContaining({
        procedureKind: 'approach',
        chartId: 'approach',
        state: 'missing-georef'
      })
    ])
  })

  it('prefers a georeferenced match, otherwise the latest match', () => {
    const cards = buildProcedureMountCards(
      [
        createChart({
          id: 'old-georef',
          airportCode: 'ZBAA',
          chartType: 'sid',
          boundApproachProcedureIds: ['departure-1'],
          isGeoreferenced: true,
          updatedAt: 1
        }),
        createChart({
          id: 'new-not-ready',
          airportCode: 'ZBAA',
          chartType: 'sid',
          boundApproachProcedureIds: ['departure-1'],
          isGeoreferenced: false,
          updatedAt: 2
        })
      ],
      { ...selection, arrivalProcedureId: null, approachProcedureId: null },
      { departure, destination }
    )

    expect(cards[0]).toMatchObject({ chartId: 'old-georef', state: 'active' })
  })

  it('reports missing charts and ignores incomplete selections', () => {
    expect(
      buildProcedureMountCards([], selection, { departure, destination })
    ).toEqual([
      expect.objectContaining({ procedureKind: 'departure', state: 'missing-chart' }),
      expect.objectContaining({ procedureKind: 'arrival', state: 'missing-chart' }),
      expect.objectContaining({ procedureKind: 'approach', state: 'missing-chart' })
    ])
    expect(buildProcedureMountCards([], null, { departure, destination })).toEqual([])
    expect(
      buildProcedureMountCards(
        [],
        { ...selection, departureProcedureId: 'unknown' },
        { departure, destination }
      ).some((card) => card.procedureKind === 'departure')
    ).toBe(false)
  })

  it('builds manual cards only for ready and non-excluded charts', () => {
    const charts = [
      createChart({ id: 'ready' }),
      createChart({ id: 'excluded' }),
      createChart({ id: 'not-ready', isGeoreferenced: false })
    ]

    expect(buildManualMountCards(charts, new Set(['excluded']))).toEqual([
      {
        id: 'manual:ready',
        kind: 'manual',
        chart: charts[0]
      }
    ])
  })
})
