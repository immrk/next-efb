import type { AppSettings } from '@shared/types'
import type { AircraftDataProvider } from './AircraftDataProvider'
import type { AircraftState, ConnectionState } from '@shared/types'
import { MockAircraftProvider } from './MockAircraftProvider'
import { NodeSimConnectProvider } from './NodeSimConnectProvider'

export class SimConnectService {
  private provider: AircraftDataProvider
  private readonly aircraftListeners = new Set<(state: AircraftState) => void>()
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>()
  private unsubscribeAircraft: (() => void) | null = null
  private unsubscribeConnection: (() => void) | null = null

  constructor(settings: AppSettings) {
    this.provider = this.createProvider(settings)
    this.bindProvider()
  }

  start(): void {
    this.provider.start()
  }

  stop(): void {
    this.provider.stop()
  }

  getProvider(): AircraftDataProvider {
    return this.provider
  }

  onAircraftState(listener: (state: AircraftState) => void): () => void {
    this.aircraftListeners.add(listener)
    listener(this.provider.getAircraftState())
    return () => this.aircraftListeners.delete(listener)
  }

  onConnectionState(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener)
    listener(this.provider.getConnectionState())
    return () => this.connectionListeners.delete(listener)
  }

  reconfigure(settings: AppSettings): void {
    this.unsubscribeAircraft?.()
    this.unsubscribeConnection?.()
    this.provider.stop()
    this.provider = this.createProvider(settings)
    this.bindProvider()
    this.provider.start()
  }

  private createProvider(_settings: AppSettings): AircraftDataProvider {
    if (!import.meta.env.DEV || _settings.providerMode === 'simconnect') {
      return new NodeSimConnectProvider()
    }

    return new MockAircraftProvider()
  }

  private bindProvider(): void {
    this.unsubscribeAircraft = this.provider.onAircraftState((state) => {
      for (const listener of this.aircraftListeners) {
        listener(state)
      }
    })

    this.unsubscribeConnection = this.provider.onConnectionState((state) => {
      for (const listener of this.connectionListeners) {
        listener(state)
      }
    })
  }
}
