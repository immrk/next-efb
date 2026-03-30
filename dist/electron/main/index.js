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
    lanServer
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
const DEFAULT_SETTINGS = {
  language: "zh-CN",
  followAircraft: true,
  refreshIntervalMs: 500,
  providerMode: "simconnect",
  mapTileProvider: "osm",
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
    const baseDir = electron.app.getPath("userData");
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
    const root = node_path.join(electron.app.getPath("userData"), "data");
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
  const chartRepository = new ChartRepository(storageService.getSummary());
  const lanServer = new LanServer({
    settings: settingsStore.get(),
    rendererRoot: node_path.join(__dirname, "../../renderer"),
    flightStateStore,
    settingsStore,
    simConnectService,
    chartRepository,
    storageService
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
    lanServer
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
