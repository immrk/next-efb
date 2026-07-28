import { describe, expect, it } from 'vitest'
import { createAircraft, createReferencePoints } from '../../helpers/factories'
import {
  getChartFitView,
  getChartRotationDeg,
  projectAircraftToChart
} from '../../../src/renderer/utils/chartMath'

describe('chart viewport math', () => {
  it('fits and centers the complete chart at 100%', () => {
    const fit = getChartFitView(1200, 1800, 1000, 800)

    expect(fit).not.toBeNull()
    expect(fit?.scale).toBeCloseTo(800 / 1800, 8)
    expect(fit?.panX).toBeCloseTo((1000 - 1200 * (800 / 1800)) / 2, 8)
    expect(fit?.panY).toBeCloseTo(0, 8)
    expect(1200 * (fit?.scale ?? 0)).toBeLessThanOrEqual(1000)
    expect(1800 * (fit?.scale ?? 0)).toBeLessThanOrEqual(800)
  })

  it('rejects invalid chart or viewport dimensions', () => {
    expect(getChartFitView(0, 1800, 1000, 800)).toBeNull()
    expect(getChartFitView(1200, 1800, Number.NaN, 800)).toBeNull()
  })
})

describe('chart georeference math', () => {
  it('projects an aircraft between two calibrated points', () => {
    const points = createReferencePoints()
    const result = projectAircraftToChart(
      createAircraft({ lat: 30, lon: 120.5 }),
      points
    )

    expect(result?.x).toBeCloseTo(200, 8)
    expect(result?.y).toBeCloseTo(200, 8)
    expect(getChartRotationDeg(points)).toBeCloseTo(0, 8)
  })

  it('handles a rotated chart calibration', () => {
    const points = createReferencePoints()
    points[1] = {
      ...points[1],
      chartX: 100,
      chartY: 400
    }

    expect(getChartRotationDeg(points)).toBeCloseTo(90, 8)
    expect(
      projectAircraftToChart(createAircraft({ lat: 30, lon: 120.5 }), points)
    ).toEqual(
      expect.objectContaining({
        x: expect.closeTo(100, 8),
        y: expect.closeTo(300, 8)
      })
    )
  })

  it.each([
    [null, createReferencePoints()],
    [createAircraft({ connected: false }), createReferencePoints()],
    [createAircraft({ lat: Number.NaN }), createReferencePoints()],
    [createAircraft({ lat: 91 }), createReferencePoints()],
    [createAircraft({ lon: 181 }), createReferencePoints()],
    [createAircraft({ lat: 0, lon: 0, altitudeFt: 0 }), createReferencePoints()],
    [createAircraft(), createReferencePoints().slice(0, 1)]
  ])('rejects an invalid aircraft or calibration', (aircraft, points) => {
    expect(projectAircraftToChart(aircraft, points)).toBeNull()
  })

  it('rejects duplicate map or chart control points', () => {
    const duplicateMap = createReferencePoints()
    duplicateMap[1] = {
      ...duplicateMap[1],
      mapLat: duplicateMap[0].mapLat,
      mapLon: duplicateMap[0].mapLon
    }
    const duplicateChart = createReferencePoints()
    duplicateChart[1] = {
      ...duplicateChart[1],
      chartX: duplicateChart[0].chartX,
      chartY: duplicateChart[0].chartY
    }

    expect(projectAircraftToChart(createAircraft(), duplicateMap)).toBeNull()
    expect(projectAircraftToChart(createAircraft(), duplicateChart)).toBeNull()
    expect(getChartRotationDeg(duplicateMap)).toBe(0)
  })
})
