import type { AircraftState } from '@shared/types'
import type { GeoReferencePoint } from '@shared/chart-types'

interface LocalPoint {
  x: number
  y: number
}

function mapToLocal(lat: number, lon: number, refLat: number): LocalPoint {
  const cosLat = Math.cos((refLat * Math.PI) / 180)
  return {
    x: lon * cosLat,
    y: -lat
  }
}

function getChartTransform(points: GeoReferencePoint[]): {
  scale: number
  angleRad: number
  chartOrigin: LocalPoint
  mapOrigin: LocalPoint
} | null {
  if (points.length !== 2) return null

  const [p1, p2] = points
  const mapA = mapToLocal(p1.mapLat, p1.mapLon, p1.mapLat)
  const mapB = mapToLocal(p2.mapLat, p2.mapLon, p1.mapLat)

  const vMap = {
    x: mapB.x - mapA.x,
    y: mapB.y - mapA.y
  }
  const vChart = {
    x: p2.chartX - p1.chartX,
    y: p2.chartY - p1.chartY
  }

  const mapLen = Math.hypot(vMap.x, vMap.y)
  const chartLen = Math.hypot(vChart.x, vChart.y)
  if (mapLen === 0 || chartLen === 0) return null

  return {
    scale: chartLen / mapLen,
    angleRad: Math.atan2(vChart.y, vChart.x) - Math.atan2(vMap.y, vMap.x),
    chartOrigin: { x: p1.chartX, y: p1.chartY },
    mapOrigin: mapA
  }
}

export function getChartRotationDeg(points: GeoReferencePoint[]): number {
  const transform = getChartTransform(points)
  if (!transform) return 0
  return (transform.angleRad * 180) / Math.PI
}

export function projectAircraftToChart(
  aircraft: AircraftState | null,
  points: GeoReferencePoint[]
): { x: number; y: number } | null {
  if (!aircraft || points.length !== 2) return null
  if (!aircraft.connected) return null
  if (!Number.isFinite(aircraft.lat) || !Number.isFinite(aircraft.lon)) return null
  if (Math.abs(aircraft.lat) > 90 || Math.abs(aircraft.lon) > 180) return null
  if (aircraft.lat === 0 && aircraft.lon === 0 && aircraft.altitudeFt === 0) return null

  const [p1] = points
  const transform = getChartTransform(points)
  if (!transform) return null
  const mapP = mapToLocal(aircraft.lat, aircraft.lon, p1.mapLat)

  const relative = {
    x: mapP.x - transform.mapOrigin.x,
    y: mapP.y - transform.mapOrigin.y
  }

  const rotated = {
    x:
      (relative.x * Math.cos(transform.angleRad) - relative.y * Math.sin(transform.angleRad)) *
      transform.scale,
    y:
      (relative.x * Math.sin(transform.angleRad) + relative.y * Math.cos(transform.angleRad)) *
      transform.scale
  }

  return {
    x: transform.chartOrigin.x + rotated.x,
    y: transform.chartOrigin.y + rotated.y
  }
}
