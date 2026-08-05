import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const vatsimClientMocks = vi.hoisted(() => ({
  refreshVatsim: vi.fn()
}))

vi.mock('../../../src/renderer/client', () => ({
  getAppClient: () => ({ refreshVatsim: vatsimClientMocks.refreshVatsim })
}))

import { VatsimLayerControl } from '../../../src/renderer/components/VatsimLayerControl'
import { DEFAULT_VATSIM_LAYER_VISIBILITY } from '../../../src/renderer/hooks/usePersistentVatsimDisplaySettings'

const status = {
  phase: 'ready' as const,
  revision: 2,
  fetchedAt: 1,
  feedUpdatedAt: 1,
  nextRefreshAt: 2,
  lastError: null,
  counts: { pilots: 1024, controllers: 105, atis: 78, connectedClients: 1210 }
}

describe('VatsimLayerControl', () => {
  beforeEach(() => {
    vatsimClientMocks.refreshVatsim.mockResolvedValue(status)
  })

  it('keeps controller coverage disabled by default', () => {
    expect(DEFAULT_VATSIM_LAYER_VISIBILITY.controllerCoverage).toBe(false)
  })

  it('opens the compact layer menu, toggles layers and refreshes status', async () => {
    const onToggleLayer = vi.fn()
    const onStatusChange = vi.fn()
    const { container } = render(
      <VatsimLayerControl
        layerVisibility={{
          pilots: true,
          controllers: true,
          controllerCoverage: true,
          atis: true,
          weather: true,
          labels: true
        }}
        status={status}
        onToggleLayer={onToggleLayer}
        onStatusChange={onStatusChange}
      />
    )

    const liveButton = screen.getByText('LIVE').closest('button')
    expect(liveButton).not.toBeNull()
    fireEvent.click(liveButton!)

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(5)
    fireEvent.click(switches[0])
    expect(onToggleLayer).toHaveBeenCalledWith('pilots')

    const refreshButton = container.querySelector<HTMLButtonElement>('.vatsim-refresh-button')
    expect(refreshButton).not.toBeNull()
    fireEvent.click(refreshButton!)
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(status))
  })
})
