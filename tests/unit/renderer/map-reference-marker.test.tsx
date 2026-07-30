import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-leaflet', async () => {
  const React = await import('react')

  return {
    Marker: ({
      draggable,
      eventHandlers,
      icon,
      position
    }: {
      draggable: boolean
      eventHandlers: {
        click: (event: { originalEvent: MouseEvent }) => void
        dragend: (event: {
          target: { getLatLng: () => { lat: number; lng: number } }
        }) => void
      }
      icon: { options: { html: string } }
      position: [number, number]
    }) =>
      React.createElement('div', {
        'data-draggable': String(draggable),
        'data-testid': 'map-reference-marker',
        dangerouslySetInnerHTML: { __html: icon.options.html },
        onDragEnd: () =>
          eventHandlers.dragend({
            target: {
              getLatLng: () => ({
                lat: position[0] + 0.1,
                lng: position[1] + 0.2
              })
            }
          }),
        onClick: (event: React.MouseEvent) =>
          eventHandlers.click({ originalEvent: event.nativeEvent })
      })
  }
})

import { MapReferenceMarker } from '../../../src/renderer/components/MapReferenceMarker'

describe('MapReferenceMarker', () => {
  it('deletes only when its top-right delete icon is clicked', () => {
    const onDelete = vi.fn()

    render(
      <MapReferenceMarker
        point={{ lat: 31.1434, lon: 121.8052 }}
        index={1}
        pointCount={2}
        removeLabel="Remove map point 2"
        onDelete={onDelete}
        onMove={vi.fn()}
      />
    )

    const marker = screen.getByTestId('map-reference-marker')
    expect(marker).toHaveAttribute('data-draggable', 'true')

    fireEvent.click(marker)
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove map point 2' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('preserves dragging behavior when two reference points exist', () => {
    const onMove = vi.fn()

    render(
      <MapReferenceMarker
        point={{ lat: 31, lon: 121 }}
        index={0}
        pointCount={2}
        removeLabel="Remove map point 1"
        onDelete={vi.fn()}
        onMove={onMove}
      />
    )

    fireEvent.dragEnd(screen.getByTestId('map-reference-marker'))
    expect(onMove).toHaveBeenCalledWith(0, {
      lat: 31.1,
      lon: 121.2
    })
  })
})
