import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-leaflet', () => ({
  Marker: ({
    interactive,
    keyboard,
    position,
    title,
    zIndexOffset
  }: {
    interactive: boolean
    keyboard: boolean
    position: [number, number]
    title: string
    zIndexOffset: number
  }) => (
    <div
      data-testid="aircraft-marker"
      data-interactive={String(interactive)}
      data-keyboard={String(keyboard)}
      data-position={JSON.stringify(position)}
      data-z-index-offset={String(zIndexOffset)}
      title={title}
    />
  )
}))

import {
  AIRCRAFT_MARKER_Z_INDEX_OFFSET,
  AircraftMapMarker
} from '../../../src/renderer/components/AircraftArrow'

describe('AircraftMapMarker', () => {
  it('stays in the default marker pane with an offset above every route point', () => {
    render(
      <AircraftMapMarker
        lat={31.2}
        lon={121.5}
        headingDeg={90}
        title="Aircraft position"
      />
    )

    const marker = screen.getByTestId('aircraft-marker')

    expect(AIRCRAFT_MARKER_Z_INDEX_OFFSET).toBeGreaterThan(1350)
    expect(marker).toHaveAttribute(
      'data-z-index-offset',
      String(AIRCRAFT_MARKER_Z_INDEX_OFFSET)
    )
    expect(marker).toHaveAttribute('data-position', '[31.2,121.5]')
    expect(marker).toHaveAttribute('data-interactive', 'false')
    expect(marker).toHaveAttribute('data-keyboard', 'false')
  })
})
