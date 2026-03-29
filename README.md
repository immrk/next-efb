# MSFS Desktop Tracker

An Electron + React + TypeScript desktop MVP for tracking the user aircraft in Microsoft Flight Simulator 2020 on an in-app map.

## Current status

The project is in MVP scaffold stage.

What is already in place:

- Electron desktop shell
- React renderer with TypeScript
- Chinese / English i18n
- real map view with Leaflet + OpenStreetMap
- settings persistence
- mock aircraft data provider for UI development
- `node-simconnect` integration entry in the main process
- successful `npm run typecheck`
- successful `npm run build`

What is not fully validated yet:

- end-to-end runtime verification inside a launched Electron window on this machine
- live connection verification against a running MSFS 2020 instance
- packaging / installer validation

So the answer is:

- the MVP project structure is ready and buildable
- the mock mode should be enough for normal UI development
- live SimConnect mode still needs real-machine integration testing with MSFS running

## Tech stack

- Electron
- React
- TypeScript
- electron-vite
- Zustand
- i18next / react-i18next
- Leaflet / react-leaflet
- node-simconnect

## Features in the current MVP

- desktop shell for Windows
- aircraft map panel
- aircraft status panel
- Chinese / English language switching
- provider switching between `simconnect` and `mock`
- automatic SimConnect retry logic
- local settings persistence

## Project structure

```text
docs/
  MVP.md
src/
  main/
    index.ts
    ipc/
    services/
  preload/
    index.ts
  renderer/
    App.tsx
    components/
    hooks/
    i18n/
    locales/
    store/
  shared/
    channels.ts
    types.ts
```

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app in development mode

```bash
npm run dev
```

### 3. Build the app

```bash
npm run build
```

### 4. Run type checks

```bash
npm run typecheck
```

## How to use the current MVP

### Mock mode

Use Mock mode when:

- MSFS is not running
- you want to develop UI and interactions first

In Mock mode the app simulates aircraft position, heading, speed, and altitude updates.

### SimConnect mode

Use SimConnect mode when:

- Microsoft Flight Simulator 2020 is running
- SimConnect is available to the local machine

The app currently attempts to connect through `node-simconnect` from the Electron main process.

If connection fails, the app keeps running and reports disconnected state. You can switch back to Mock mode from the settings panel.

## Map solution

The MVP currently uses:

- `Leaflet`
- `react-leaflet`
- OpenStreetMap raster tiles

Why this was chosen:

- free and open source
- simple React integration
- good enough for MVP aircraft display and follow mode
- easy to replace later with another compatible tile source

Important note:

OpenStreetMap public tiles are fine for development and light usage, but for larger-scale desktop distribution you should plan to move to a more controlled tile source or self-hosted setup.

Reference:

- [Leaflet](https://leafletjs.com/)
- [React Leaflet](https://react-leaflet.js.org/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)

## SimConnect integration notes

The project uses `node-simconnect` as the Node.js system-layer integration path.

Current live data fields planned / wired for reading:

- latitude
- longitude
- altitude
- heading
- ground speed
- on-ground state

Current implementation file:

- `src/main/services/simconnect/NodeSimConnectProvider.ts`

## Scripts

- `npm run dev` - start Electron in development mode
- `npm run build` - build main, preload, and renderer bundles
- `npm run typecheck` - run TypeScript checks for node and web targets
- `npm run preview` - preview built app

## Known limitations

- no real flight trail drawing yet
- no map provider switcher yet
- no tray workflow yet
- no packaged installer yet
- live SimConnect mode still needs verification with a running simulator

## Suggested next steps

1. Test `npm run dev` locally with MSFS closed and verify Mock mode UX.
2. Start MSFS 2020 and verify SimConnect connection and aircraft position updates.
3. Add aircraft trail drawing.
4. Add selectable map sources.
5. Add packaging with `electron-builder`.

## Document

The MVP design document is available at:

- [MVP.md](D:\develop\nextFlight\nextCilent\docs\MVP.md)
