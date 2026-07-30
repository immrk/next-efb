import { divIcon, type DivIcon } from 'leaflet'

export function createAircraftLeafletIcon(headingDeg: number): DivIcon {
  return divIcon({
    className: 'aircraft-arrow-icon',
    html: `<div class="aircraft-arrow-shape" style="transform: rotate(${headingDeg}deg)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

interface ChartAircraftArrowProps {
  x: number | string
  y: number | string
  headingDeg: number
}

export function ChartAircraftArrow({ x, y, headingDeg }: ChartAircraftArrowProps) {
  return (
    <div
      className="chart-aircraft-arrow"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${headingDeg}deg)`
      }}
    />
  )
}
