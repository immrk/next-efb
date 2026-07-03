import { describe, expect, it } from 'vitest'
import type { ChartRecord, GeoReferencePoint } from '../src/shared/chart-types'
import type { AircraftState } from '../src/shared/types'
import {
  buildManualMountCards,
  buildProcedureMountCards
} from '../src/renderer/utils/chartMountCards'
import {
  getChartRotationDeg,
  projectAircraftToChart
} from '../src/renderer/utils/chartMath'
import {
  filterProceduresByRunway,
  parseApproachProcedureId
} from '../src/renderer/utils/navProcedures'

const chart = (partial: Partial<ChartRecord>): ChartRecord => ({
  id: 'chart-1',
  title: 'SID ONE',
  airportCode: 'ZBAA',
  chartType: 'sid',
  titleMode: 'approach-procedure',
  boundRunwayNames: ['36L'],
  boundApproachProcedureIds: ['departure:1'],
  sourceFilePath: '/chart.pdf',
  previewImagePath: null,
  fileFormat: 'pdf',
  width: 1000,
  height: 1000,
  isGeoreferenced: true,
  createdAt: 1,
  updatedAt: 1,
  ...partial
})

describe('chart mounting and navigation helpers', () => {
  it('prefers the georeferenced chart bound to the selected procedure', () => {
    const charts = [
      chart({ id: 'old', isGeoreferenced: false, updatedAt: 10 }),
      chart({ id: 'ready', isGeoreferenced: true, updatedAt: 1 })
    ]
    const cards = buildProcedureMountCards(
      charts,
      {
        departureAirport: 'zbaa',
        destinationAirport: 'ZSPD',
        departureRunway: '36L',
        departureProcedureId: 'departure:1',
        arrivalRunway: null,
        arrivalProcedureId: null,
        approachProcedureId: null,
        arrivalTransitionId: null
      },
      {
        departure: {
          airport: null,
          runways: [],
          departures: [
            { id: 'departure:1', name: 'SID ONE', procedureType: 'departure', runwayName: '36L' }
          ],
          arrivals: [],
          approaches: [],
          transitions: []
        },
        destination: null
      }
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ chartId: 'ready', state: 'active' })
    expect(buildManualMountCards(charts, new Set(['ready'])).map((item) => item.chart.id)).toEqual([])
  })

  it('filters procedures by runway while retaining runway-agnostic entries', () => {
    const procedures = [
      { runwayName: '36L', id: 'one' },
      { runwayName: '18R', id: 'two' },
      { runwayName: null, id: 'all' }
    ]
    expect(filterProceduresByRunway(procedures, '36l').map((item) => item.id)).toEqual([
      'one',
      'all'
    ])
    expect(parseApproachProcedureId('approach:42')).toBe(42)
    expect(parseApproachProcedureId('departure:42')).toBeNull()
  })
})

describe('chart georeference math', () => {
  const points: GeoReferencePoint[] = [
    {
      id: 'one',
      chartId: 'chart-1',
      index: 1,
      mapLat: 40,
      mapLon: 116,
      chartX: 100,
      chartY: 200
    },
    {
      id: 'two',
      chartId: 'chart-1',
      index: 2,
      mapLat: 40,
      mapLon: 117,
      chartX: 1100,
      chartY: 200
    }
  ]

  it('projects a live aircraft position into chart coordinates', () => {
    const aircraft: AircraftState = {
      connected: true,
      source: 'mock',
      lat: 40,
      lon: 116.5,
      altitudeFt: 10000,
      headingDeg: 90,
      groundSpeedKts: 250,
      onGround: false,
      updatedAt: 1
    }

    expect(getChartRotationDeg(points)).toBeCloseTo(0)
    expect(projectAircraftToChart(aircraft, points)).toMatchObject({
      x: expect.closeTo(600, 4),
      y: expect.closeTo(200, 4)
    })
  })

  it('rejects disconnected aircraft data', () => {
    expect(
      projectAircraftToChart(
        {
          connected: false,
          source: 'mock',
          lat: 40,
          lon: 116.5,
          altitudeFt: 10000,
          headingDeg: 90,
          groundSpeedKts: 250,
          onGround: false,
          updatedAt: 1
        },
        points
      )
    ).toBeNull()
  })
})
