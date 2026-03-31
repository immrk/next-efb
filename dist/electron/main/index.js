"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_crypto = require("node:crypto");
const node_fs = require("node:fs");
const nodeSimconnect = require("node-simconnect");
const Database = require("better-sqlite3");
const node_http = require("node:http");
const node_os = require("node:os");
const ws = require("ws");
const IPC_CHANNELS = {
  aircraftSnapshot: "aircraft:snapshot",
  aircraftUpdate: "aircraft:update",
  chartAsset: "chart:asset",
  chartDelete: "chart:delete",
  chartFinalizeImport: "chart:finalize-import",
  chartGet: "chart:get",
  chartImport: "chart:pick-file",
  chartReferenceGet: "chart:reference:get",
  chartReferenceSave: "chart:reference:save",
  chartUpdate: "chart:update",
  chartsList: "charts:list",
  storageSummary: "storage:summary",
  connectionUpdate: "connection:update",
  settingsGet: "settings:get",
  settingsUpdate: "settings:update",
  navDataStatus: "nav-data:status",
  navDataPickSqlite: "nav-data:pick-sqlite",
  navAirportsSearch: "nav-data:airports:search",
  navAirportProcedures: "nav-data:airport:procedures",
  navBuildPlan: "nav-data:plan:build",
  simbriefImport: "simbrief:import",
  remoteAccessStatus: "remote-access:status",
  openExternal: "system:open-external"
};
function registerIpc(options) {
  const {
    mainWindow: mainWindow2,
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService,
    lanServer,
    navDataService
  } = options;
  simConnectService.onAircraftState((state) => {
    flightStateStore.setAircraftState(state);
    lanServer.broadcastAircraftState(state);
    mainWindow2.webContents.send(IPC_CHANNELS.aircraftUpdate, state);
  });
  simConnectService.onConnectionState((state) => {
    flightStateStore.setConnectionState(state);
    lanServer.broadcastConnectionState(state);
    mainWindow2.webContents.send(IPC_CHANNELS.connectionUpdate, state);
  });
  electron.ipcMain.handle(IPC_CHANNELS.aircraftSnapshot, () => {
    return {
      aircraft: flightStateStore.getAircraftState(),
      connection: flightStateStore.getConnectionState()
    };
  });
  electron.ipcMain.handle(IPC_CHANNELS.settingsGet, () => settingsStore.get());
  electron.ipcMain.handle(IPC_CHANNELS.navDataStatus, () => navDataService.getStatus(settingsStore.get()));
  electron.ipcMain.handle(IPC_CHANNELS.navDataPickSqlite, async () => {
    const result = await electron.dialog.showOpenDialog(mainWindow2, {
      properties: ["openFile"],
      filters: [{ name: "SQLite Database", extensions: ["sqlite", "db"] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.navAirportsSearch,
    (_event, query) => navDataService.searchAirports(settingsStore.get(), query)
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.navAirportProcedures,
    (_event, airportIdent) => navDataService.getAirportProcedures(settingsStore.get(), airportIdent)
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.navBuildPlan,
    (_event, input) => navDataService.buildFlightPlan(settingsStore.get(), input)
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.simbriefImport,
    async (_event, input) => navDataService.importFromSimBrief({
      username: input.username ?? settingsStore.get().simbrief.username,
      userId: input.userId ?? settingsStore.get().simbrief.userId
    })
  );
  electron.ipcMain.handle(IPC_CHANNELS.remoteAccessStatus, () => lanServer.getStatus());
  electron.ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url) => {
    await electron.shell.openExternal(url);
    return true;
  });
  electron.ipcMain.handle(IPC_CHANNELS.chartsList, () => chartRepository.listCharts());
  electron.ipcMain.handle(IPC_CHANNELS.storageSummary, () => storageService.getSummary());
  electron.ipcMain.handle(IPC_CHANNELS.chartGet, (_event, chartId) => chartRepository.getChart(chartId));
  electron.ipcMain.handle(
    IPC_CHANNELS.chartReferenceGet,
    (_event, chartId) => chartRepository.listReferencePoints(chartId)
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.chartReferenceSave,
    (_event, chartId, points) => {
      const saved = chartRepository.saveReferencePoints(chartId, points);
      lanServer.broadcastChartChanged();
      return saved;
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.chartUpdate, (_event, input) => {
    const updated = chartRepository.updateChart(input);
    lanServer.broadcastChartChanged();
    return updated;
  });
  electron.ipcMain.handle(IPC_CHANNELS.chartAsset, (_event, chartId) => {
    const chart = chartRepository.getChart(chartId);
    if (!chart) return null;
    const displayPath = chart.previewImagePath ?? chart.sourceFilePath;
    return {
      chartId,
      fileFormat: chart.fileFormat,
      mimeType: getMimeType(chart),
      base64: storageService.readFileBase64(displayPath),
      filePath: displayPath
    };
  });
  electron.ipcMain.handle(IPC_CHANNELS.chartImport, async () => {
    const result = await electron.dialog.showOpenDialog(mainWindow2, {
      properties: ["openFile"],
      filters: [
        { name: "Charts", extensions: ["pdf", "png", "jpg", "jpeg"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const sourcePath = result.filePaths[0];
    const fileFormat = getFileFormat$1(sourcePath);
    return {
      sourcePath,
      fileName: sourcePath.split(/[/\\]/).pop() ?? "chart",
      fileFormat,
      mimeType: getMimeTypeByFormat$1(fileFormat),
      base64: storageService.readFileBase64(sourcePath)
    };
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.chartFinalizeImport,
    (_event, input) => {
      const chartId = node_crypto.randomUUID();
      const imported = input.sourcePath ? storageService.importChartFile(input.sourcePath, chartId) : input.sourceFileBase64 && input.sourceFileFormat ? storageService.writeChartSourceFile(chartId, input.sourceFileFormat, input.sourceFileBase64) : null;
      if (!imported) {
        throw new Error("CHART_SOURCE_REQUIRED");
      }
      getFileFormat$1(imported.destinationPath);
      const displayPath = input.displayImageBase64 && input.displayImageMimeType ? storageService.writeChartDisplayImage(
        chartId,
        input.displayImageMimeType,
        input.displayImageBase64
      ) : imported.destinationPath;
      const displayFormat = getFileFormat$1(displayPath);
      const now = Date.now();
      const chart = {
        id: chartId,
        title: input.title,
        airportCode: null,
        chartType: "general",
        sourceFilePath: imported.destinationPath,
        previewImagePath: displayPath,
        fileFormat: displayFormat,
        width: null,
        height: null,
        isGeoreferenced: false,
        createdAt: now,
        updatedAt: now
      };
      return {
        chart: (() => {
          const created = chartRepository.createChart(chart);
          lanServer.broadcastChartChanged();
          return created;
        })()
      };
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.chartDelete, (_event, chartId) => {
    chartRepository.deleteChart(chartId);
    storageService.deleteChartFiles(chartId);
    lanServer.broadcastChartChanged();
    return true;
  });
  electron.ipcMain.handle(IPC_CHANNELS.settingsUpdate, async (_event, partial) => {
    const nextSettings = settingsStore.update(partial);
    simConnectService.reconfigure(nextSettings);
    await lanServer.reconfigure(nextSettings);
    lanServer.broadcastSettingsChanged();
    return nextSettings;
  });
}
function getFileFormat$1(filePath) {
  const ext = filePath.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "jpg") return "jpg";
  if (ext === "jpeg") return "jpeg";
  return "png";
}
function getMimeType(chart) {
  return getMimeTypeByFormat$1(chart.fileFormat);
}
function getMimeTypeByFormat$1(fileFormat) {
  switch (fileFormat) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
    default:
      return "image/png";
  }
}
class FlightStateStore {
  constructor() {
    this.aircraftState = {
      connected: false,
      source: "mock",
      lat: 31.2304,
      lon: 121.4737,
      altitudeFt: 0,
      headingDeg: 0,
      groundSpeedKts: 0,
      onGround: true,
      updatedAt: Date.now()
    };
    this.connectionState = {
      connected: false,
      source: "mock",
      messageCode: "CONNECTING",
      updatedAt: Date.now()
    };
  }
  getAircraftState() {
    return this.aircraftState;
  }
  setAircraftState(next) {
    this.aircraftState = next;
  }
  getConnectionState() {
    return this.connectionState;
  }
  setConnectionState(next) {
    this.connectionState = next;
  }
}
function resolveInstallRoot() {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim();
  if (portableDir) {
    return portableDir;
  }
  return electron.app.isPackaged ? node_path.dirname(process.execPath) : process.cwd();
}
function ensureDataRootDir() {
  const dataRoot = node_path.join(resolveInstallRoot(), "data");
  node_fs.mkdirSync(dataRoot, { recursive: true });
  return dataRoot;
}
const DEFAULT_SETTINGS = {
  language: "zh-CN",
  followAircraft: true,
  refreshIntervalMs: 500,
  providerMode: "simconnect",
  mapTileProvider: "osm",
  navData: {
    sqlitePath: null,
    autoDetect: true
  },
  simbrief: {
    username: "",
    userId: ""
  },
  lanAccess: {
    enabled: false,
    port: 31831,
    authEnabled: false,
    authToken: createAuthToken(),
    allowWrite: true
  }
};
class SettingsStore {
  constructor() {
    this.settings = DEFAULT_SETTINGS;
    const baseDir = ensureDataRootDir();
    node_fs.mkdirSync(baseDir, { recursive: true });
    this.filePath = node_path.join(baseDir, "settings.json");
    this.settings = this.load();
  }
  get() {
    return this.settings;
  }
  update(partial) {
    this.settings = {
      ...this.settings,
      ...partial,
      navData: {
        ...this.settings.navData,
        ...partial.navData
      },
      simbrief: {
        ...this.settings.simbrief,
        ...partial.simbrief
      },
      lanAccess: {
        ...this.settings.lanAccess,
        ...partial.lanAccess
      }
    };
    node_fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf-8");
    return this.settings;
  }
  load() {
    if (!node_fs.existsSync(this.filePath)) {
      node_fs.writeFileSync(this.filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
      return DEFAULT_SETTINGS;
    }
    try {
      const raw = node_fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        navData: {
          ...DEFAULT_SETTINGS.navData,
          ...parsed.navData
        },
        simbrief: {
          ...DEFAULT_SETTINGS.simbrief,
          ...parsed.simbrief
        },
        lanAccess: {
          ...DEFAULT_SETTINGS.lanAccess,
          ...parsed.lanAccess,
          allowWrite: true
        }
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
}
function createAuthToken() {
  return node_crypto.randomBytes(24).toString("hex");
}
class MockAircraftProvider {
  constructor() {
    this.aircraftState = {
      connected: true,
      source: "mock",
      lat: 31.2304,
      lon: 121.4737,
      altitudeFt: 3200,
      headingDeg: 90,
      groundSpeedKts: 120,
      onGround: false,
      updatedAt: Date.now()
    };
    this.connectionState = {
      connected: true,
      source: "mock",
      messageCode: "MOCK_READY",
      updatedAt: Date.now()
    };
    this.timer = null;
    this.aircraftListeners = /* @__PURE__ */ new Set();
    this.connectionListeners = /* @__PURE__ */ new Set();
  }
  start() {
    this.emitConnection();
    if (this.timer) return;
    this.timer = setInterval(() => {
      const nextHeading = (this.aircraftState.headingDeg + 4) % 360;
      const radians = nextHeading * Math.PI / 180;
      this.aircraftState = {
        ...this.aircraftState,
        lat: this.aircraftState.lat + Math.sin(radians) * 0.02,
        lon: this.aircraftState.lon + Math.cos(radians) * 0.02,
        altitudeFt: 3e3 + Math.sin(Date.now() / 2e3) * 600,
        headingDeg: nextHeading,
        groundSpeedKts: 118 + Math.cos(Date.now() / 1500) * 6,
        updatedAt: Date.now()
      };
      this.emitAircraft();
    }, 500);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  getAircraftState() {
    return this.aircraftState;
  }
  getConnectionState() {
    return this.connectionState;
  }
  onAircraftState(listener) {
    this.aircraftListeners.add(listener);
    listener(this.aircraftState);
    return () => this.aircraftListeners.delete(listener);
  }
  onConnectionState(listener) {
    this.connectionListeners.add(listener);
    listener(this.connectionState);
    return () => this.connectionListeners.delete(listener);
  }
  emitAircraft() {
    for (const listener of this.aircraftListeners) {
      listener(this.aircraftState);
    }
  }
  emitConnection() {
    for (const listener of this.connectionListeners) {
      listener(this.connectionState);
    }
  }
}
const RETRY_MS = 5e3;
class NodeSimConnectProvider {
  constructor() {
    this.aircraftState = {
      connected: false,
      source: "simconnect",
      lat: 0,
      lon: 0,
      altitudeFt: 0,
      headingDeg: 0,
      groundSpeedKts: 0,
      onGround: true,
      updatedAt: Date.now()
    };
    this.connectionState = {
      connected: false,
      source: "simconnect",
      messageCode: "CONNECTING",
      updatedAt: Date.now()
    };
    this.handle = null;
    this.reconnectTimer = null;
    this.started = false;
    this.aircraftListeners = /* @__PURE__ */ new Set();
    this.connectionListeners = /* @__PURE__ */ new Set();
  }
  start() {
    this.started = true;
    void this.connect();
  }
  stop() {
    this.started = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.handle) {
      this.detachHandleListeners(this.handle);
      this.handle.close();
      this.handle = null;
    }
  }
  getAircraftState() {
    return this.aircraftState;
  }
  getConnectionState() {
    return this.connectionState;
  }
  onAircraftState(listener) {
    this.aircraftListeners.add(listener);
    listener(this.aircraftState);
    return () => this.aircraftListeners.delete(listener);
  }
  onConnectionState(listener) {
    this.connectionListeners.add(listener);
    listener(this.connectionState);
    return () => this.connectionListeners.delete(listener);
  }
  async connect() {
    this.updateConnection({
      connected: false,
      source: "simconnect",
      messageCode: "CONNECTING",
      updatedAt: Date.now()
    });
    try {
      const { handle } = await nodeSimconnect.open("MSFS Desktop Tracker", nodeSimconnect.Protocol.KittyHawk);
      if (!this.started) {
        handle.close();
        return;
      }
      this.handle = handle;
      this.attachListeners(handle);
      this.registerDataDefinition(handle);
      this.requestLiveData(handle);
      this.updateConnection({
        connected: true,
        source: "simconnect",
        messageCode: "READY",
        updatedAt: Date.now()
      });
    } catch {
      this.markDisconnectedAndRetry();
    }
  }
  attachListeners(handle) {
    handle.on("simObjectData", (payload) => {
      if (payload.requestID !== 1) return;
      const position = nodeSimconnect.readLatLonAlt(payload.data);
      const heading = payload.data.readFloat64();
      const speed = payload.data.readFloat64();
      const onGround = payload.data.readInt32() === 1;
      this.updateAircraft({
        connected: true,
        source: "simconnect",
        lat: position.latitude,
        lon: position.longitude,
        altitudeFt: position.altitude,
        headingDeg: heading,
        groundSpeedKts: speed,
        onGround,
        updatedAt: Date.now()
      });
    });
    handle.on("quit", () => {
      this.markDisconnectedAndRetry();
    });
    handle.on("close", () => {
      this.markDisconnectedAndRetry();
    });
    handle.on("error", () => {
      this.markDisconnectedAndRetry();
    });
  }
  registerDataDefinition(handle) {
    handle.addToDataDefinition(
      1,
      "STRUCT LATLONALT",
      null,
      nodeSimconnect.SimConnectDataType.LATLONALT
    );
    handle.addToDataDefinition(
      1,
      "PLANE HEADING DEGREES TRUE",
      "degrees",
      nodeSimconnect.SimConnectDataType.FLOAT64
    );
    handle.addToDataDefinition(
      1,
      "GROUND VELOCITY",
      "knots",
      nodeSimconnect.SimConnectDataType.FLOAT64
    );
    handle.addToDataDefinition(
      1,
      "SIM ON GROUND",
      "bool",
      nodeSimconnect.SimConnectDataType.INT32
    );
  }
  requestLiveData(handle) {
    handle.requestDataOnSimObject(
      1,
      1,
      nodeSimconnect.SimConnectConstants.OBJECT_ID_USER,
      nodeSimconnect.SimConnectPeriod.SECOND
    );
  }
  markDisconnectedAndRetry() {
    if (this.handle) {
      this.detachHandleListeners(this.handle);
      this.handle.close();
      this.handle = null;
    }
    this.updateConnection({
      connected: false,
      source: "simconnect",
      messageCode: "SIM_NOT_CONNECTED",
      updatedAt: Date.now()
    });
    this.updateAircraft({
      ...this.aircraftState,
      connected: false,
      source: "simconnect",
      updatedAt: Date.now()
    });
    if (!this.started || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RETRY_MS);
  }
  updateAircraft(state) {
    this.aircraftState = state;
    for (const listener of this.aircraftListeners) {
      listener(state);
    }
  }
  updateConnection(state) {
    this.connectionState = state;
    for (const listener of this.connectionListeners) {
      listener(state);
    }
  }
  detachHandleListeners(handle) {
    handle.removeAllListeners("simObjectData");
    handle.removeAllListeners("quit");
    handle.removeAllListeners("close");
    handle.removeAllListeners("error");
  }
}
class SimConnectService {
  constructor(settings) {
    this.aircraftListeners = /* @__PURE__ */ new Set();
    this.connectionListeners = /* @__PURE__ */ new Set();
    this.unsubscribeAircraft = null;
    this.unsubscribeConnection = null;
    this.provider = this.createProvider(settings);
    this.bindProvider();
  }
  start() {
    this.provider.start();
  }
  stop() {
    this.provider.stop();
  }
  getProvider() {
    return this.provider;
  }
  onAircraftState(listener) {
    this.aircraftListeners.add(listener);
    listener(this.provider.getAircraftState());
    return () => this.aircraftListeners.delete(listener);
  }
  onConnectionState(listener) {
    this.connectionListeners.add(listener);
    listener(this.provider.getConnectionState());
    return () => this.connectionListeners.delete(listener);
  }
  reconfigure(settings) {
    this.unsubscribeAircraft?.();
    this.unsubscribeConnection?.();
    this.provider.stop();
    this.provider = this.createProvider(settings);
    this.bindProvider();
    this.provider.start();
  }
  createProvider(_settings) {
    if (_settings.providerMode === "simconnect") {
      return new NodeSimConnectProvider();
    }
    return new MockAircraftProvider();
  }
  bindProvider() {
    this.unsubscribeAircraft = this.provider.onAircraftState((state) => {
      for (const listener of this.aircraftListeners) {
        listener(state);
      }
    });
    this.unsubscribeConnection = this.provider.onConnectionState((state) => {
      for (const listener of this.connectionListeners) {
        listener(state);
      }
    });
  }
}
class ChartRepository {
  constructor(storage) {
    this.db = new Database(storage.databasePath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }
  listCharts() {
    const rows = this.db.prepare("SELECT * FROM charts ORDER BY updated_at DESC").all();
    return rows.map((row) => this.toChartRecord(row));
  }
  getChart(id) {
    const row = this.db.prepare("SELECT * FROM charts WHERE id = ?").get(id);
    return row ? this.toChartRecord(row) : null;
  }
  createChart(chart) {
    this.db.prepare(
      `
        INSERT INTO charts (
          id, title, airport_code, chart_type, source_file_path, preview_image_path,
          file_format, width, height, is_georeferenced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      chart.id,
      chart.title,
      chart.airportCode,
      chart.chartType,
      chart.sourceFilePath,
      chart.previewImagePath,
      chart.fileFormat,
      chart.width,
      chart.height,
      chart.isGeoreferenced ? 1 : 0,
      chart.createdAt,
      chart.updatedAt
    );
    return chart;
  }
  updateChart(input) {
    const now = Date.now();
    this.db.prepare(
      `
        UPDATE charts
        SET title = ?, airport_code = ?, chart_type = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(input.title, input.airportCode, input.chartType, now, input.id);
    return this.getChart(input.id);
  }
  deleteChart(chartId) {
    const trx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM chart_reference_points WHERE chart_id = ?").run(chartId);
      this.db.prepare("DELETE FROM charts WHERE id = ?").run(chartId);
    });
    trx();
  }
  listReferencePoints(chartId) {
    const rows = this.db.prepare(
      `
        SELECT id, chart_id, point_index, map_lat, map_lon, chart_x, chart_y
        FROM chart_reference_points
        WHERE chart_id = ?
        ORDER BY point_index ASC
      `
    ).all(chartId);
    return rows.map((row) => ({
      id: row.id,
      chartId: row.chart_id,
      index: row.point_index,
      mapLat: row.map_lat,
      mapLon: row.map_lon,
      chartX: row.chart_x,
      chartY: row.chart_y
    }));
  }
  saveReferencePoints(chartId, points) {
    const trx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM chart_reference_points WHERE chart_id = ?").run(chartId);
      const insertPoint = this.db.prepare(
        `
        INSERT INTO chart_reference_points (
          id, chart_id, point_index, map_lat, map_lon, chart_x, chart_y, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      );
      for (const point of points) {
        insertPoint.run(
          point.id,
          chartId,
          point.index,
          point.mapLat,
          point.mapLon,
          point.chartX,
          point.chartY,
          Date.now()
        );
      }
      this.db.prepare(
        `
          UPDATE charts
          SET is_georeferenced = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(points.length === 2 ? 1 : 0, Date.now(), chartId);
    });
    trx();
    return this.listReferencePoints(chartId);
  }
  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS charts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        airport_code TEXT,
        chart_type TEXT NOT NULL,
        source_file_path TEXT NOT NULL,
        preview_image_path TEXT,
        file_format TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        is_georeferenced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chart_reference_points (
        id TEXT PRIMARY KEY,
        chart_id TEXT NOT NULL,
        point_index INTEGER NOT NULL,
        map_lat REAL NOT NULL,
        map_lon REAL NOT NULL,
        chart_x REAL NOT NULL,
        chart_y REAL NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }
  toChartRecord(row) {
    return {
      id: row.id,
      title: row.title,
      airportCode: row.airport_code,
      chartType: row.chart_type,
      sourceFilePath: row.source_file_path,
      previewImagePath: row.preview_image_path,
      fileFormat: row.file_format,
      width: row.width,
      height: row.height,
      isGeoreferenced: row.is_georeferenced === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
class StorageService {
  constructor() {
    const root = ensureDataRootDir();
    const chartsRoot = node_path.join(root, "charts");
    node_fs.mkdirSync(root, { recursive: true });
    node_fs.mkdirSync(chartsRoot, { recursive: true });
    this.storageSummary = {
      databasePath: node_path.join(root, "app.db"),
      chartsRoot
    };
  }
  getSummary() {
    return this.storageSummary;
  }
  importChartFile(sourcePath, chartId) {
    const chartDir = node_path.join(this.storageSummary.chartsRoot, chartId);
    const extension = node_path.extname(sourcePath).toLowerCase();
    const fileName = `source${extension}`;
    const destinationPath = node_path.join(chartDir, fileName);
    node_fs.mkdirSync(chartDir, { recursive: true });
    node_fs.copyFileSync(sourcePath, destinationPath);
    return {
      destinationPath,
      fileName: node_path.basename(destinationPath)
    };
  }
  writeChartSourceFile(chartId, fileFormat, base64) {
    const chartDir = node_path.join(this.storageSummary.chartsRoot, chartId);
    const normalizedExtension = fileFormat === "jpeg" ? "jpg" : fileFormat;
    const fileName = `source.${normalizedExtension}`;
    const destinationPath = node_path.join(chartDir, fileName);
    node_fs.mkdirSync(chartDir, { recursive: true });
    node_fs.writeFileSync(destinationPath, Buffer.from(base64, "base64"));
    return {
      destinationPath,
      fileName
    };
  }
  readFileBase64(filePath) {
    return node_fs.readFileSync(filePath).toString("base64");
  }
  writeChartDisplayImage(chartId, mimeType, base64) {
    const chartDir = node_path.join(this.storageSummary.chartsRoot, chartId);
    node_fs.mkdirSync(chartDir, { recursive: true });
    const extension = mimeType === "image/jpeg" ? "jpg" : "png";
    const destinationPath = node_path.join(chartDir, `display.${extension}`);
    node_fs.writeFileSync(destinationPath, Buffer.from(base64, "base64"));
    return destinationPath;
  }
  deleteChartFiles(chartId) {
    const chartDir = node_path.join(this.storageSummary.chartsRoot, chartId);
    node_fs.rmSync(chartDir, { recursive: true, force: true });
  }
}
class LanServer {
  constructor(options) {
    this.server = null;
    this.wsServer = new ws.WebSocketServer({ noServer: true });
    this.sockets = /* @__PURE__ */ new Set();
    this.settings = options.settings;
    this.rendererRoot = options.rendererRoot;
    this.flightStateStore = options.flightStateStore;
    this.settingsStore = options.settingsStore;
    this.simConnectService = options.simConnectService;
    this.chartRepository = options.chartRepository;
    this.storageService = options.storageService;
    this.navDataService = options.navDataService;
  }
  async start() {
    if (!this.settings.lanAccess.enabled || this.server) {
      return;
    }
    this.server = node_http.createServer((request, response) => {
      void this.handleRequest(request, response);
    });
    this.server.on("upgrade", (request, socket, head) => {
      if (!this.isAuthorized(request)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/ws") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wsServer.handleUpgrade(request, socket, head, (ws2) => {
        this.sockets.add(ws2);
        ws2.on("close", () => this.sockets.delete(ws2));
      });
    });
    await new Promise((resolvePromise, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.settings.lanAccess.port, "0.0.0.0", () => {
        this.server?.off("error", reject);
        resolvePromise();
      });
    });
  }
  async stop() {
    this.sockets.forEach((socket) => socket.close());
    this.sockets.clear();
    if (!this.server) {
      return;
    }
    const current = this.server;
    this.server = null;
    await new Promise((resolvePromise, reject) => {
      current.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePromise();
      });
    });
  }
  async reconfigure(settings) {
    const shouldRestart = Boolean(this.server) !== settings.lanAccess.enabled || this.settings.lanAccess.port !== settings.lanAccess.port || this.settings.lanAccess.authEnabled !== settings.lanAccess.authEnabled || this.settings.lanAccess.authToken !== settings.lanAccess.authToken;
    this.settings = settings;
    if (shouldRestart) {
      await this.stop();
      await this.start();
    }
  }
  getStatus() {
    const accessUrls = this.server ? getLanAccessUrls(
      this.settings.lanAccess.port,
      this.settings.lanAccess.authEnabled ? this.settings.lanAccess.authToken : ""
    ) : [];
    return {
      enabled: this.settings.lanAccess.enabled,
      running: Boolean(this.server),
      port: this.settings.lanAccess.port,
      primaryAccessUrl: accessUrls[0] ?? null,
      accessUrls
    };
  }
  broadcastAircraftState(state) {
    this.flightStateStore.setAircraftState(state);
    this.broadcast({ type: "aircraft:update", payload: state });
  }
  broadcastConnectionState(state) {
    this.flightStateStore.setConnectionState(state);
    this.broadcast({ type: "connection:update", payload: state });
  }
  broadcastChartChanged() {
    this.broadcast({ type: "chart:changed" });
  }
  broadcastSettingsChanged() {
    this.broadcast({ type: "settings:changed" });
  }
  async handleRequest(request, response) {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/api/health") {
        this.sendJson(response, {
          ok: true,
          running: Boolean(this.server)
        });
        return;
      }
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/assets/charts/")) {
        if (!this.isAuthorized(request)) {
          this.sendJson(response, { error: "UNAUTHORIZED" }, 401);
          return;
        }
      }
      if (url.pathname === "/api/snapshot") {
        this.sendJson(response, {
          aircraft: this.flightStateStore.getAircraftState(),
          connection: this.flightStateStore.getConnectionState()
        });
        return;
      }
      if (url.pathname === "/api/settings") {
        if (request.method === "PATCH") {
          if (!this.ensureWriteEnabled(response)) {
            return;
          }
          const partial = await this.readJsonBody(request);
          const nextSettings = this.settingsStore.update(partial);
          this.settings = nextSettings;
          this.simConnectService.reconfigure(nextSettings);
          await this.reconfigure(nextSettings);
          this.broadcastSettingsChanged();
          this.sendJson(response, sanitizeSettings(nextSettings));
          return;
        }
        this.sendJson(response, sanitizeSettings(this.settings));
        return;
      }
      if (url.pathname === "/api/nav/status") {
        this.sendJson(response, this.navDataService.getStatus(this.settingsStore.get()));
        return;
      }
      if (url.pathname === "/api/nav/airports") {
        const query = url.searchParams.get("query") ?? "";
        this.sendJson(response, this.navDataService.searchAirports(this.settingsStore.get(), query));
        return;
      }
      const navProceduresMatch = url.pathname.match(/^\/api\/nav\/airport\/([^/]+)\/procedures$/);
      if (navProceduresMatch) {
        this.sendJson(
          response,
          this.navDataService.getAirportProcedures(this.settingsStore.get(), navProceduresMatch[1] ?? "")
        );
        return;
      }
      if (url.pathname === "/api/nav/plan" && request.method === "POST") {
        const input = await this.readJsonBody(request);
        this.sendJson(response, this.navDataService.buildFlightPlan(this.settingsStore.get(), input));
        return;
      }
      if (url.pathname === "/api/simbrief/import" && request.method === "POST") {
        const input = await this.readJsonBody(request);
        this.sendJson(
          response,
          await this.navDataService.importFromSimBrief({
            username: input.username ?? this.settingsStore.get().simbrief.username,
            userId: input.userId ?? this.settingsStore.get().simbrief.userId
          })
        );
        return;
      }
      if (url.pathname === "/api/storage-summary") {
        this.sendJson(response, this.storageService.getSummary());
        return;
      }
      if (url.pathname === "/api/charts") {
        if (request.method === "POST") {
          if (!this.ensureWriteEnabled(response)) {
            return;
          }
          const input = await this.readJsonBody(request);
          const result = this.finalizeChartImport(input);
          this.sendJson(response, result, 201);
          return;
        }
        this.sendJson(response, this.chartRepository.listCharts());
        return;
      }
      const chartMatch = url.pathname.match(/^\/api\/charts\/([^/]+)$/);
      if (chartMatch) {
        if (request.method === "PATCH") {
          if (!this.ensureWriteEnabled(response)) {
            return;
          }
          const input = await this.readJsonBody(request);
          this.sendJson(response, this.updateChart({ ...input, id: chartMatch[1] }));
          return;
        }
        if (request.method === "DELETE") {
          if (!this.ensureWriteEnabled(response)) {
            return;
          }
          this.deleteChart(chartMatch[1]);
          this.sendJson(response, { ok: true });
          return;
        }
        this.sendJson(response, this.chartRepository.getChart(chartMatch[1]));
        return;
      }
      const pointsMatch = url.pathname.match(/^\/api\/charts\/([^/]+)\/reference-points$/);
      if (pointsMatch) {
        if (request.method === "PUT") {
          if (!this.ensureWriteEnabled(response)) {
            return;
          }
          const payload = await this.readJsonBody(request);
          this.sendJson(response, this.saveReferencePoints(pointsMatch[1], payload.points));
          return;
        }
        this.sendJson(response, this.chartRepository.listReferencePoints(pointsMatch[1]));
        return;
      }
      const chartAssetMatch = url.pathname.match(/^\/assets\/charts\/([^/]+)\/preview$/);
      if (chartAssetMatch) {
        this.serveChartAsset(chartAssetMatch[1], response);
        return;
      }
      this.serveRendererAsset(url.pathname, response);
    } catch (error) {
      if (response.headersSent) {
        return;
      }
      this.sendJson(response, { error: error instanceof Error ? error.message : "INTERNAL_ERROR" }, 500);
    }
  }
  async readJsonBody(request) {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
      return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  }
  ensureWriteEnabled(response) {
    if (!this.settings.lanAccess.allowWrite) {
      this.sendJson(response, { error: "WRITE_DISABLED" }, 403);
      return false;
    }
    return true;
  }
  serveChartAsset(chartId, response) {
    const asset = this.getChartAsset(chartId);
    if (!asset?.filePath || !node_fs.existsSync(asset.filePath)) {
      response.writeHead(404);
      response.end("Chart asset not found");
      return;
    }
    const stat = node_fs.statSync(asset.filePath);
    response.writeHead(200, {
      "Content-Type": asset.mimeType,
      "Content-Length": stat.size,
      "Cache-Control": "private, max-age=300"
    });
    node_fs.createReadStream(asset.filePath).pipe(response);
  }
  getChartAsset(chartId) {
    const chart = this.chartRepository.getChart(chartId);
    if (!chart) {
      return null;
    }
    const displayPath = chart.previewImagePath ?? chart.sourceFilePath;
    return {
      chartId,
      fileFormat: chart.fileFormat,
      mimeType: getMimeTypeByFormat(chart.fileFormat),
      filePath: displayPath
    };
  }
  serveRendererAsset(pathname, response) {
    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    const absolutePath = node_path.resolve(this.rendererRoot, `.${requestedPath}`);
    const fallbackPath = node_path.join(this.rendererRoot, "index.html");
    const targetPath = absolutePath.startsWith(node_path.resolve(this.rendererRoot)) && node_fs.existsSync(absolutePath) ? absolutePath : fallbackPath;
    if (!node_fs.existsSync(targetPath)) {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("LAN renderer assets are unavailable. Run npm run build:bundle or npm run build first.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": getContentType(targetPath)
    });
    response.end(node_fs.readFileSync(targetPath));
  }
  sendJson(response, data, statusCode = 200) {
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(data));
  }
  finalizeChartImport(input) {
    const chartId = node_crypto.randomUUID();
    const imported = input.sourcePath ? this.storageService.importChartFile(input.sourcePath, chartId) : input.sourceFileBase64 && input.sourceFileFormat ? this.storageService.writeChartSourceFile(chartId, input.sourceFileFormat, input.sourceFileBase64) : null;
    if (!imported) {
      throw new Error("CHART_SOURCE_REQUIRED");
    }
    const displayPath = input.displayImageBase64 && input.displayImageMimeType ? this.storageService.writeChartDisplayImage(
      chartId,
      input.displayImageMimeType,
      input.displayImageBase64
    ) : imported.destinationPath;
    const displayFormat = getFileFormat(displayPath);
    const now = Date.now();
    const chart = {
      id: chartId,
      title: input.title,
      airportCode: null,
      chartType: "general",
      sourceFilePath: imported.destinationPath,
      previewImagePath: displayPath,
      fileFormat: displayFormat,
      width: null,
      height: null,
      isGeoreferenced: false,
      createdAt: now,
      updatedAt: now
    };
    const created = this.chartRepository.createChart(chart);
    this.broadcastChartChanged();
    return { chart: created };
  }
  updateChart(input) {
    const updated = this.chartRepository.updateChart(input);
    this.broadcastChartChanged();
    return updated;
  }
  saveReferencePoints(chartId, points) {
    const saved = this.chartRepository.saveReferencePoints(chartId, points);
    this.broadcastChartChanged();
    return saved;
  }
  deleteChart(chartId) {
    this.chartRepository.deleteChart(chartId);
    this.storageService.deleteChartFiles(chartId);
    this.broadcastChartChanged();
  }
  isAuthorized(request) {
    if (!this.settings.lanAccess.authEnabled) {
      return true;
    }
    const expectedToken = this.settings.lanAccess.authToken;
    if (!expectedToken) {
      return true;
    }
    const authHeader = request.headers.authorization;
    if (authHeader === `Bearer ${expectedToken}`) {
      return true;
    }
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    return url.searchParams.get("token") === expectedToken;
  }
  broadcast(event) {
    const payload = JSON.stringify(event);
    this.sockets.forEach((socket) => {
      if (socket.readyState === ws.WebSocket.OPEN) {
        socket.send(payload);
      }
    });
  }
}
function getFileFormat(filePath) {
  const ext = filePath.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "jpg") return "jpg";
  if (ext === "jpeg") return "jpeg";
  return "png";
}
function sanitizeSettings(settings) {
  return {
    ...settings,
    lanAccess: {
      ...settings.lanAccess,
      authToken: ""
    }
  };
}
function getLanAccessUrls(port, authToken) {
  const interfaces = node_os.networkInterfaces();
  const results = /* @__PURE__ */ new Set();
  const querySuffix = authToken ? `/?token=${authToken}` : "/";
  Object.values(interfaces).forEach((entries) => {
    entries?.forEach((entry) => {
      if (entry.family !== "IPv4" || entry.internal || !entry.address.startsWith("192.168.")) {
        return;
      }
      results.add(`http://${entry.address}:${port}${querySuffix}`);
    });
  });
  return Array.from(results).sort();
}
function getMimeTypeByFormat(fileFormat) {
  switch (fileFormat) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
    default:
      return "image/png";
  }
}
function getContentType(filePath) {
  switch (node_path.extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".html":
    default:
      return "text/html; charset=utf-8";
  }
}
class NavDataService {
  getDefaultDbPath() {
    return node_path.join(
      node_os.homedir(),
      "AppData",
      "Roaming",
      "ABarthel",
      "little_navmap_db",
      "little_navmap_navigraph.sqlite"
    );
  }
  getStatus(settings) {
    const defaultPath = this.getDefaultDbPath();
    const configuredPath = normalizeNullablePath(settings.navData.sqlitePath);
    const manualExists = configuredPath ? node_fs.existsSync(configuredPath) : false;
    const autoExists = node_fs.existsSync(defaultPath);
    if (configuredPath && manualExists) {
      return {
        defaultPath,
        configuredPath,
        activePath: configuredPath,
        exists: true,
        source: "manual",
        message: "Using manual Little Navmap SQLite path."
      };
    }
    if (settings.navData.autoDetect !== false && autoExists) {
      return {
        defaultPath,
        configuredPath,
        activePath: defaultPath,
        exists: true,
        source: "auto",
        message: "Detected Little Navmap SQLite path automatically."
      };
    }
    return {
      defaultPath,
      configuredPath,
      activePath: null,
      exists: false,
      source: "none",
      message: "Little Navmap SQLite file was not found."
    };
  }
  searchAirports(settings, query, limit = 20) {
    const db = this.openDatabase(settings);
    if (!db) return [];
    const term = query.trim().toUpperCase();
    if (!term) return [];
    const rows = db.prepare(
      `
        SELECT ident, name, city, country, laty, lonx
        FROM airport
        WHERE ident LIKE @prefix OR name LIKE @wild
        ORDER BY CASE WHEN ident = @exact THEN 0 ELSE 1 END, ident
        LIMIT @limit
        `
    ).all({
      prefix: `${term}%`,
      wild: `%${term}%`,
      exact: term,
      limit: Math.max(1, Math.min(100, limit))
    });
    db.close();
    return rows.map((row) => ({
      ident: row.ident,
      name: row.name ?? row.ident,
      city: row.city,
      country: row.country,
      lat: row.laty,
      lon: row.lonx
    }));
  }
  getAirportProcedures(settings, airportIdent) {
    const db = this.openDatabase(settings);
    if (!db) {
      return emptyProcedures();
    }
    const ident = airportIdent.trim().toUpperCase();
    if (!ident) {
      db.close();
      return emptyProcedures();
    }
    const airport = db.prepare(
      "SELECT airport_id, ident, name, city, country, laty, lonx FROM airport WHERE ident = ? LIMIT 1"
    ).get(ident);
    if (!airport) {
      db.close();
      return emptyProcedures();
    }
    const runways = db.prepare(
      `
        SELECT runway_name, MAX(length) AS length, MAX(width) AS width, MAX(surface) AS surface, MAX(heading) AS heading
        FROM (
          SELECT runway_id, airport_id, surface, length, width, heading,
            CASE
              WHEN primary_name IS NOT NULL AND secondary_name IS NOT NULL THEN primary_name || '/' || secondary_name
              WHEN primary_name IS NOT NULL THEN primary_name
              WHEN secondary_name IS NOT NULL THEN secondary_name
              ELSE printf('RWY-%d', runway_id)
            END AS runway_name
          FROM (
            SELECT r.runway_id, r.airport_id, r.surface, r.length, r.width, r.heading,
              (SELECT name FROM runway_end re WHERE re.runway_end_id = r.primary_end_id) AS primary_name,
              (SELECT name FROM runway_end re WHERE re.runway_end_id = r.secondary_end_id) AS secondary_name
            FROM runway r
            WHERE r.airport_id = @airportId
          )
        )
        GROUP BY runway_name
        ORDER BY length DESC, runway_name
        `
    ).all({ airportId: airport.airport_id });
    const departures = db.prepare(
      `
        SELECT start_id, runway_name
        FROM start
        WHERE airport_id = ?
        ORDER BY runway_name
        `
    ).all(airport.airport_id);
    const approaches = db.prepare(
      `
        SELECT approach_id, runway_name, type, arinc_name
        FROM approach
        WHERE airport_ident = ?
        ORDER BY runway_name, type, arinc_name
        `
    ).all(ident);
    db.close();
    const runwayOptions = runways.map((row) => ({
      name: row.runway_name,
      lengthM: asFiniteOrNull(row.length),
      widthM: asFiniteOrNull(row.width),
      surface: row.surface,
      headingDeg: asFiniteOrNull(row.heading)
    }));
    const depOptions = departures.map((row) => ({
      id: `start:${row.start_id}`,
      name: row.runway_name ? `RWY ${row.runway_name} Departure` : `Departure ${row.start_id}`,
      procedureType: "departure",
      runwayName: row.runway_name
    }));
    const apprOptions = approaches.map((row) => ({
      id: `approach:${row.approach_id}`,
      name: [row.type, row.runway_name ? `RWY ${row.runway_name}` : null, row.arinc_name].filter(Boolean).join(" "),
      procedureType: "approach",
      runwayName: row.runway_name
    }));
    return {
      airport: {
        ident: airport.ident,
        name: airport.name ?? airport.ident,
        city: airport.city,
        country: airport.country,
        lat: airport.laty,
        lon: airport.lonx
      },
      runways: runwayOptions,
      departures: depOptions,
      arrivals: [],
      approaches: apprOptions
    };
  }
  buildFlightPlan(settings, input) {
    const db = this.openDatabase(settings);
    if (!db) {
      return {
        points: [],
        unresolvedTokens: [],
        summary: "Navigation database is not available."
      };
    }
    const departureIdent = input.departureAirport.trim().toUpperCase();
    const destinationIdent = input.destinationAirport.trim().toUpperCase();
    const unresolvedTokens = [];
    const points = [];
    const departure = this.getAirportByIdent(db, departureIdent);
    const destination = this.getAirportByIdent(db, destinationIdent);
    if (departure) {
      points.push({
        ident: departure.ident,
        lat: departure.laty,
        lon: departure.lonx,
        source: "airport"
      });
    }
    const departureProcedure = this.resolveStartProcedurePoint(db, input.departureProcedureId);
    if (departureProcedure) {
      points.push(departureProcedure);
    }
    const tokens = normalizeRouteTokens(input.enrouteText);
    for (const token of tokens) {
      if (token === departureIdent || token === destinationIdent) {
        continue;
      }
      const fix = this.resolveFix(db, token);
      if (fix) {
        points.push({
          ident: fix.ident,
          lat: fix.laty,
          lon: fix.lonx,
          source: fix.source
        });
      } else {
        unresolvedTokens.push(token);
      }
    }
    const approachLegs = this.resolveApproachLegPoints(db, input.approachProcedureId);
    points.push(...approachLegs);
    if (destination) {
      points.push({
        ident: destination.ident,
        lat: destination.laty,
        lon: destination.lonx,
        source: "airport"
      });
    }
    db.close();
    const uniquePoints = dedupeConsecutivePoints(points);
    return {
      points: uniquePoints,
      unresolvedTokens,
      summary: `${departureIdent || "----"} -> ${destinationIdent || "----"} | ${uniquePoints.length} points`
    };
  }
  async importFromSimBrief(input) {
    const username = input.username?.trim() ?? "";
    const userId = input.userId?.trim() ?? "";
    if (!username && !userId) {
      throw new Error("SIMBRIEF_ID_REQUIRED");
    }
    const query = new URLSearchParams();
    query.set("json", "1");
    if (username) query.set("username", username);
    if (userId) query.set("userid", userId);
    const url = `https://www.simbrief.com/api/xml.fetcher.php?${query.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`SIMBRIEF_HTTP_${response.status}`);
    }
    const payload = await response.json();
    const departureAirport = readStringPath(payload, ["origin", "icao_code"]) ?? readStringPath(payload, ["params", "orig"]);
    const destinationAirport = readStringPath(payload, ["destination", "icao_code"]) ?? readStringPath(payload, ["params", "dest"]);
    const alternateAirport = readStringPath(payload, ["alternate", "icao_code"]) ?? null;
    const routeText = readStringPath(payload, ["general", "route"]) ?? readStringPath(payload, ["navlog", "route"]) ?? readStringPath(payload, ["params", "route"]) ?? "";
    if (!departureAirport || !destinationAirport) {
      throw new Error("SIMBRIEF_PARSE_FAILED");
    }
    return {
      departureAirport: departureAirport.trim().toUpperCase(),
      destinationAirport: destinationAirport.trim().toUpperCase(),
      alternateAirport: alternateAirport ? alternateAirport.trim().toUpperCase() : null,
      routeText: routeText.trim(),
      source: "simbrief"
    };
  }
  openDatabase(settings) {
    const status = this.getStatus(settings);
    if (!status.activePath || !node_fs.existsSync(status.activePath)) {
      return null;
    }
    return new Database(status.activePath, {
      readonly: true,
      fileMustExist: true
    });
  }
  getAirportByIdent(db, ident) {
    if (!ident) return null;
    return db.prepare(
      "SELECT airport_id, ident, name, city, country, laty, lonx FROM airport WHERE ident = ? LIMIT 1"
    ).get(ident) ?? null;
  }
  resolveFix(db, token) {
    const ident = token.trim().toUpperCase();
    if (!ident) return null;
    const waypoint = db.prepare(
      `
        SELECT ident, laty, lonx, 'waypoint' AS source
        FROM waypoint
        WHERE ident = ?
        ORDER BY CASE WHEN airport_ident IS NULL OR airport_ident = '' THEN 0 ELSE 1 END, waypoint_id
        LIMIT 1
        `
    ).get(ident);
    if (waypoint) return waypoint;
    const vor = db.prepare(
      `
        SELECT ident, laty, lonx, 'vor' AS source
        FROM vor
        WHERE ident = ?
        LIMIT 1
        `
    ).get(ident);
    if (vor) return vor;
    const ndb = db.prepare(
      `
        SELECT ident, laty, lonx, 'ndb' AS source
        FROM ndb
        WHERE ident = ?
        LIMIT 1
        `
    ).get(ident);
    if (ndb) return ndb;
    return null;
  }
  resolveStartProcedurePoint(db, departureProcedureId) {
    if (!departureProcedureId?.startsWith("start:")) {
      return null;
    }
    const startId = Number(departureProcedureId.slice("start:".length));
    if (!Number.isFinite(startId)) {
      return null;
    }
    const row = db.prepare("SELECT runway_name, laty, lonx FROM start WHERE start_id = ? LIMIT 1").get(startId);
    if (!row) {
      return null;
    }
    return {
      ident: row.runway_name ? `RWY${row.runway_name}` : "DEP",
      lat: row.laty,
      lon: row.lonx,
      source: "procedure"
    };
  }
  resolveApproachLegPoints(db, approachProcedureId) {
    if (!approachProcedureId?.startsWith("approach:")) {
      return [];
    }
    const approachId = Number(approachProcedureId.slice("approach:".length));
    if (!Number.isFinite(approachId)) {
      return [];
    }
    const legs = db.prepare(
      `
        SELECT fix_ident, fix_laty, fix_lonx
        FROM approach_leg
        WHERE approach_id = ? AND fix_laty IS NOT NULL AND fix_lonx IS NOT NULL
        ORDER BY approach_leg_id
        `
    ).all(approachId);
    return legs.map((leg) => ({
      ident: leg.fix_ident?.trim() || "APPR",
      lat: leg.fix_laty,
      lon: leg.fix_lonx,
      source: "procedure"
    }));
  }
}
function normalizeNullablePath(pathValue) {
  if (!pathValue) return null;
  const trimmed = pathValue.trim();
  return trimmed || null;
}
function normalizeRouteTokens(routeText) {
  return routeText.replace(/,/g, " ").split(/\s+/).map((token) => token.trim().toUpperCase()).filter((token) => token.length > 0).filter((token) => token !== "DCT" && token !== "DIRECT");
}
function asFiniteOrNull(value) {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
}
function dedupeConsecutivePoints(points) {
  const output = [];
  for (const point of points) {
    const prev = output[output.length - 1];
    if (prev && Math.abs(prev.lat - point.lat) < 1e-7 && Math.abs(prev.lon - point.lon) < 1e-7) {
      continue;
    }
    output.push(point);
  }
  return output;
}
function readStringPath(data, path) {
  let current = data;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }
    current = current[key];
  }
  return typeof current === "string" ? current : null;
}
function emptyProcedures() {
  return {
    airport: null,
    runways: [],
    departures: [],
    arrivals: [],
    approaches: []
  };
}
let mainWindow = null;
const DEV_LOAD_RETRY_MS = 1200;
const DEV_LOAD_MAX_ATTEMPTS = 12;
async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function loadRenderer(window) {
  if (process.env.ELECTRON_RENDERER_URL) {
    let lastError;
    for (let attempt = 1; attempt <= DEV_LOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        await window.loadURL(process.env.ELECTRON_RENDERER_URL);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < DEV_LOAD_MAX_ATTEMPTS) {
          await delay(DEV_LOAD_RETRY_MS);
        }
      }
    }
    throw lastError;
  }
  await window.loadFile(node_path.join(__dirname, "../../renderer/index.html"));
}
async function createWindow() {
  const settingsStore = new SettingsStore();
  const flightStateStore = new FlightStateStore();
  const simConnectService = new SimConnectService(settingsStore.get());
  const storageService = new StorageService();
  const navDataService = new NavDataService();
  const chartRepository = new ChartRepository(storageService.getSummary());
  const lanServer = new LanServer({
    settings: settingsStore.get(),
    rendererRoot: node_path.join(__dirname, "../../renderer"),
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService,
    navDataService
  });
  mainWindow = new electron.BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#102033",
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  registerIpc({
    mainWindow,
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService,
    lanServer,
    navDataService
  });
  simConnectService.start();
  await lanServer.start();
  await loadRenderer(mainWindow);
}
electron.app.whenReady().then(async () => {
  await createWindow();
  electron.app.on("activate", async () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
