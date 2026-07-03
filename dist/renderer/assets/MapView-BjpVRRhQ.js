import { d as defineComponent, u as useRouter, a as useI18n, r as reactive, b as ref, w as watch, o as onMounted, n as nextTick, c as onBeforeUnmount, e as resolveComponent, f as openBlock, g as createElementBlock, h as createBaseVNode, i as createVNode, j as withCtx, k as unref, l as createTextVNode, t as toDisplayString, F as Fragment, m as renderList, p as createBlock, q as createCommentVNode, s as aim_default, v as full_screen_default, x as promotion_default, y as files_default, z as getAppClient, A as computed, E as ElMessage, B as useAppState, _ as _export_sfc } from "./index-CvrMHZCP.js";
import { L, g as getMapTileConfig } from "./mapTileProviders-Dh9-3nFD.js";
import { u as useChartLibrary } from "./useChartLibrary-BEvTMR3g.js";
import "./chartSync-ClYV-2kA.js";
const FLIGHT_PLAN_STORAGE_KEY = "nextefb.flight-plan.snapshot.v1";
const EMPTY_SNAPSHOT = {
  draft: {
    departureAirport: "",
    destinationAirport: "",
    enrouteText: "",
    departureRunway: null,
    departureProcedureId: null,
    arrivalRunway: null,
    arrivalProcedureId: null,
    approachProcedureId: null,
    arrivalTransitionId: null
  },
  result: null,
  dock: {
    mountedChartIds: [],
    activeChartId: null,
    overlayDismissed: false
  }
};
function readStoredFlightPlanDraft() {
  return readStoredFlightPlanSnapshot().draft;
}
function readStoredFlightPlanResult() {
  return readStoredFlightPlanSnapshot().result;
}
function readStoredChartDockState() {
  return readStoredFlightPlanSnapshot().dock;
}
function persistStoredFlightPlanDraft(draft) {
  persistStoredFlightPlanSnapshot({
    ...readStoredFlightPlanSnapshot(),
    draft
  });
}
function persistStoredFlightPlanResult(result) {
  persistStoredFlightPlanSnapshot({
    ...readStoredFlightPlanSnapshot(),
    result: result ? {
      points: result.points,
      segments: result.segments
    } : null
  });
}
function persistStoredChartDockState(dock) {
  persistStoredFlightPlanSnapshot({
    ...readStoredFlightPlanSnapshot(),
    dock
  });
}
function readStoredFlightPlanSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_SNAPSHOT;
  }
  try {
    const raw = window.localStorage.getItem(FLIGHT_PLAN_STORAGE_KEY);
    if (!raw) return EMPTY_SNAPSHOT;
    const parsed = JSON.parse(raw);
    return {
      draft: normalizeDraft(parsed.draft),
      result: normalizeResult(parsed.result),
      dock: normalizeDockState(parsed.dock)
    };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}
function persistStoredFlightPlanSnapshot(snapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FLIGHT_PLAN_STORAGE_KEY, JSON.stringify(snapshot));
}
function normalizeDraft(draft) {
  if (!draft || typeof draft !== "object") return EMPTY_SNAPSHOT.draft;
  const value = draft;
  return {
    departureAirport: typeof value.departureAirport === "string" ? value.departureAirport : "",
    destinationAirport: typeof value.destinationAirport === "string" ? value.destinationAirport : "",
    enrouteText: typeof value.enrouteText === "string" ? value.enrouteText : "",
    departureRunway: typeof value.departureRunway === "string" ? value.departureRunway : null,
    departureProcedureId: typeof value.departureProcedureId === "string" ? value.departureProcedureId : null,
    arrivalRunway: typeof value.arrivalRunway === "string" ? value.arrivalRunway : null,
    arrivalProcedureId: typeof value.arrivalProcedureId === "string" ? value.arrivalProcedureId : null,
    approachProcedureId: typeof value.approachProcedureId === "string" ? value.approachProcedureId : null,
    arrivalTransitionId: typeof value.arrivalTransitionId === "string" ? value.arrivalTransitionId : null
  };
}
function normalizeResult(result) {
  if (!result || typeof result !== "object") return null;
  const value = result;
  return {
    points: Array.isArray(value.points) ? value.points : [],
    segments: Array.isArray(value.segments) ? value.segments : []
  };
}
function normalizeDockState(dock) {
  if (!dock || typeof dock !== "object") {
    return EMPTY_SNAPSHOT.dock;
  }
  const value = dock;
  return {
    mountedChartIds: Array.isArray(value.mountedChartIds) ? value.mountedChartIds.filter((chartId) => typeof chartId === "string") : [],
    activeChartId: typeof value.activeChartId === "string" ? value.activeChartId : null,
    overlayDismissed: Boolean(value.overlayDismissed)
  };
}
function filterProceduresByRunway(items, selectedRunway) {
  return items.filter((item) => runwayMatches(item.runwayName, selectedRunway));
}
function runwayMatches(optionRunway, selectedRunway) {
  if (!selectedRunway) return true;
  if (!optionRunway?.trim()) return true;
  return optionRunway.trim().toUpperCase() === selectedRunway.trim().toUpperCase();
}
function buildProcedureMountCards(charts, selection, navContext) {
  if (!selection) return [];
  const procedureSpecs = [
    {
      kind: "departure",
      airportCode: selection.departureAirport,
      procedure: resolveProcedure(navContext.departure, "departures", selection.departureProcedureId)
    },
    {
      kind: "arrival",
      airportCode: selection.destinationAirport,
      procedure: resolveProcedure(navContext.destination, "arrivals", selection.arrivalProcedureId)
    },
    {
      kind: "approach",
      airportCode: selection.destinationAirport,
      procedure: resolveProcedure(navContext.destination, "approaches", selection.approachProcedureId)
    }
  ];
  const cards = [];
  for (const { kind, airportCode, procedure } of procedureSpecs) {
    if (!airportCode || !procedure) continue;
    const chartType = getChartTypeByProcedureKind(kind);
    const exactMatches = charts.filter((chart) => {
      if (!sameAirport(chart.airportCode, airportCode) || chart.chartType !== chartType) {
        return false;
      }
      if (chart.boundApproachProcedureIds.includes(procedure.id)) {
        return true;
      }
      return normalize(chart.title) === normalize(procedure.name);
    });
    const bestMatch = pickBestChart(exactMatches);
    cards.push(
      bestMatch ? {
        id: `procedure:${kind}:${procedure.id}`,
        kind: "procedure",
        procedureKind: kind,
        airportCode,
        procedureId: procedure.id,
        procedureName: procedure.name,
        chartType,
        chartId: bestMatch.id,
        chartTitle: bestMatch.title,
        state: bestMatch.isGeoreferenced ? "active" : "missing-georef"
      } : {
        id: `procedure:${kind}:${procedure.id}`,
        kind: "procedure",
        procedureKind: kind,
        airportCode,
        procedureId: procedure.id,
        procedureName: procedure.name,
        chartType,
        chartId: null,
        chartTitle: null,
        state: "missing-chart"
      }
    );
  }
  return cards;
}
function buildManualMountCards(charts, excludedChartIds) {
  return charts.filter((chart) => chart.isGeoreferenced && !excludedChartIds.has(chart.id)).map((chart) => ({
    id: `manual:${chart.id}`,
    kind: "manual",
    chart
  }));
}
function resolveProcedure(procedures, key, selectedProcedureId) {
  if (!procedures || !selectedProcedureId) return null;
  return procedures[key].find((procedure) => procedure.id === selectedProcedureId) ?? null;
}
function getChartTypeByProcedureKind(kind) {
  if (kind === "departure") return "sid";
  if (kind === "arrival") return "star";
  return "approach";
}
function pickBestChart(charts) {
  if (charts.length === 0) return null;
  const georeferenced = charts.find((chart) => chart.isGeoreferenced);
  if (georeferenced) return georeferenced;
  return [...charts].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}
function sameAirport(left, right) {
  if (!left?.trim()) return false;
  return normalize(left) === normalize(right);
}
function normalize(value) {
  return value.trim().toUpperCase();
}
const _hoisted_1 = { class: "map-page" };
const _hoisted_2 = { class: "toolbar-row" };
const _hoisted_3 = { class: "drawer-footer" };
const MAP_VIEW_KEY = "nextefb.map-view.v2";
const NAV_LAYERS_KEY = "nextefb.nav-layers.v2";
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "MapView",
  setup(__props) {
    const EMPTY_PROCEDURES = {
      airport: null,
      runways: [],
      departures: [],
      arrivals: [],
      transitions: [],
      approaches: []
    };
    const client = getAppClient();
    const router = useRouter();
    const { t } = useI18n();
    const appState = useAppState();
    const aircraft = computed(() => appState.aircraft.value);
    const connection = computed(() => appState.connection.value);
    const settings = computed(() => appState.settings.value);
    const { charts } = useChartLibrary();
    const mapElement = ref();
    const flightPlanVisible = ref(false);
    const chartsVisible = ref(false);
    const mapSearch = ref("");
    const followAircraft = ref(false);
    const planBuilding = ref(false);
    const simbriefLoading = ref(false);
    const airportSearching = ref(false);
    const departureAirportOptions = ref([]);
    const destinationAirportOptions = ref([]);
    const departureProcedures = ref(EMPTY_PROCEDURES);
    const destinationProcedures = ref(EMPTY_PROCEDURES);
    const navStatus = ref(null);
    const draft = reactive(readStoredFlightPlanDraft());
    const storedResult = readStoredFlightPlanResult();
    const flightPlanResult = ref(
      storedResult ? { ...storedResult, unresolvedTokens: [], summary: "" } : null
    );
    const dock = readStoredChartDockState();
    const activeChartId = ref(dock.activeChartId);
    const navLayers = reactive(readNavLayers());
    const layerOptions = [
      { key: "airports", label: "APT" },
      { key: "airways", label: "AWY" },
      { key: "vors", label: "VOR" },
      { key: "ndbs", label: "NDB" },
      { key: "waypoints", label: "WPT" }
    ];
    const providerOptions = computed(() => [
      { value: "esriWorldStreet", label: t("settings.mapTileProviderEsriWorldStreet") },
      { value: "osm", label: t("settings.mapTileProviderOsm") },
      { value: "osmHot", label: t("settings.mapTileProviderOsmHot") },
      { value: "osmfr", label: t("settings.mapTileProviderOsmFr") },
      { value: "cartoLight", label: t("settings.mapTileProviderCartoLight") },
      { value: "cartoVoyager", label: t("settings.mapTileProviderCartoVoyager") }
    ]);
    const routePoints = computed(() => flightPlanResult.value?.points ?? []);
    const flightPlanSelection = computed(() => {
      if (!draft.departureProcedureId && !draft.arrivalProcedureId && !draft.approachProcedureId) {
        return null;
      }
      return {
        departureAirport: draft.departureAirport.trim().toUpperCase(),
        destinationAirport: draft.destinationAirport.trim().toUpperCase(),
        departureRunway: draft.departureRunway,
        departureProcedureId: draft.departureProcedureId,
        arrivalRunway: draft.arrivalRunway,
        arrivalProcedureId: draft.arrivalProcedureId,
        approachProcedureId: draft.approachProcedureId,
        arrivalTransitionId: draft.arrivalTransitionId
      };
    });
    const procedureCards = computed(
      () => buildProcedureMountCards(charts.value, flightPlanSelection.value, {
        departure: departureProcedures.value,
        destination: destinationProcedures.value
      })
    );
    const procedureChartIds = computed(
      () => new Set(
        procedureCards.value.map((card) => card.chartId).filter((chartId) => Boolean(chartId))
      )
    );
    const dockCards = computed(() => [
      ...procedureCards.value,
      ...buildManualMountCards(charts.value, procedureChartIds.value)
    ]);
    const filteredDepartures = computed(
      () => filterProceduresByRunway(departureProcedures.value.departures, draft.departureRunway ?? "")
    );
    const filteredArrivals = computed(
      () => filterProceduresByRunway(destinationProcedures.value.arrivals, draft.arrivalRunway ?? "")
    );
    const filteredApproaches = computed(
      () => filterProceduresByRunway(destinationProcedures.value.approaches, draft.arrivalRunway ?? "")
    );
    let map = null;
    let tileLayer = null;
    let aircraftLayer = null;
    let routeLayer = null;
    let navLayerGroup = null;
    let chartOverlayCleanup = null;
    let navRefreshTimer = null;
    watch(
      draft,
      (value) => persistStoredFlightPlanDraft({ ...value }),
      { deep: true }
    );
    watch(
      () => settings.value?.mapTileProvider,
      () => replaceTileLayer()
    );
    watch(
      [aircraft, followAircraft],
      () => updateAircraftLayer(),
      { deep: true }
    );
    watch(routePoints, () => renderRoute(), { deep: true });
    watch(activeChartId, (value) => {
      persistStoredChartDockState({
        mountedChartIds: value ? [value] : [],
        activeChartId: value,
        overlayDismissed: false
      });
      void renderChartOverlay(value);
    });
    watch(
      navLayers,
      () => {
        window.localStorage.setItem(NAV_LAYERS_KEY, JSON.stringify(navLayers));
        scheduleNavRefresh();
      },
      { deep: true }
    );
    onMounted(async () => {
      await nextTick();
      const storedView = readMapView();
      map = L.map(mapElement.value, { zoomControl: true }).setView(
        [storedView.lat, storedView.lon],
        storedView.zoom
      );
      replaceTileLayer();
      routeLayer = L.layerGroup().addTo(map);
      navLayerGroup = L.layerGroup().addTo(map);
      map.on("moveend zoomend", () => {
        if (!map) return;
        const center = map.getCenter();
        window.localStorage.setItem(
          MAP_VIEW_KEY,
          JSON.stringify({ lat: center.lat, lon: center.lng, zoom: map.getZoom() })
        );
        scheduleNavRefresh();
      });
      updateAircraftLayer();
      renderRoute();
      scheduleNavRefresh();
      void renderChartOverlay(activeChartId.value);
      navStatus.value = await client.getNavDataStatus();
      if (draft.departureAirport) await loadDepartureProcedures();
      if (draft.destinationAirport) await loadDestinationProcedures();
    });
    onBeforeUnmount(() => {
      if (navRefreshTimer !== null) window.clearTimeout(navRefreshTimer);
      chartOverlayCleanup?.();
      map?.remove();
      map = null;
    });
    function replaceTileLayer() {
      if (!map) return;
      tileLayer?.remove();
      const config = getMapTileConfig(settings.value?.mapTileProvider);
      tileLayer = L.tileLayer(config.url, {
        attribution: config.attribution,
        updateWhenIdle: false,
        ...config.subdomains ? { subdomains: config.subdomains } : {}
      }).addTo(map);
      tileLayer.bringToBack();
    }
    function updateAircraftLayer() {
      if (!map) return;
      aircraftLayer?.remove();
      aircraftLayer = null;
      const value = aircraft.value;
      if (!value?.connected || !Number.isFinite(value.lat) || !Number.isFinite(value.lon)) return;
      aircraftLayer = L.circleMarker([value.lat, value.lon], {
        radius: 7,
        color: "var(--el-color-primary)",
        fillColor: "var(--el-color-primary)",
        fillOpacity: 1
      }).bindTooltip(t("map.aircraftMarker")).addTo(map);
      if (followAircraft.value) map.panTo([value.lat, value.lon]);
    }
    function renderRoute() {
      if (!routeLayer) return;
      routeLayer.clearLayers();
      const result = flightPlanResult.value;
      if (!result) return;
      const segments = result.segments.length ? result.segments : [{ points: result.points, dashed: false }];
      for (const segment of segments) {
        if (segment.points.length < 2) continue;
        L.polyline(
          segment.points.map((point) => [point.lat, point.lon]),
          {
            color: "var(--el-color-primary)",
            weight: 3,
            dashArray: segment.dashed ? "10 10" : void 0
          }
        ).addTo(routeLayer);
      }
      result.points.forEach((point, index) => {
        L.circleMarker([point.lat, point.lon], {
          radius: index === 0 || index === result.points.length - 1 ? 6 : 4,
          color: "var(--el-color-primary)",
          fillColor: "var(--el-bg-color)",
          fillOpacity: 1
        }).bindTooltip(`${index + 1}. ${point.ident}`).addTo(routeLayer);
      });
    }
    function fitRoute() {
      if (!map || routePoints.value.length === 0) return;
      followAircraft.value = false;
      map.fitBounds(
        L.latLngBounds(routePoints.value.map((point) => [point.lat, point.lon])),
        { padding: [40, 40] }
      );
    }
    function toggleFollow() {
      followAircraft.value = !followAircraft.value;
      updateAircraftLayer();
    }
    async function changeMapProvider(value) {
      appState.setSettings(await client.updateSettings({ mapTileProvider: value }));
    }
    function toggleNavLayer(key) {
      navLayers[key] = !navLayers[key];
    }
    function scheduleNavRefresh() {
      if (navRefreshTimer !== null) window.clearTimeout(navRefreshTimer);
      navRefreshTimer = window.setTimeout(() => void refreshNavFeatures(), 180);
    }
    async function refreshNavFeatures() {
      if (!map || !navLayerGroup) return;
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const layers = {
        airports: navLayers.airports,
        airways: navLayers.airways && zoom >= 5,
        vors: navLayers.vors && zoom >= 6,
        ndbs: navLayers.ndbs && zoom >= 6,
        waypoints: navLayers.waypoints && zoom >= 8
      };
      if (!Object.values(layers).some(Boolean)) {
        navLayerGroup.clearLayers();
        return;
      }
      try {
        const features = await client.getNavMapFeatures({
          viewport: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
            zoom
          },
          layers
        });
        navLayerGroup.clearLayers();
        features.airways.forEach(
          (feature) => L.polyline(
            [
              [feature.fromLat, feature.fromLon],
              [feature.toLat, feature.toLon]
            ],
            { color: "var(--el-color-info)", weight: 1 }
          ).bindTooltip(`${feature.name} ${feature.airwayType}`).addTo(navLayerGroup)
        );
        const addPoint = (lat, lon, label, radius) => L.circleMarker([lat, lon], {
          radius,
          color: "var(--el-color-primary)",
          fillColor: "var(--el-bg-color)",
          fillOpacity: 1
        }).bindTooltip(label).addTo(navLayerGroup);
        features.airports.forEach(
          (value) => addPoint(value.lat, value.lon, [value.ident, value.name].filter(Boolean).join(" · "), 5)
        );
        features.vors.forEach((value) => addPoint(value.lat, value.lon, value.ident || "VOR", 4));
        features.ndbs.forEach((value) => addPoint(value.lat, value.lon, value.ident || "NDB", 4));
        features.waypoints.forEach((value) => addPoint(value.lat, value.lon, value.ident, 3));
      } catch {
        navLayerGroup.clearLayers();
      }
    }
    async function searchMapPoints(query, callback) {
      const types = layerOptions.filter((item) => item.key !== "airways" && navLayers[item.key]).map((item) => item.key);
      if (!query.trim() || types.length === 0) {
        callback([]);
        return;
      }
      try {
        callback(await client.searchNavMapPoints({ query, types, limit: 20 }));
      } catch {
        callback([]);
      }
    }
    function focusSearchResult(item) {
      followAircraft.value = false;
      map?.setView([item.lat, item.lon], Math.max(map.getZoom(), 10));
    }
    function typeLabel(type) {
      return type === "airports" ? "APT" : type === "waypoints" ? "WPT" : type.toUpperCase();
    }
    async function searchAirports(query) {
      if (query.trim().length < 2) return [];
      airportSearching.value = true;
      try {
        return await client.searchNavAirports(query.trim());
      } finally {
        airportSearching.value = false;
      }
    }
    async function searchDepartureAirports(query) {
      departureAirportOptions.value = await searchAirports(query);
    }
    async function searchDestinationAirports(query) {
      destinationAirportOptions.value = await searchAirports(query);
    }
    async function loadDepartureProcedures() {
      const ident = draft.departureAirport.trim().toUpperCase();
      departureProcedures.value = ident ? await client.getNavAirportProcedures(ident) : EMPTY_PROCEDURES;
    }
    async function loadDestinationProcedures() {
      const ident = draft.destinationAirport.trim().toUpperCase();
      destinationProcedures.value = ident ? await client.getNavAirportProcedures(ident) : EMPTY_PROCEDURES;
    }
    async function buildFlightPlan() {
      if (!draft.departureAirport || !draft.destinationAirport) {
        ElMessage.warning(`${t("flightPlan.departureAirport")} / ${t("flightPlan.destinationAirport")}`);
        return;
      }
      planBuilding.value = true;
      try {
        flightPlanResult.value = await client.buildFlightPlan({ ...draft });
        persistStoredFlightPlanResult(flightPlanResult.value);
        fitRoute();
        ElMessage.success(t("feedback.updated"));
      } catch {
        ElMessage.error(t("flightPlan.error"));
      } finally {
        planBuilding.value = false;
      }
    }
    async function importSimBrief() {
      simbriefLoading.value = true;
      try {
        const result = await client.importSimBrief({
          username: settings.value?.simbrief.username,
          userId: settings.value?.simbrief.userId
        });
        Object.assign(draft, {
          departureAirport: result.departureAirport,
          destinationAirport: result.destinationAirport,
          enrouteText: result.routeText,
          departureRunway: result.departureRunway,
          arrivalRunway: result.arrivalRunway,
          departureProcedureId: null,
          arrivalProcedureId: null,
          approachProcedureId: null,
          arrivalTransitionId: null
        });
        departureAirportOptions.value = [
          { ident: result.departureAirport, name: result.departureAirport, city: null, country: null, lat: 0, lon: 0 }
        ];
        destinationAirportOptions.value = [
          { ident: result.destinationAirport, name: result.destinationAirport, city: null, country: null, lat: 0, lon: 0 }
        ];
        await Promise.all([loadDepartureProcedures(), loadDestinationProcedures()]);
        draft.departureProcedureId = findProcedureId(
          departureProcedures.value.departures,
          result.departureProcedureName
        );
        draft.arrivalProcedureId = findProcedureId(
          destinationProcedures.value.arrivals,
          result.arrivalProcedureName
        );
        draft.approachProcedureId = findProcedureId(
          destinationProcedures.value.approaches,
          result.approachProcedureName
        );
        draft.arrivalTransitionId = destinationProcedures.value.transitions.find(
          (value) => value.name === result.arrivalTransitionName
        )?.id ?? null;
        ElMessage.success(t("feedback.imported"));
      } catch {
        ElMessage.error(t("flightPlan.error"));
      } finally {
        simbriefLoading.value = false;
      }
    }
    function findProcedureId(items, name) {
      return items.find((item) => item.name === name)?.id ?? null;
    }
    function clearFlightPlan() {
      Object.assign(draft, {
        departureAirport: "",
        destinationAirport: "",
        enrouteText: "",
        departureRunway: null,
        departureProcedureId: null,
        arrivalRunway: null,
        arrivalProcedureId: null,
        approachProcedureId: null,
        arrivalTransitionId: null
      });
      departureProcedures.value = EMPTY_PROCEDURES;
      destinationProcedures.value = EMPTY_PROCEDURES;
      flightPlanResult.value = null;
      persistStoredFlightPlanResult(null);
    }
    function toggleChart(chartId) {
      activeChartId.value = activeChartId.value === chartId ? null : chartId;
    }
    function dockCardChartId(card) {
      return card.kind === "manual" ? card.chart.id : card.chartId;
    }
    function dockCardTagType(card) {
      if (card.kind === "manual" || card.state === "active") return "success";
      if (card.state === "missing-georef") return "warning";
      return "info";
    }
    function dockCardStateLabel(card) {
      if (card.kind === "manual") return t("mapMount.manual");
      if (card.state === "active") return t("mapMount.active");
      if (card.state === "missing-georef") return t("mapMount.noGeoref");
      return t("mapMount.noChart");
    }
    function dockCardActionLabel(card) {
      const chartId = dockCardChartId(card);
      if (chartId && activeChartId.value === chartId) return t("common.close");
      if (card.kind === "procedure" && card.state === "missing-chart") {
        return t("mapMount.goChartLibrary");
      }
      if (card.kind === "procedure" && card.state === "missing-georef") {
        return t("mapMount.goBindGeo");
      }
      return t("mapMount.activate");
    }
    function handleDockCard(card) {
      if (card.kind === "procedure" && card.state === "missing-chart") {
        chartsVisible.value = false;
        void router.push("/charts");
        return;
      }
      const chartId = dockCardChartId(card);
      if (!chartId) return;
      if (card.kind === "procedure" && card.state === "missing-georef") {
        chartsVisible.value = false;
        void router.push(`/charts/${chartId}`);
        return;
      }
      toggleChart(chartId);
    }
    async function renderChartOverlay(chartId) {
      chartOverlayCleanup?.();
      chartOverlayCleanup = null;
      if (!map || !chartId) return;
      const [asset, points] = await Promise.all([
        client.getChartAsset(chartId),
        client.getChartReferencePoints(chartId)
      ]);
      if (!asset || points.length < 2) return;
      const blob = asset.url ? await fetch(asset.url).then((response) => response.blob()) : asset.base64 ? base64ToBlob(asset.base64, asset.mimeType) : null;
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      const container = L.DomUtil.create("div", "chart-overlay-container", map.getPanes().overlayPane);
      const image = document.createElement("img");
      image.src = objectUrl;
      image.alt = "";
      image.style.position = "absolute";
      image.style.transformOrigin = "0 0";
      image.style.opacity = String((settings.value?.chartOpacity ?? 100) / 100);
      container.appendChild(image);
      const update = () => {
        if (!map) return;
        const [first, second] = points;
        const a = map.latLngToLayerPoint([first.mapLat, first.mapLon]);
        const b = map.latLngToLayerPoint([second.mapLat, second.mapLon]);
        const chartVector = { x: second.chartX - first.chartX, y: second.chartY - first.chartY };
        const mapVector = { x: b.x - a.x, y: b.y - a.y };
        const scale = Math.hypot(mapVector.x, mapVector.y) / Math.hypot(chartVector.x, chartVector.y);
        const angle = Math.atan2(mapVector.y, mapVector.x) - Math.atan2(chartVector.y, chartVector.x);
        const matrixA = scale * Math.cos(angle);
        const matrixB = scale * Math.sin(angle);
        const matrixC = -scale * Math.sin(angle);
        const matrixD = scale * Math.cos(angle);
        const matrixE = a.x - matrixA * first.chartX - matrixC * first.chartY;
        const matrixF = a.y - matrixB * first.chartX - matrixD * first.chartY;
        image.style.transform = `matrix(${matrixA}, ${matrixB}, ${matrixC}, ${matrixD}, ${matrixE}, ${matrixF})`;
      };
      image.onload = update;
      map.on("zoom viewreset move", update);
      chartOverlayCleanup = () => {
        map?.off("zoom viewreset move", update);
        container.remove();
        URL.revokeObjectURL(objectUrl);
      };
    }
    function readMapView() {
      try {
        const value = JSON.parse(window.localStorage.getItem(MAP_VIEW_KEY) || "");
        if (Number.isFinite(value.lat) && Number.isFinite(value.lon) && Number.isFinite(value.zoom)) {
          return value;
        }
      } catch {
      }
      return settings.value?.language === "en-US" ? { lat: 39.5, lon: -98.35, zoom: 5 } : { lat: 35.8, lon: 104.1, zoom: 5 };
    }
    function readNavLayers() {
      try {
        return {
          airports: false,
          airways: false,
          vors: false,
          ndbs: false,
          waypoints: false,
          ...JSON.parse(window.localStorage.getItem(NAV_LAYERS_KEY) || "{}")
        };
      } catch {
        return { airports: false, airways: false, vors: false, ndbs: false, waypoints: false };
      }
    }
    function base64ToBlob(base64, mimeType) {
      const binary = atob(base64);
      return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], {
        type: mimeType
      });
    }
    function formatNumber(value) {
      return Number.isFinite(value) ? Math.round(value).toLocaleString() : "-";
    }
    return (_ctx, _cache) => {
      const _component_el_tag = resolveComponent("el-tag");
      const _component_el_text = resolveComponent("el-text");
      const _component_el_space = resolveComponent("el-space");
      const _component_el_autocomplete = resolveComponent("el-autocomplete");
      const _component_el_button = resolveComponent("el-button");
      const _component_el_button_group = resolveComponent("el-button-group");
      const _component_el_option = resolveComponent("el-option");
      const _component_el_select = resolveComponent("el-select");
      const _component_el_card = resolveComponent("el-card");
      const _component_el_descriptions_item = resolveComponent("el-descriptions-item");
      const _component_el_descriptions = resolveComponent("el-descriptions");
      const _component_el_alert = resolveComponent("el-alert");
      const _component_el_divider = resolveComponent("el-divider");
      const _component_el_form_item = resolveComponent("el-form-item");
      const _component_el_input = resolveComponent("el-input");
      const _component_el_form = resolveComponent("el-form");
      const _component_el_drawer = resolveComponent("el-drawer");
      const _component_el_empty = resolveComponent("el-empty");
      const _component_el_table_column = resolveComponent("el-table-column");
      const _component_el_table = resolveComponent("el-table");
      return openBlock(), createElementBlock("section", _hoisted_1, [
        createBaseVNode("div", {
          ref_key: "mapElement",
          ref: mapElement,
          class: "map-canvas"
        }, null, 512),
        createVNode(_component_el_card, {
          shadow: "always",
          class: "map-toolbar"
        }, {
          default: withCtx(() => [
            createBaseVNode("div", _hoisted_2, [
              createVNode(_component_el_autocomplete, {
                modelValue: mapSearch.value,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => mapSearch.value = $event),
                "fetch-suggestions": searchMapPoints,
                "value-key": "ident",
                placeholder: unref(t)("map.searchPlaceholder"),
                clearable: "",
                onSelect: focusSearchResult
              }, {
                default: withCtx(({ item }) => [
                  createVNode(_component_el_space, null, {
                    default: withCtx(() => [
                      createVNode(_component_el_tag, { size: "small" }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(typeLabel(item.type)), 1)
                        ]),
                        _: 2
                      }, 1024),
                      createVNode(_component_el_text, null, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(item.ident) + " · " + toDisplayString(item.name || "-"), 1)
                        ]),
                        _: 2
                      }, 1024)
                    ]),
                    _: 2
                  }, 1024)
                ]),
                _: 1
              }, 8, ["modelValue", "placeholder"]),
              createVNode(_component_el_button_group, null, {
                default: withCtx(() => [
                  (openBlock(), createElementBlock(Fragment, null, renderList(layerOptions, (layer) => {
                    return createVNode(_component_el_button, {
                      key: layer.key,
                      type: navLayers[layer.key] ? "primary" : "default",
                      onClick: ($event) => toggleNavLayer(layer.key)
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(layer.label), 1)
                      ]),
                      _: 2
                    }, 1032, ["type", "onClick"]);
                  }), 64))
                ]),
                _: 1
              }),
              settings.value ? (openBlock(), createBlock(_component_el_select, {
                key: 0,
                "model-value": settings.value.mapTileProvider,
                class: "provider-select",
                onChange: changeMapProvider
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(providerOptions.value, (provider) => {
                    return openBlock(), createBlock(_component_el_option, {
                      key: provider.value,
                      value: provider.value,
                      label: provider.label
                    }, null, 8, ["value", "label"]);
                  }), 128))
                ]),
                _: 1
              }, 8, ["model-value"])) : createCommentVNode("", true),
              createVNode(_component_el_tag, {
                type: connection.value?.connected ? "success" : "info"
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(connection.value?.connected ? unref(t)("status.connected") : unref(t)("status.disconnected")), 1)
                ]),
                _: 1
              }, 8, ["type"])
            ])
          ]),
          _: 1
        }),
        createVNode(_component_el_button_group, { class: "map-controls" }, {
          default: withCtx(() => [
            createVNode(_component_el_button, {
              icon: unref(aim_default),
              disabled: !aircraft.value?.connected,
              type: followAircraft.value ? "primary" : "default",
              title: followAircraft.value ? unref(t)("map.followAircraftStop") : unref(t)("map.followAircraftStart"),
              onClick: toggleFollow
            }, null, 8, ["icon", "disabled", "type", "title"]),
            createVNode(_component_el_button, {
              icon: unref(full_screen_default),
              disabled: routePoints.value.length === 0,
              title: unref(t)("map.fitRoute"),
              onClick: fitRoute
            }, null, 8, ["icon", "disabled", "title"])
          ]),
          _: 1
        }),
        createVNode(_component_el_space, {
          class: "map-actions",
          direction: "vertical"
        }, {
          default: withCtx(() => [
            createVNode(_component_el_button, {
              type: "primary",
              icon: unref(promotion_default),
              onClick: _cache[1] || (_cache[1] = ($event) => flightPlanVisible.value = true)
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("flightPlan.title")), 1)
              ]),
              _: 1
            }, 8, ["icon"]),
            createVNode(_component_el_button, {
              icon: unref(files_default),
              onClick: _cache[2] || (_cache[2] = ($event) => chartsVisible.value = true)
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("nav.charts")), 1)
              ]),
              _: 1
            }, 8, ["icon"])
          ]),
          _: 1
        }),
        createVNode(_component_el_card, {
          shadow: "always",
          class: "flight-status"
        }, {
          default: withCtx(() => [
            createVNode(_component_el_descriptions, {
              column: 2,
              size: "small"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_descriptions_item, {
                  label: unref(t)("status.altitude")
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(formatNumber(aircraft.value?.altitudeFt)) + " ft ", 1)
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_descriptions_item, {
                  label: unref(t)("status.speed")
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(formatNumber(aircraft.value?.groundSpeedKts)) + " kt ", 1)
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_descriptions_item, {
                  label: unref(t)("status.heading")
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(formatNumber(aircraft.value?.headingDeg)) + "° ", 1)
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_descriptions_item, {
                  label: unref(t)("status.source")
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(aircraft.value?.source || "-"), 1)
                  ]),
                  _: 1
                }, 8, ["label"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }),
        createVNode(_component_el_drawer, {
          modelValue: flightPlanVisible.value,
          "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => flightPlanVisible.value = $event),
          title: unref(t)("flightPlan.title"),
          size: "480"
        }, {
          footer: withCtx(() => [
            createBaseVNode("div", _hoisted_3, [
              createVNode(_component_el_button, {
                loading: simbriefLoading.value,
                onClick: importSimBrief
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(t)("flightPlan.importSimbrief")), 1)
                ]),
                _: 1
              }, 8, ["loading"]),
              createVNode(_component_el_button, { onClick: clearFlightPlan }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(t)("flightPlan.clear")), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_button, {
                type: "primary",
                loading: planBuilding.value,
                onClick: buildFlightPlan
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(t)("flightPlan.build")), 1)
                ]),
                _: 1
              }, 8, ["loading"])
            ])
          ]),
          default: withCtx(() => [
            navStatus.value && !navStatus.value.exists ? (openBlock(), createBlock(_component_el_alert, {
              key: 0,
              title: unref(t)("flightPlan.navDataRequired"),
              description: unref(t)("flightPlan.navDataRequiredHint"),
              type: "warning",
              "show-icon": "",
              closable: false
            }, null, 8, ["title", "description"])) : createCommentVNode("", true),
            createVNode(_component_el_form, {
              "label-position": "top",
              class: "drawer-form"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_divider, { "content-position": "left" }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(t)("flightPlan.departureSection")), 1)
                  ]),
                  _: 1
                }),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.departureAirport")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.departureAirport,
                      "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => draft.departureAirport = $event),
                      filterable: "",
                      remote: "",
                      "reserve-keyword": "",
                      "remote-method": searchDepartureAirports,
                      loading: airportSearching.value,
                      onChange: loadDepartureProcedures
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(departureAirportOptions.value, (airport) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: airport.ident,
                            value: airport.ident,
                            label: `${airport.ident} · ${airport.name}`
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue", "loading"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.departureRunway")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.departureRunway,
                      "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => draft.departureRunway = $event),
                      clearable: ""
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(departureProcedures.value.runways, (runway) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: runway.name,
                            value: runway.name,
                            label: runway.displayName
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.departureProcedure")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.departureProcedureId,
                      "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => draft.departureProcedureId = $event),
                      clearable: "",
                      filterable: ""
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(filteredDepartures.value, (procedure) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: procedure.id,
                            value: procedure.id,
                            label: procedure.name
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_divider, { "content-position": "left" }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(t)("flightPlan.routeSection")), 1)
                  ]),
                  _: 1
                }),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.enroute")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_input, {
                      modelValue: draft.enrouteText,
                      "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => draft.enrouteText = $event),
                      type: "textarea",
                      rows: 4,
                      placeholder: unref(t)("flightPlan.enroutePlaceholder")
                    }, null, 8, ["modelValue", "placeholder"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_divider, { "content-position": "left" }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(t)("flightPlan.arrivalSection")), 1)
                  ]),
                  _: 1
                }),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.destinationAirport")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.destinationAirport,
                      "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => draft.destinationAirport = $event),
                      filterable: "",
                      remote: "",
                      "reserve-keyword": "",
                      "remote-method": searchDestinationAirports,
                      loading: airportSearching.value,
                      onChange: loadDestinationProcedures
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(destinationAirportOptions.value, (airport) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: airport.ident,
                            value: airport.ident,
                            label: `${airport.ident} · ${airport.name}`
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue", "loading"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.arrivalRunway")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.arrivalRunway,
                      "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => draft.arrivalRunway = $event),
                      clearable: ""
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(destinationProcedures.value.runways, (runway) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: runway.name,
                            value: runway.name,
                            label: runway.displayName
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.arrivalProcedure")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.arrivalProcedureId,
                      "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => draft.arrivalProcedureId = $event),
                      clearable: "",
                      filterable: ""
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(filteredArrivals.value, (procedure) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: procedure.id,
                            value: procedure.id,
                            label: procedure.name
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.approachProcedure")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.approachProcedureId,
                      "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => draft.approachProcedureId = $event),
                      clearable: "",
                      filterable: ""
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(filteredApproaches.value, (procedure) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: procedure.id,
                            value: procedure.id,
                            label: procedure.name
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_form_item, {
                  label: unref(t)("flightPlan.arrivalTransition")
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: draft.arrivalTransitionId,
                      "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => draft.arrivalTransitionId = $event),
                      clearable: "",
                      filterable: ""
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(destinationProcedures.value.transitions, (transition) => {
                          return openBlock(), createBlock(_component_el_option, {
                            key: transition.id,
                            value: transition.id,
                            label: transition.name
                          }, null, 8, ["value", "label"]);
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"])
              ]),
              _: 1
            }),
            flightPlanResult.value?.unresolvedTokens.length ? (openBlock(), createBlock(_component_el_alert, {
              key: 1,
              title: unref(t)("flightPlan.unresolved"),
              description: flightPlanResult.value.unresolvedTokens.join(", "),
              type: "warning",
              "show-icon": ""
            }, null, 8, ["title", "description"])) : createCommentVNode("", true)
          ]),
          _: 1
        }, 8, ["modelValue", "title"]),
        createVNode(_component_el_drawer, {
          modelValue: chartsVisible.value,
          "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => chartsVisible.value = $event),
          title: unref(t)("nav.charts"),
          size: "420"
        }, {
          footer: withCtx(() => [
            createVNode(_component_el_button, {
              onClick: _cache[13] || (_cache[13] = ($event) => unref(router).push("/charts"))
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("mapMount.goChartLibrary")), 1)
              ]),
              _: 1
            })
          ]),
          default: withCtx(() => [
            dockCards.value.length === 0 ? (openBlock(), createBlock(_component_el_empty, {
              key: 0,
              description: unref(t)("charts.emptyDescription")
            }, null, 8, ["description"])) : (openBlock(), createBlock(_component_el_table, {
              key: 1,
              data: dockCards.value,
              "highlight-current-row": ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_table_column, {
                  label: unref(t)("chartDetail.fieldTitle")
                }, {
                  default: withCtx(({ row }) => [
                    createTextVNode(toDisplayString(row.kind === "manual" ? row.chart.title : `${row.airportCode} · ${row.procedureName}`), 1)
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_table_column, {
                  label: unref(t)("chartDetail.fieldChartType"),
                  width: "110"
                }, {
                  default: withCtx(({ row }) => [
                    createVNode(_component_el_tag, {
                      type: dockCardTagType(row)
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(dockCardStateLabel(row)), 1)
                      ]),
                      _: 2
                    }, 1032, ["type"])
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_table_column, { width: "150" }, {
                  default: withCtx(({ row }) => [
                    createVNode(_component_el_button, {
                      type: activeChartId.value === dockCardChartId(row) ? "primary" : "default",
                      onClick: ($event) => handleDockCard(row)
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(dockCardActionLabel(row)), 1)
                      ]),
                      _: 2
                    }, 1032, ["type", "onClick"])
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"]))
          ]),
          _: 1
        }, 8, ["modelValue", "title"])
      ]);
    };
  }
});
const MapView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-6ebf1bad"]]);
export {
  MapView as default
};
