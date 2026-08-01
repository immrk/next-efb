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
    map,
    client: null as unknown as { getNavMapFeatures: ReturnType<typeof vi.fn> }
  }
})

overlayMocks.client = { getNavMapFeatures: overlayMocks.getNavMapFeatures }

vi.mock('../../../src/renderer/client', () => ({
  getAppClient: () => overlayMocks.client
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

  it('renders current METAR inside the selected airport information card', async () => {
    render(
      <NavDataOverlay
        layerVisibility={{
          airports: true,
          waypoints: false,
          vors: false,
          ndbs: false,
          airways: false
        }}
        selectedFeatureKey="airport:1"
        airportWeather={[{
          kind: 'weather',
          id: 'weather:ZSPD',
          airportIdent: 'ZSPD',
          lat: 31.1434,
          lon: 121.8052,
          rawMetar: 'ZSPD 011000Z 12008KT 5000 BKN012 28/24 Q1007',
          flightCategory: 'MVFR',
          observedAt: Date.parse('2026-08-01T10:00:00Z'),
          windDirectionDeg: 120,
          windSpeedKts: 8,
          windGustKts: null,
          visibilitySm: 3.1,
          ceilingFt: 1200,
          qnhHpa: 1007
        }]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('ZSPD 011000Z 12008KT 5000 BKN012 28/24 Q1007')).toBeInTheDocument()
    })
    expect(screen.queryByText('MVFR')).not.toBeInTheDocument()
    expect(screen.getByText('120° 8 kt')).toBeInTheDocument()
    expect(screen.getByText('1,200 ft')).toBeInTheDocument()
  })

  it('limits markers and spatially thins labels in a dense airport viewport', async () => {
    const airports = Array.from({ length: 250 }, (_, index) => ({
      id: index + 1,
      ident: `K${String(index).padStart(3, '0')}`,
      name: `Dense airport ${index}`,
      type: 1,
      lat: 30.05 + (index % 20) * 0.095,
      lon: 120.05 + Math.floor(index / 20) * 0.145,
      longestRunwayLengthFt: 12_000 - index,
      numApproach: 4
    }))
    overlayMocks.getNavMapFeatures.mockResolvedValueOnce({
      airports,
      waypoints: [],
      vors: [],
      ndbs: [],
      airways: [],
      overflow: { airports: false, waypoints: false, vors: false, ndbs: false, airways: false },
      fetchedAt: 1
    })

    render(
      <NavDataOverlay
        layerVisibility={{
          airports: true,
          waypoints: false,
          vors: false,
          ndbs: false,
          airways: false
        }}
      />
    )

    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(160))
    expect(screen.queryAllByText(/^K\d{3}$/).length).toBeLessThanOrEqual(52)
  })
})
