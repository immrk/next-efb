import type { ChartRecord, GeoReferencePoint } from '@shared/chart-types'
import type { ChecklistRecord } from '@shared/checklist-types'
import type {
  AircraftState,
  AppSettings,
  ConnectionState
} from '@shared/types'

export function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  const base: AppSettings = {
    language: 'en-US',
    followAircraft: true,
    refreshIntervalMs: 500,
    providerMode: 'mock',
    mapTileProvider: 'osm',
    chartOpacity: 100,
    storage: { chartLibraryPath: null },
    navData: { sqlitePath: null, autoDetect: false },
    simbrief: { username: '', userId: '' },
    lanAccess: {
      enabled: false,
      port: 31831,
      authEnabled: false,
      authToken: 'test-token',
      allowWrite: true
    }
  }

  return {
    ...base,
    ...overrides,
    storage: { ...base.storage, ...overrides.storage },
    navData: { ...base.navData, ...overrides.navData },
    simbrief: { ...base.simbrief, ...overrides.simbrief },
    lanAccess: { ...base.lanAccess, ...overrides.lanAccess }
  }
}

export function createAircraft(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    connected: true,
    source: 'mock',
    lat: 31.2,
    lon: 121.5,
    altitudeFt: 3200,
    headingDeg: 90,
    groundSpeedKts: 120,
    onGround: false,
    updatedAt: 1_700_000_000_000,
    ...overrides
  }
}

export function createConnection(overrides: Partial<ConnectionState> = {}): ConnectionState {
  return {
    connected: true,
    source: 'mock',
    messageCode: 'MOCK_READY',
    updatedAt: 1_700_000_000_000,
    ...overrides
  }
}

export function createChart(overrides: Partial<ChartRecord> = {}): ChartRecord {
  return {
    id: 'chart-1',
    title: 'ILS 36',
    airportCode: 'ZBAA',
    chartType: 'approach',
    titleMode: 'manual',
    boundRunwayNames: ['36'],
    boundApproachProcedureIds: ['approach:1'],
    sourceFilePath: 'C:\\charts\\chart-1\\source.png',
    previewImagePath: 'C:\\charts\\chart-1\\display.png',
    fileFormat: 'png',
    width: 1000,
    height: 800,
    isGeoreferenced: true,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides
  }
}

export function createReferencePoints(chartId = 'chart-1'): GeoReferencePoint[] {
  return [
    {
      id: 'point-1',
      chartId,
      index: 1,
      mapLat: 30,
      mapLon: 120,
      chartX: 100,
      chartY: 200
    },
    {
      id: 'point-2',
      chartId,
      index: 2,
      mapLat: 30,
      mapLon: 121,
      chartX: 300,
      chartY: 200
    }
  ]
}

export function createChecklist(
  overrides: Partial<ChecklistRecord> = {}
): ChecklistRecord {
  return {
    id: 'checklist-1',
    title: 'Normal Procedures',
    aircraftModel: 'A320',
    sourceFilePath: 'C:\\checklists\\checklist-1\\source.pdf',
    fileFormat: 'pdf',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides
  }
}
