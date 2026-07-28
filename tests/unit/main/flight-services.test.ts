import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSettings } from '../../helpers/factories'
import { FlightStateStore } from '../../../src/main/services/state/FlightStateStore'
import { MockAircraftProvider } from '../../../src/main/services/simconnect/MockAircraftProvider'
import { SimConnectService } from '../../../src/main/services/simconnect/SimConnectService'

describe('aircraft state services', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('streams deterministic mock aircraft and connection updates', () => {
    const provider = new MockAircraftProvider()
    const aircraftListener = vi.fn()
    const connectionListener = vi.fn()
    const offAircraft = provider.onAircraftState(aircraftListener)
    const offConnection = provider.onConnectionState(connectionListener)

    expect(aircraftListener).toHaveBeenCalledOnce()
    expect(connectionListener).toHaveBeenCalledWith(
      expect.objectContaining({ connected: true, messageCode: 'MOCK_READY' })
    )

    provider.start()
    provider.start()
    vi.advanceTimersByTime(500)

    expect(aircraftListener).toHaveBeenCalledTimes(2)
    expect(provider.getAircraftState()).toMatchObject({
      connected: true,
      source: 'mock',
      headingDeg: 94
    })

    offAircraft()
    offConnection()
    provider.stop()
    vi.advanceTimersByTime(1_000)
    expect(aircraftListener).toHaveBeenCalledTimes(2)
  })

  it('stores the latest aircraft and connection snapshots', () => {
    const store = new FlightStateStore()
    expect(store.getAircraftState().connected).toBe(false)
    expect(store.getConnectionState().messageCode).toBe('CONNECTING')

    const aircraft = {
      ...store.getAircraftState(),
      connected: true,
      altitudeFt: 12_000
    }
    const connection = {
      ...store.getConnectionState(),
      connected: true,
      messageCode: 'READY' as const
    }

    store.setAircraftState(aircraft)
    store.setConnectionState(connection)
    expect(store.getAircraftState()).toBe(aircraft)
    expect(store.getConnectionState()).toBe(connection)
  })

  it('binds, starts, stops and reconfigures the selected provider', () => {
    const service = new SimConnectService(createSettings({ providerMode: 'mock' }))
    const aircraftListener = vi.fn()
    const connectionListener = vi.fn()
    const offAircraft = service.onAircraftState(aircraftListener)
    const offConnection = service.onConnectionState(connectionListener)

    expect(service.getProvider()).toBeInstanceOf(MockAircraftProvider)
    service.start()
    vi.advanceTimersByTime(500)
    expect(aircraftListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ headingDeg: 94, source: 'mock' })
    )

    const firstProvider = service.getProvider()
    service.reconfigure(createSettings({ providerMode: 'mock' }))
    expect(service.getProvider()).not.toBe(firstProvider)
    expect(connectionListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ messageCode: 'MOCK_READY' })
    )

    offAircraft()
    offConnection()
    service.stop()
  })
})
