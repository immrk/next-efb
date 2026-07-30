import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const overlayMocks = vi.hoisted(() => {
  const bounds = {
    getNorth: () => 32,
    getSouth: () => 30,
    getEast: () => 122,
    getWest: () => 120
  }
  const map = {
    getBounds: () => bounds,
    getZoom: () => 10
  }

  return {
    getNavMapFeatures: vi.fn(),
    map
  }
})

vi.mock('../../../src/renderer/client', () => ({
  getAppClient: () => ({
    getNavMapFeatures: overlayMocks.getNavMapFeatures
  })
}))

vi.mock('react-leaflet', async () => {
  const React = await import('react')

  return {
    Marker: ({
      children,
      eventHandlers,
      position
    }: {
      children?: React.ReactNode
      eventHandlers?: { click?: () => void }
      position: [number, number]
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': `marker-${position[0]}-${position[1]}`,
          onClick: () => eventHandlers?.click?.()
        },
        children
      ),
    Polyline: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Tooltip: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    useMap: () => overlayMocks.map,
    useMapEvents: () => overlayMocks.map
  }
})

import { NavDataOverlay } from '../../../src/renderer/components/NavDataOverlay'

describe('NavDataOverlay', () => {
  beforeEach(() => {
    overlayMocks.getNavMapFeatures.mockResolvedValue({
      airports: [
        {
          id: 1,
          ident: 'ZSPD',
          name: 'Shanghai Pudong',
          type: 1,
          lat: 31.1434,
          lon: 121.8052,
          longestRunwayLengthFt: 12467,
          numApproach: 4
        }
      ],
      waypoints: [
        {
          id: 2,
          ident: 'SASAN',
          type: 'ENROUTE',
          lat: 31.4,
          lon: 121.2,
          airportIdent: null
        }
      ],
      vors: [
        {
          id: 3,
          ident: 'PUD',
          type: 'VOR-DME',
          frequency: 116.9,
          lat: 31.1,
          lon: 121.7
        }
      ],
      ndbs: [
        {
          id: 4,
          ident: 'PD',
          type: 'NDB',
          frequency: 342,
          lat: 31.05,
          lon: 121.75
        }
      ],
      airways: [],
      overflow: {
        airports: false,
        waypoints: false,
        vors: false,
        ndbs: false,
        airways: false
      },
      fetchedAt: 1
    })
  })

  it('returns the exact coordinates when a navigation information point is clicked', async () => {
    const onPickPoint = vi.fn()
    const onSelectFeature = vi.fn()

    render(
      <NavDataOverlay
        layerVisibility={{
          airports: true,
          waypoints: true,
          vors: true,
          ndbs: true,
          airways: false
        }}
        onPickPoint={onPickPoint}
        onSelectFeature={onSelectFeature}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(4)
    })

    const expected = [
      ['marker-31.1434-121.8052', 'airport:1', { lat: 31.1434, lon: 121.8052 }],
      ['marker-31.4-121.2', 'waypoint:2', { lat: 31.4, lon: 121.2 }],
      ['marker-31.1-121.7', 'vor:3', { lat: 31.1, lon: 121.7 }],
      ['marker-31.05-121.75', 'ndb:4', { lat: 31.05, lon: 121.75 }]
    ] as const

    expected.forEach(([testId, featureKey, point], index) => {
      fireEvent.click(screen.getByTestId(testId))
      expect(onSelectFeature).toHaveBeenNthCalledWith(index + 1, featureKey)
      expect(onPickPoint).toHaveBeenNthCalledWith(index + 1, point)
    })
  })
})
