import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const vatsimOverlayMocks = vi.hoisted(() => {
  const getVatsimMapFeatures = vi.fn()
  const getVatsimStatus = vi.fn()
  const onVatsimChanged = vi.fn(() => vi.fn())
  const map = {
    getBounds: () => ({
      getNorth: () => 42,
      getSouth: () => 39,
      getEast: () => -72,
      getWest: () => -76
    }),
    getZoom: () => 8,
    flyTo: vi.fn()
  }
  return {
    map,
    getVatsimMapFeatures,
    getVatsimStatus,
    onVatsimChanged,
    client: {
      getVatsimMapFeatures,
      getVatsimStatus,
      onVatsimChanged
    }
  }
})

vi.mock('leaflet', () => ({
  divIcon: (options: unknown) => ({ options })
}))

vi.mock('../../../src/renderer/client', () => ({
  getAppClient: () => vatsimOverlayMocks.client
}))

vi.mock('react-leaflet', async () => {
  const React = await import('react')
  return {
    Circle: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    CircleMarker: ({ children }: { children?: React.ReactNode }) => React.createElement('i', null, children),
    Marker: ({ children, icon }: { children?: React.ReactNode; icon: { options: { html: string } } }) =>
      React.createElement('button', { 'data-icon-html': icon.options.html }, children),
    Tooltip: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
    useMap: () => vatsimOverlayMocks.map,
    useMapEvents: () => vatsimOverlayMocks.map
  }
})

import { VatsimOverlay } from '../../../src/renderer/components/VatsimOverlay'

const pilot = {
  kind: 'pilot' as const,
  id: '1001:DAL1',
  callsign: 'DAL1',
  name: 'John Pilot',
  lat: 40.7,
  lon: -73.8,
  altitudeFt: 12000,
  groundSpeedKts: 420,
  headingDeg: 83,
  transponder: '3456',
  onGround: false,
  flightPlan: {
    flightRules: 'I',
    aircraft: 'B764/H',
    departure: 'KJFK',
    arrival: 'EGLL',
    alternate: null,
    cruiseAltitude: '35000',
    route: 'GREKI DCT JUDDS'
  },
  logonTime: null,
  lastUpdated: null
}

const status = {
  phase: 'ready' as const,
  revision: 1,
  fetchedAt: 1,
  feedUpdatedAt: 1,
  nextRefreshAt: 2,
  lastError: null,
  counts: { pilots: 1, controllers: 0, atis: 0, connectedClients: 1 }
}

const layerVisibility = {
  pilots: true,
  controllers: false,
  controllerCoverage: false,
  atis: false,
  weather: true,
  labels: true
}

describe('VatsimOverlay', () => {
  beforeEach(() => {
    vatsimOverlayMocks.getVatsimStatus.mockResolvedValue(status)
    vatsimOverlayMocks.getVatsimMapFeatures.mockResolvedValue({
      pilots: [pilot],
      pilotClusters: [],
      controllers: [],
      atis: [],
      weather: [],
      overflow: { pilots: false, controllers: false, atis: false, weather: false },
      status,
      fetchedAt: 1
    })
  })

  it('uses a simple plane icon and shows its callsign card only after selection', async () => {
    const onSelectFeature = vi.fn()
    const onStatusChange = vi.fn()
    const onWeatherChange = vi.fn()
    const { rerender } = render(
      <VatsimOverlay
        layerVisibility={layerVisibility}
        selectedFeature={null}
        airportWeatherEnabled
        onSelectFeature={onSelectFeature}
        onStatusChange={onStatusChange}
        onWeatherChange={onWeatherChange}
      />
    )

    const marker = await screen.findByRole('button')
    expect(marker.getAttribute('data-icon-html')).toContain('<svg')
    expect(marker.getAttribute('data-icon-html')).toContain('rotate(38deg)')
    expect(screen.queryByText('DAL1')).not.toBeInTheDocument()

    rerender(
      <VatsimOverlay
        layerVisibility={layerVisibility}
        selectedFeature={pilot}
        airportWeatherEnabled
        onSelectFeature={onSelectFeature}
        onStatusChange={onStatusChange}
        onWeatherChange={onWeatherChange}
      />
    )

    expect(screen.getByText('DAL1')).toBeInTheDocument()
  })
})
