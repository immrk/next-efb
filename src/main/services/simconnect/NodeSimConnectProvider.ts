import {
  open,
  Protocol,
  readLatLonAlt,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod,
  type ConnectionHandle
} from 'node-simconnect'
import type { AircraftState, ConnectionState } from '@shared/types'
import type { AircraftDataProvider } from './AircraftDataProvider'

const enum DefinitionId {
  LiveData = 1
}

const enum RequestId {
  LiveData = 1
}

const RETRY_MS = 5000

export class NodeSimConnectProvider implements AircraftDataProvider {
  private aircraftState: AircraftState = {
    connected: false,
    source: 'simconnect',
    lat: 0,
    lon: 0,
    altitudeFt: 0,
    headingDeg: 0,
    groundSpeedKts: 0,
    onGround: true,
    updatedAt: Date.now()
  }

  private connectionState: ConnectionState = {
    connected: false,
    source: 'simconnect',
    messageCode: 'CONNECTING',
    updatedAt: Date.now()
  }

  private handle: ConnectionHandle | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private started = false
  private readonly aircraftListeners = new Set<(state: AircraftState) => void>()
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>()

  start(): void {
    this.started = true
    void this.connect()
  }

  stop(): void {
    this.started = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.handle) {
      this.detachHandleListeners(this.handle)
      this.handle.close()
      this.handle = null
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

  private async connect(): Promise<void> {
    this.updateConnection({
      connected: false,
      source: 'simconnect',
      messageCode: 'CONNECTING',
      updatedAt: Date.now()
    })

    try {
      const { handle } = await open('MSFS Desktop Tracker', Protocol.KittyHawk)
      if (!this.started) {
        handle.close()
        return
      }

      this.handle = handle
      this.attachListeners(handle)
      this.registerDataDefinition(handle)
      this.requestLiveData(handle)
      this.updateConnection({
        connected: true,
        source: 'simconnect',
        messageCode: 'READY',
        updatedAt: Date.now()
      })
    } catch {
      this.markDisconnectedAndRetry()
    }
  }

  private attachListeners(handle: ConnectionHandle): void {
    handle.on('simObjectData', (payload) => {
      if (payload.requestID !== RequestId.LiveData) return

      const position = readLatLonAlt(payload.data)
      const heading = payload.data.readFloat64()
      const speed = payload.data.readFloat64()
      const onGround = payload.data.readInt32() === 1

      this.updateAircraft({
        connected: true,
        source: 'simconnect',
        lat: position.latitude,
        lon: position.longitude,
        altitudeFt: position.altitude,
        headingDeg: heading,
        groundSpeedKts: speed,
        onGround,
        updatedAt: Date.now()
      })
    })

    handle.on('quit', () => {
      this.markDisconnectedAndRetry()
    })

    handle.on('close', () => {
      this.markDisconnectedAndRetry()
    })

    handle.on('error', () => {
      this.markDisconnectedAndRetry()
    })
  }

  private registerDataDefinition(handle: ConnectionHandle): void {
    handle.addToDataDefinition(
      DefinitionId.LiveData,
      'STRUCT LATLONALT',
      null,
      SimConnectDataType.LATLONALT
    )
    handle.addToDataDefinition(
      DefinitionId.LiveData,
      'PLANE HEADING DEGREES TRUE',
      'degrees',
      SimConnectDataType.FLOAT64
    )
    handle.addToDataDefinition(
      DefinitionId.LiveData,
      'GROUND VELOCITY',
      'knots',
      SimConnectDataType.FLOAT64
    )
    handle.addToDataDefinition(
      DefinitionId.LiveData,
      'SIM ON GROUND',
      'bool',
      SimConnectDataType.INT32
    )
  }

  private requestLiveData(handle: ConnectionHandle): void {
    handle.requestDataOnSimObject(
      RequestId.LiveData,
      DefinitionId.LiveData,
      SimConnectConstants.OBJECT_ID_USER,
      SimConnectPeriod.SECOND
    )
  }

  private markDisconnectedAndRetry(): void {
    if (this.handle) {
      this.detachHandleListeners(this.handle)
      this.handle.close()
      this.handle = null
    }

    this.updateConnection({
      connected: false,
      source: 'simconnect',
      messageCode: 'SIM_NOT_CONNECTED',
      updatedAt: Date.now()
    })

    this.updateAircraft({
      ...this.aircraftState,
      connected: false,
      source: 'simconnect',
      updatedAt: Date.now()
    })

    if (!this.started || this.reconnectTimer) {
      return
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, RETRY_MS)
  }

  private updateAircraft(state: AircraftState): void {
    this.aircraftState = state
    for (const listener of this.aircraftListeners) {
      listener(state)
    }
  }

  private updateConnection(state: ConnectionState): void {
    this.connectionState = state
    for (const listener of this.connectionListeners) {
      listener(state)
    }
  }

  private detachHandleListeners(handle: ConnectionHandle): void {
    handle.removeAllListeners('simObjectData')
    handle.removeAllListeners('quit')
    handle.removeAllListeners('close')
    handle.removeAllListeners('error')
  }
}
