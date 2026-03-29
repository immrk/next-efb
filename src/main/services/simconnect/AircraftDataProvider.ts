import type { AircraftState, ConnectionState } from '@shared/types'

export interface AircraftDataProvider {
  start(): void
  stop(): void
  getAircraftState(): AircraftState
  getConnectionState(): ConnectionState
  onAircraftState(listener: (state: AircraftState) => void): () => void
  onConnectionState(listener: (state: ConnectionState) => void): () => void
}
