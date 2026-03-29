import type { AircraftState, ConnectionState } from '@shared/types'

export class FlightStateStore {
  private aircraftState: AircraftState = {
    connected: false,
    source: 'mock',
    lat: 31.2304,
    lon: 121.4737,
    altitudeFt: 0,
    headingDeg: 0,
    groundSpeedKts: 0,
    onGround: true,
    updatedAt: Date.now()
  }

  private connectionState: ConnectionState = {
    connected: false,
    source: 'mock',
    messageCode: 'CONNECTING',
    updatedAt: Date.now()
  }

  getAircraftState(): AircraftState {
    return this.aircraftState
  }

  setAircraftState(next: AircraftState): void {
    this.aircraftState = next
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  setConnectionState(next: ConnectionState): void {
    this.connectionState = next
  }
}
