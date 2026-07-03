# NextEFB MVP

## 1. Goal

Build a Windows desktop MVP for Microsoft Flight Simulator 2020 that:

- connects to MSFS through SimConnect from the Electron main process
- reads the user aircraft position and basic flight state
- displays the aircraft on an in-app map
- supports Chinese and English UI

This MVP uses:

- Electron
- Vue 3
- TypeScript
- Node.js system layer
- vue-i18n

## 2. Scope

Included in MVP:

- Windows desktop shell
- automatic MSFS connection attempt
- aircraft state model
- map page with aircraft marker
- flight status panel
- language switching between `zh-CN` and `en-US`
- local settings persistence
- tray support placeholder
- simulated data provider for development before SimConnect is wired

Not included in MVP:

- multi-aircraft traffic
- flight replay
- GPX/GeoJSON export
- online sync
- advanced avionics data

## 3. Architecture

### 3.1 Processes

1. Electron main process
   - application lifecycle
   - SimConnect integration
   - settings persistence
   - IPC event publishing

2. Preload bridge
   - exposes a safe API to the renderer

3. Renderer process
   - Vue 3 + Element Plus UI
   - map visualization
   - internationalization
   - connection and aircraft status

### 3.2 Data Flow

1. App starts
2. Main process loads settings
3. Main process starts the aircraft data service
4. Data service emits aircraft state updates
5. Main process forwards updates to renderer over IPC
6. Renderer updates map, status cards, and labels

## 4. Modules

### 4.1 Main process

- `SimConnectService`
  - open / close connection
  - subscribe to aircraft state
  - emit normalized domain objects
- `FlightStateStore`
  - keep latest aircraft state in memory
- `SettingsStore`
  - persist language, follow mode, refresh interval, and provider mode
- `ipc`
  - expose settings getters/setters
  - expose aircraft state subscription

### 4.2 Renderer

- `AppShell`
- `MapPanel`
- `StatusPanel`
- `SettingsPanel`
- `i18n`
- `aircraft store`

## 5. Domain model

```ts
export type AppLanguage = 'zh-CN' | 'en-US'

export interface AircraftState {
  connected: boolean
  source: 'mock' | 'simconnect'
  lat: number
  lon: number
  altitudeFt: number
  headingDeg: number
  groundSpeedKts: number
  onGround: boolean
  updatedAt: number
}
```

## 6. SimConnect integration plan

Phase 1:

- build the app around a mock provider
- define the service interface used by UI and main process

Phase 2:

- integrate a Node SimConnect library
- register data definitions:
  - `Plane Latitude`
  - `Plane Longitude`
  - `Plane Altitude`
  - `Plane Heading Degrees True`
  - `Ground Velocity`
  - `Sim On Ground`
- map raw values into `AircraftState`

## 7. i18n strategy

- all UI strings live in locale JSON files
- business and system layers return structured state or error codes, not localized text
- default language follows saved settings first, then system locale

## 8. MVP screens

1. Main dashboard
   - app title
   - connection badge
   - map area
   - current aircraft status
   - settings panel

## 9. Milestones

1. Create project skeleton
2. Implement mock aircraft stream
3. Implement renderer UI and i18n
4. Add settings persistence
5. Replace mock service with SimConnect service
6. Add packaging and installer validation

## 10. Acceptance criteria

- app launches as Electron desktop app
- Vue renderer loads successfully
- user can switch between Chinese and English
- renderer receives aircraft updates from main process
- map panel reflects aircraft position updates
- code structure allows replacing mock provider with SimConnect provider without renderer rewrites
