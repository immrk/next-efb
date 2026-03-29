import type { AircraftDataProvider } from './AircraftDataProvider'
import type { AircraftState, ConnectionState } from '@shared/types'

export class MockAircraftProvider implements AircraftDataProvider {
  private aircraftState: AircraftState = {
    connected: true,
    source: 'mock',
    lat: 31.2304,
    lon: 121.4737,
    altitudeFt: 3200,
    headingDeg: 90,
    groundSpeedKts: 120,
    onGround: false,
    updatedAt: Date.now()
  }

  private connectionState: ConnectionState = {
    connected: true,
    source: 'mock',
    messageCode: 'MOCK_READY',
    updatedAt: Date.now()
  }

  private timer: NodeJS.Timeout | null = null
  private readonly aircraftListeners = new Set<(state: AircraftState) => void>()
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>()

  start(): void {
    this.emitConnection()
    if (this.timer) return

    this.timer = setInterval(() => {
      const nextHeading = (this.aircraftState.headingDeg + 4) % 360
      const radians = (nextHeading * Math.PI) / 180
      this.aircraftState = {
        ...this.aircraftState,
        lat: this.aircraftState.lat + Math.sin(radians) * 0.02,
        lon: this.aircraftState.lon + Math.cos(radians) * 0.02,
        altitudeFt: 3000 + Math.sin(Date.now() / 2000) * 600,
        headingDeg: nextHeading,
        groundSpeedKts: 118 + Math.cos(Date.now() / 1500) * 6,
        updatedAt: Date.now()
      }
      this.emitAircraft()
    }, 500)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getAircraftState(): AircraftState {
    return this.aircraftState
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  onAircraftState(listener: (state: AircraftState) => void): () => void {
    this.aircraftListeners.add(listener)
    listener(this.aircraftState)
    return () => this.aircraftListeners.delete(listener)
  }

  onConnectionState(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener)
    listener(this.connectionState)
    return () => this.connectionListeners.delete(listener)
  }

  private emitAircraft(): void {
    for (const listener of this.aircraftListeners) {
      listener(this.aircraftState)
    }
  }

  private emitConnection(): void {
    for (const listener of this.connectionListeners) {
      listener(this.connectionState)
    }
  }
}
