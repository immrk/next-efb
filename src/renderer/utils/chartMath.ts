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

export function projectAircraftToChart(
  aircraft: AircraftState | null,
  points: GeoReferencePoint[]
): { x: number; y: number } | null {
  if (!aircraft || points.length !== 2) return null

  const [p1, p2] = points
  const mapA = mapToLocal(p1.mapLat, p1.mapLon, p1.mapLat)
  const mapB = mapToLocal(p2.mapLat, p2.mapLon, p1.mapLat)
  const mapP = mapToLocal(aircraft.lat, aircraft.lon, p1.mapLat)

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

  const scale = chartLen / mapLen
  const mapAngle = Math.atan2(vMap.y, vMap.x)
  const chartAngle = Math.atan2(vChart.y, vChart.x)
  const angle = chartAngle - mapAngle

  const relative = {
    x: mapP.x - mapA.x,
    y: mapP.y - mapA.y
  }

  const rotated = {
    x: (relative.x * Math.cos(angle) - relative.y * Math.sin(angle)) * scale,
    y: (relative.x * Math.sin(angle) + relative.y * Math.cos(angle)) * scale
  }

  return {
    x: p1.chartX + rotated.x,
    y: p1.chartY + rotated.y
  }
}
