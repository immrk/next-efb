import { Marker } from 'react-leaflet'
import { createMapReferenceLeafletIcon } from '../utils/mapVisuals'

export interface MapReferencePoint {
  lat: number
  lon: number
}

export function MapReferenceMarker({
  point,
  index,
  pointCount,
  removeLabel,
  onDelete,
  onMove
}: {
  point: MapReferencePoint
  index: number
  pointCount: number
  removeLabel: string
  onDelete: (index: number) => void
  onMove: (index: number, point: MapReferencePoint) => void
}) {
  return (
    <Marker
      position={[point.lat, point.lon]}
      icon={createMapReferenceLeafletIcon(String(index + 1), removeLabel)}
      draggable={pointCount === 2}
      eventHandlers={{
        click: (event) => {
          const target = event.originalEvent.target as Element | null
          if (!target?.closest('[data-map-reference-delete]')) return

          event.originalEvent.preventDefault()
          event.originalEvent.stopPropagation()
          onDelete(index)
        },
        dragend: (event) => {
          if (pointCount !== 2) return
          const marker = event.target as {
            getLatLng: () => { lat: number; lng: number }
          }
          const latLng = marker.getLatLng()
          onMove(index, {
            lat: latLng.lat,
            lon: latLng.lng
          })
        }
      }}
    />
  )
}
