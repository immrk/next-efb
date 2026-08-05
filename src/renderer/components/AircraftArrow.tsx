import { divIcon, type DivIcon } from 'leaflet'
import { Marker } from 'react-leaflet'

export const AIRCRAFT_MARKER_Z_INDEX_OFFSET = 2000

export function createAircraftLeafletIcon(headingDeg: number): DivIcon {
  return divIcon({
    className: 'aircraft-arrow-icon',
    html: `<div class="aircraft-arrow-shape" style="transform: rotate(${headingDeg}deg)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

interface AircraftMapMarkerProps {
  lat: number
  lon: number
  headingDeg: number
  title: string
}

export function AircraftMapMarker({
  lat,
  lon,
  headingDeg,
  title
}: AircraftMapMarkerProps) {
  return (
    <Marker
      position={[lat, lon]}
      icon={createAircraftLeafletIcon(headingDeg)}
      title={title}
      zIndexOffset={AIRCRAFT_MARKER_Z_INDEX_OFFSET}
      interactive={false}
      keyboard={false}
    />
  )
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
