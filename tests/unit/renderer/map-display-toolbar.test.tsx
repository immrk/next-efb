import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const toolbarMocks = vi.hoisted(() => {
  const searchNavMapPoints = vi.fn()
  const searchVatsimPilots = vi.fn()
  const updateSettings = vi.fn()
  return {
    searchNavMapPoints,
    searchVatsimPilots,
    updateSettings,
    setSettings: vi.fn(),
    client: { searchNavMapPoints, searchVatsimPilots, updateSettings }
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key
  })
}))

vi.mock('../../../src/renderer/client', () => ({
  getAppClient: () => toolbarMocks.client
}))

vi.mock('../../../src/renderer/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector({
    settings: { mapTileProvider: 'cartoLight' },
    setSettings: toolbarMocks.setSettings
  })
}))

vi.mock('../../../src/renderer/components/VatsimLayerControl', () => ({
  VatsimLayerControl: () => null
}))

vi.mock('../../../src/renderer/components/ui/select', async () => {
  const React = await import('react')
  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  return {
    Select: Wrapper,
    SelectContent: Wrapper,
    SelectItem: Wrapper,
    SelectTrigger: Wrapper
  }
})

import { MapDisplayToolbar } from '../../../src/renderer/components/MapDisplayToolbar'

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
    route: null,
    remarks: null
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

describe('MapDisplayToolbar', () => {
  it('searches and selects online pilots even when navigation layers are disabled', async () => {
    toolbarMocks.searchVatsimPilots.mockResolvedValue([pilot])
    toolbarMocks.searchNavMapPoints.mockResolvedValue([])
    const onSearchSelect = vi.fn()

    render(
      <MapDisplayToolbar
        navLayerVisibility={{ airports: false, airways: false, vors: false, ndbs: false, waypoints: false }}
        onToggleLayer={vi.fn()}
        vatsimLayerVisibility={{
          pilots: false,
          controllers: false,
          controllerCoverage: false,
          atis: false,
          weather: true,
          labels: true
        }}
        vatsimStatus={status}
        onToggleVatsimLayer={vi.fn()}
        onVatsimStatusChange={vi.fn()}
        onSearchSelect={onSearchSelect}
      />
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'DAL' } })
    await waitFor(() => expect(toolbarMocks.searchVatsimPilots).toHaveBeenCalledWith({
      query: 'DAL',
      limit: 12
    }))
    expect(await screen.findByText('DAL1')).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()

    fireEvent.click(screen.getByText('DAL1').closest('button')!)
    expect(onSearchSelect).toHaveBeenCalledWith(expect.objectContaining({
      type: 'pilots',
      ident: 'DAL1',
      pilot
    }))
  })
})
