import { w as watch, c as onBeforeUnmount, b as ref, d as defineComponent, a as useI18n, o as onMounted, n as nextTick, E as ElMessage, L as withDirectives, g as createElementBlock, h as createBaseVNode, i as createVNode, j as withCtx, k as unref, p as createBlock, q as createCommentVNode, z as getAppClient, u as useRouter, A as computed, r as reactive, e as resolveComponent, M as resolveDirective, f as openBlock, l as createTextVNode, t as toDisplayString, N as arrow_left_default, O as delete_default, P as check_default, F as Fragment, m as renderList, Q as normalizeStyle, R as position_default, B as useAppState, _ as _export_sfc } from "./index-CvrMHZCP.js";
import { L, g as getMapTileConfig } from "./mapTileProviders-Dh9-3nFD.js";
import { a as __webpack_exports__GlobalWorkerOptions, _ as __webpack_exports__getDocument, n as notifyChartChanged } from "./chartSync-ClYV-2kA.js";
__webpack_exports__GlobalWorkerOptions.workerSrc = new URL("" + new URL("pdf.worker.min-yatZIOMy.mjs", import.meta.url).href, import.meta.url).toString();
function useChartAsset(asset) {
  const url = ref(null);
  const width = ref(null);
  const height = ref(null);
  const loading = ref(false);
  const error = ref(null);
  let currentObjectUrl = null;
  let runId = 0;
  function clearObjectUrl() {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  watch(
    asset,
    async (value) => {
      const id = ++runId;
      clearObjectUrl();
      url.value = null;
      width.value = null;
      height.value = null;
      error.value = null;
      if (!value) return;
      loading.value = true;
      try {
        const blob = value.url ? await fetch(value.url).then((response) => response.blob()) : value.base64 ? base64ToBlob(value.base64, value.mimeType) : null;
        if (!blob) throw new Error("EMPTY_CHART_ASSET");
        const result = value.fileFormat === "pdf" ? await renderPdf(blob) : await renderImage(blob);
        if (id !== runId) {
          URL.revokeObjectURL(result.url);
          return;
        }
        currentObjectUrl = result.url;
        url.value = result.url;
        width.value = result.width;
        height.value = result.height;
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : "CHART_RENDER_FAILED";
      } finally {
        if (id === runId) loading.value = false;
      }
    },
    { immediate: true }
  );
  onBeforeUnmount(clearObjectUrl);
  return { url, width, height, loading, error };
}
function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], {
    type: mimeType
  });
}
async function renderImage(blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const dimensions = await new Promise((resolve, reject) => {
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = url;
  });
  return { url, ...dimensions };
}
async function renderPdf(blob) {
  const task = __webpack_exports__getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  try {
    const page = await (await task.promise).getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    const output = await new Promise(
      (resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PDF_RENDER_FAILED")))
    );
    return { url: URL.createObjectURL(output), width: canvas.width, height: canvas.height };
  } finally {
    void task.destroy();
  }
}
function mapToLocal(lat, lon, refLat) {
  const cosLat = Math.cos(refLat * Math.PI / 180);
  return {
    x: lon * cosLat,
    y: -lat
  };
}
function getChartTransform(points) {
  if (points.length !== 2) return null;
  const [p1, p2] = points;
  const mapA = mapToLocal(p1.mapLat, p1.mapLon, p1.mapLat);
  const mapB = mapToLocal(p2.mapLat, p2.mapLon, p1.mapLat);
  const vMap = {
    x: mapB.x - mapA.x,
    y: mapB.y - mapA.y
  };
  const vChart = {
    x: p2.chartX - p1.chartX,
    y: p2.chartY - p1.chartY
  };
  const mapLen = Math.hypot(vMap.x, vMap.y);
  const chartLen = Math.hypot(vChart.x, vChart.y);
  if (mapLen === 0 || chartLen === 0) return null;
  return {
    scale: chartLen / mapLen,
    angleRad: Math.atan2(vChart.y, vChart.x) - Math.atan2(vMap.y, vMap.x),
    chartOrigin: { x: p1.chartX, y: p1.chartY },
    mapOrigin: mapA
  };
}
function projectAircraftToChart(aircraft, points) {
  if (!aircraft || points.length !== 2) return null;
  if (!aircraft.connected) return null;
  if (!Number.isFinite(aircraft.lat) || !Number.isFinite(aircraft.lon)) return null;
  if (Math.abs(aircraft.lat) > 90 || Math.abs(aircraft.lon) > 180) return null;
  if (aircraft.lat === 0 && aircraft.lon === 0 && aircraft.altitudeFt === 0) return null;
  const [p1] = points;
  const transform = getChartTransform(points);
  if (!transform) return null;
  const mapP = mapToLocal(aircraft.lat, aircraft.lon, p1.mapLat);
  const relative = {
    x: mapP.x - transform.mapOrigin.x,
    y: mapP.y - transform.mapOrigin.y
  };
  const rotated = {
    x: (relative.x * Math.cos(transform.angleRad) - relative.y * Math.sin(transform.angleRad)) * transform.scale,
    y: (relative.x * Math.sin(transform.angleRad) + relative.y * Math.cos(transform.angleRad)) * transform.scale
  };
  return {
    x: transform.chartOrigin.x + rotated.x,
    y: transform.chartOrigin.y + rotated.y
  };
}
const _hoisted_1 = { class: "page-container chart-detail" };
const _hoisted_2 = { class: "page-header" };
const _hoisted_3 = { class: "page-actions" };
const _hoisted_4 = { class: "page-actions" };
const _hoisted_5 = { class: "point-actions" };
const _hoisted_6 = { class: "map-search" };
const _hoisted_7 = { class: "chart-toolbar" };
const _hoisted_8 = { class: "chart-image-scroll" };
const _hoisted_9 = ["src", "alt"];
const _hoisted_10 = ["title"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ChartDetailView",
  props: {
    chartId: {}
  },
  setup(__props) {
    const props = __props;
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
    const settings = computed(() => appState.settings.value);
    const loading = ref(true);
    const chart = ref(null);
    const asset = ref(null);
    const { url: assetUrl, loading: assetLoading, error: assetError } = useChartAsset(asset);
    const procedures = ref(EMPTY_PROCEDURES);
    const metadata = reactive({
      title: "",
      airportCode: "",
      chartType: "general",
      titleMode: "manual",
      boundRunwayNames: [],
      boundApproachProcedureIds: []
    });
    const chartTypes = ["general", "airport", "sid", "star", "approach"];
    const bindable = computed(() => ["sid", "star", "approach"].includes(metadata.chartType));
    const availableProcedures = computed(() => {
      const source = metadata.chartType === "sid" ? procedures.value.departures : metadata.chartType === "star" ? procedures.value.arrivals : procedures.value.approaches;
      if (metadata.boundRunwayNames.length === 0) return source;
      return source.filter(
        (item) => !item.runwayName || metadata.boundRunwayNames.includes(item.runwayName)
      );
    });
    const procedureLabel = computed(
      () => metadata.chartType === "sid" ? t("flightPlan.departureProcedure") : metadata.chartType === "star" ? t("flightPlan.arrivalProcedure") : t("flightPlan.approachProcedure")
    );
    const activePanel = ref("map");
    const mapElement = ref();
    const mapSearch = ref("");
    const mapPoints = ref([]);
    const chartPoints = ref([]);
    const aircraftChartPoint = computed(() => {
      if (mapPoints.value.length !== 2 || chartPoints.value.length !== 2) return null;
      return projectAircraftToChart(
        aircraft.value,
        [0, 1].map((index) => ({
          id: "",
          chartId: props.chartId,
          index: index + 1,
          mapLat: mapPoints.value[index].lat,
          mapLon: mapPoints.value[index].lon,
          chartX: chartPoints.value[index].x,
          chartY: chartPoints.value[index].y
        }))
      );
    });
    const imageZoom = ref(100);
    const imageStage = ref();
    const deleteDialogVisible = ref(false);
    const deleteConfirmation = ref("");
    let map = null;
    let markerLayer = null;
    watch(activePanel, async (value) => {
      if (value === "map") {
        await nextTick();
        initializeMap();
        map?.invalidateSize();
      }
    });
    watch(mapPoints, renderMapPoints, { deep: true });
    onMounted(async () => {
      try {
        await loadChart();
      } finally {
        loading.value = false;
      }
      await nextTick();
      initializeMap();
    });
    onBeforeUnmount(() => map?.remove());
    async function loadChart() {
      const [record, chartAsset, points] = await Promise.all([
        client.getChart(props.chartId),
        client.getChartAsset(props.chartId),
        client.getChartReferencePoints(props.chartId)
      ]);
      if (!record) {
        ElMessage.error(t("chartPreview.noAssetTitle"));
        await router.replace("/charts");
        return;
      }
      chart.value = record;
      asset.value = chartAsset;
      Object.assign(metadata, {
        title: record.title,
        airportCode: record.airportCode ?? "",
        chartType: record.chartType,
        titleMode: record.titleMode,
        boundRunwayNames: [...record.boundRunwayNames],
        boundApproachProcedureIds: [...record.boundApproachProcedureIds]
      });
      mapPoints.value = points.sort((left, right) => left.index - right.index).map((point) => ({ lat: point.mapLat, lon: point.mapLon }));
      chartPoints.value = points.sort((left, right) => left.index - right.index).map((point) => ({ x: point.chartX, y: point.chartY }));
      await loadProcedures();
    }
    function initializeMap() {
      if (map || !mapElement.value) return;
      const center = mapPoints.value[0] ?? (aircraft.value?.connected ? { lat: aircraft.value.lat, lon: aircraft.value.lon } : { lat: 35.8, lon: 104.1 });
      map = L.map(mapElement.value).setView([center.lat, center.lon], mapPoints.value.length ? 10 : 5);
      const tile = getMapTileConfig(settings.value?.mapTileProvider);
      L.tileLayer(tile.url, {
        attribution: tile.attribution,
        ...tile.subdomains ? { subdomains: tile.subdomains } : {}
      }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);
      map.on("click", (event) => {
        if (mapPoints.value.length >= 2) return;
        mapPoints.value = [...mapPoints.value, { lat: event.latlng.lat, lon: event.latlng.lng }];
      });
      renderMapPoints();
    }
    function renderMapPoints() {
      if (!markerLayer) return;
      const targetLayer = markerLayer;
      targetLayer.clearLayers();
      mapPoints.value.forEach((point, index) => {
        L.circleMarker([point.lat, point.lon], {
          radius: 7,
          color: "var(--el-color-primary)",
          fillColor: "var(--el-color-primary)",
          fillOpacity: 1
        }).bindTooltip(String(index + 1), { permanent: true }).addTo(targetLayer);
      });
      if (map && mapPoints.value.length === 2) {
        map.fitBounds(L.latLngBounds(mapPoints.value.map((point) => [point.lat, point.lon])), {
          padding: [40, 40]
        });
      }
    }
    async function searchMapPoints(query, callback) {
      if (!query.trim()) {
        callback([]);
        return;
      }
      try {
        callback(
          await client.searchNavMapPoints({
            query,
            types: ["airports", "waypoints", "vors", "ndbs"],
            limit: 20
          })
        );
      } catch {
        callback([]);
      }
    }
    function focusMapPoint(item) {
      map?.setView([item.lat, item.lon], 12);
    }
    function captureAircraftPosition() {
      if (!aircraft.value?.connected || mapPoints.value.length >= 2) return;
      mapPoints.value = [
        ...mapPoints.value,
        { lat: aircraft.value.lat, lon: aircraft.value.lon }
      ];
    }
    function captureChartPoint(event) {
      if (chartPoints.value.length >= 2 || !imageStage.value || !assetUrl.value) return;
      const image = imageStage.value.querySelector("img");
      if (!(image instanceof HTMLImageElement)) return;
      const rect = image.getBoundingClientRect();
      chartPoints.value = [
        ...chartPoints.value,
        {
          x: (event.clientX - rect.left) / rect.width * image.naturalWidth,
          y: (event.clientY - rect.top) / rect.height * image.naturalHeight
        }
      ];
    }
    function chartPointStyle(point) {
      const image = imageStage.value?.querySelector("img");
      const width = image instanceof HTMLImageElement ? image.naturalWidth : 1;
      const height = image instanceof HTMLImageElement ? image.naturalHeight : 1;
      return { left: `${point.x / width * 100}%`, top: `${point.y / height * 100}%` };
    }
    function clearPoints() {
      mapPoints.value = [];
      chartPoints.value = [];
    }
    async function saveReferencePoints() {
      if (mapPoints.value.length !== 2 || chartPoints.value.length !== 2) return;
      const points = [0, 1].map((index) => ({
        id: "",
        chartId: props.chartId,
        index: index + 1,
        mapLat: mapPoints.value[index].lat,
        mapLon: mapPoints.value[index].lon,
        chartX: chartPoints.value[index].x,
        chartY: chartPoints.value[index].y
      }));
      await client.saveChartReferencePoints(props.chartId, points);
      await loadChart();
      notifyChartChanged();
      ElMessage.success(t("feedback.saved"));
    }
    async function loadProcedures() {
      const airport = metadata.airportCode.trim().toUpperCase();
      procedures.value = airport ? await client.getNavAirportProcedures(airport) : EMPTY_PROCEDURES;
    }
    function handleChartTypeChange() {
      if (!bindable.value) {
        metadata.titleMode = "manual";
        metadata.boundRunwayNames = [];
        metadata.boundApproachProcedureIds = [];
      }
    }
    async function saveMetadata() {
      if (!metadata.title.trim()) {
        ElMessage.warning(t("chartDetail.titleRequired"));
        return;
      }
      let title = metadata.title.trim();
      if (metadata.titleMode === "approach-procedure") {
        const selected = availableProcedures.value.filter(
          (item) => metadata.boundApproachProcedureIds.includes(item.id)
        );
        if (selected.length === 0) {
          ElMessage.warning(t("chartDetail.procedureRequired"));
          return;
        }
        title = selected.map((item) => item.name).join(" / ");
      }
      const updated = await client.updateChart({
        id: props.chartId,
        title,
        airportCode: metadata.airportCode.trim().toUpperCase() || null,
        chartType: metadata.chartType,
        titleMode: metadata.titleMode,
        boundRunwayNames: [...metadata.boundRunwayNames],
        boundApproachProcedureIds: [...metadata.boundApproachProcedureIds]
      });
      if (updated) chart.value = updated;
      metadata.title = title;
      notifyChartChanged();
      ElMessage.success(t("feedback.saved"));
    }
    async function deleteChart() {
      if (deleteConfirmation.value !== chart.value?.title) return;
      await client.deleteChart(props.chartId);
      notifyChartChanged();
      ElMessage.success(t("feedback.deleted"));
      await router.replace("/charts");
    }
    function formatCoordinate(value) {
      return value.toFixed(6);
    }
    return (_ctx, _cache) => {
      const _component_el_button = resolveComponent("el-button");
      const _component_el_text = resolveComponent("el-text");
      const _component_el_tag = resolveComponent("el-tag");
      const _component_el_input = resolveComponent("el-input");
      const _component_el_form_item = resolveComponent("el-form-item");
      const _component_el_option = resolveComponent("el-option");
      const _component_el_select = resolveComponent("el-select");
      const _component_el_radio_button = resolveComponent("el-radio-button");
      const _component_el_radio_group = resolveComponent("el-radio-group");
      const _component_el_form = resolveComponent("el-form");
      const _component_el_card = resolveComponent("el-card");
      const _component_el_step = resolveComponent("el-step");
      const _component_el_steps = resolveComponent("el-steps");
      const _component_el_descriptions_item = resolveComponent("el-descriptions-item");
      const _component_el_descriptions = resolveComponent("el-descriptions");
      const _component_el_col = resolveComponent("el-col");
      const _component_el_autocomplete = resolveComponent("el-autocomplete");
      const _component_el_alert = resolveComponent("el-alert");
      const _component_el_tab_pane = resolveComponent("el-tab-pane");
      const _component_el_slider = resolveComponent("el-slider");
      const _component_el_result = resolveComponent("el-result");
      const _component_el_icon = resolveComponent("el-icon");
      const _component_el_tabs = resolveComponent("el-tabs");
      const _component_el_row = resolveComponent("el-row");
      const _component_el_dialog = resolveComponent("el-dialog");
      const _directive_loading = resolveDirective("loading");
      return withDirectives((openBlock(), createElementBlock("section", _hoisted_1, [
        createBaseVNode("header", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            createVNode(_component_el_button, {
              icon: unref(arrow_left_default),
              onClick: _cache[0] || (_cache[0] = ($event) => unref(router).push("/charts"))
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("common.back")), 1)
              ]),
              _: 1
            }, 8, ["icon"]),
            createVNode(_component_el_text, { tag: "h2" }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(chart.value?.title || unref(t)("chartDetail.title")), 1)
              ]),
              _: 1
            }),
            chart.value ? (openBlock(), createBlock(_component_el_tag, {
              key: 0,
              type: chart.value.isGeoreferenced ? "success" : "info"
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(chart.value.isGeoreferenced ? unref(t)("charts.georeferenced") : unref(t)("charts.notGeoreferenced")), 1)
              ]),
              _: 1
            }, 8, ["type"])) : createCommentVNode("", true)
          ]),
          createBaseVNode("div", _hoisted_4, [
            createVNode(_component_el_button, {
              type: "danger",
              plain: "",
              icon: unref(delete_default),
              onClick: _cache[1] || (_cache[1] = ($event) => deleteDialogVisible.value = true)
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("chartDetail.delete")), 1)
              ]),
              _: 1
            }, 8, ["icon"]),
            createVNode(_component_el_button, {
              type: "primary",
              icon: unref(check_default),
              onClick: saveMetadata
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("chartDetail.saveMeta")), 1)
              ]),
              _: 1
            }, 8, ["icon"])
          ])
        ]),
        chart.value ? (openBlock(), createBlock(_component_el_row, {
          key: 0,
          gutter: 16
        }, {
          default: withCtx(() => [
            createVNode(_component_el_col, { span: 8 }, {
              default: withCtx(() => [
                createVNode(_component_el_card, { shadow: "never" }, {
                  header: withCtx(() => [
                    createTextVNode(toDisplayString(unref(t)("chartDetail.metaTitle")), 1)
                  ]),
                  default: withCtx(() => [
                    createVNode(_component_el_form, { "label-position": "top" }, {
                      default: withCtx(() => [
                        createVNode(_component_el_form_item, {
                          label: unref(t)("chartDetail.fieldTitle"),
                          required: ""
                        }, {
                          default: withCtx(() => [
                            createVNode(_component_el_input, {
                              modelValue: metadata.title,
                              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => metadata.title = $event)
                            }, null, 8, ["modelValue"])
                          ]),
                          _: 1
                        }, 8, ["label"]),
                        createVNode(_component_el_form_item, {
                          label: unref(t)("chartDetail.fieldAirportCode")
                        }, {
                          default: withCtx(() => [
                            createVNode(_component_el_input, {
                              modelValue: metadata.airportCode,
                              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => metadata.airportCode = $event),
                              onChange: loadProcedures
                            }, null, 8, ["modelValue"])
                          ]),
                          _: 1
                        }, 8, ["label"]),
                        createVNode(_component_el_form_item, {
                          label: unref(t)("chartDetail.fieldChartType")
                        }, {
                          default: withCtx(() => [
                            createVNode(_component_el_select, {
                              modelValue: metadata.chartType,
                              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => metadata.chartType = $event),
                              onChange: handleChartTypeChange
                            }, {
                              default: withCtx(() => [
                                (openBlock(), createElementBlock(Fragment, null, renderList(chartTypes, (type) => {
                                  return createVNode(_component_el_option, {
                                    key: type,
                                    value: type,
                                    label: unref(t)(`chartType.${type}`)
                                  }, null, 8, ["value", "label"]);
                                }), 64))
                              ]),
                              _: 1
                            }, 8, ["modelValue"])
                          ]),
                          _: 1
                        }, 8, ["label"]),
                        bindable.value ? (openBlock(), createBlock(_component_el_form_item, {
                          key: 0,
                          label: unref(t)("chartDetail.procedureModeTitle")
                        }, {
                          default: withCtx(() => [
                            createVNode(_component_el_radio_group, {
                              modelValue: metadata.titleMode,
                              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => metadata.titleMode = $event)
                            }, {
                              default: withCtx(() => [
                                createVNode(_component_el_radio_button, { value: "manual" }, {
                                  default: withCtx(() => [
                                    createTextVNode(toDisplayString(unref(t)("chartDetail.modeManual")), 1)
                                  ]),
                                  _: 1
                                }),
                                createVNode(_component_el_radio_button, { value: "approach-procedure" }, {
                                  default: withCtx(() => [
                                    createTextVNode(toDisplayString(unref(t)("chartDetail.modeProcedure")), 1)
                                  ]),
                                  _: 1
                                })
                              ]),
                              _: 1
                            }, 8, ["modelValue"])
                          ]),
                          _: 1
                        }, 8, ["label"])) : createCommentVNode("", true),
                        metadata.titleMode === "approach-procedure" && bindable.value ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                          createVNode(_component_el_form_item, {
                            label: unref(t)("chartDetail.procedureRunway")
                          }, {
                            default: withCtx(() => [
                              createVNode(_component_el_select, {
                                modelValue: metadata.boundRunwayNames,
                                "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => metadata.boundRunwayNames = $event),
                                multiple: "",
                                clearable: ""
                              }, {
                                default: withCtx(() => [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(procedures.value.runways, (runway) => {
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
                          createVNode(_component_el_form_item, { label: procedureLabel.value }, {
                            default: withCtx(() => [
                              createVNode(_component_el_select, {
                                modelValue: metadata.boundApproachProcedureIds,
                                "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => metadata.boundApproachProcedureIds = $event),
                                multiple: "",
                                clearable: "",
                                filterable: ""
                              }, {
                                default: withCtx(() => [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(availableProcedures.value, (procedure) => {
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
                          }, 8, ["label"])
                        ], 64)) : createCommentVNode("", true)
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                createVNode(_component_el_card, {
                  shadow: "never",
                  class: "point-card"
                }, {
                  header: withCtx(() => [
                    createTextVNode(toDisplayString(unref(t)("chartDetail.saveReference")), 1)
                  ]),
                  default: withCtx(() => [
                    createVNode(_component_el_steps, {
                      active: Math.min(mapPoints.value.length, chartPoints.value.length),
                      "finish-status": "success"
                    }, {
                      default: withCtx(() => [
                        createVNode(_component_el_step, {
                          title: `${unref(t)("chartDetail.mapPickerTitle")} ${mapPoints.value.length}/2`
                        }, null, 8, ["title"]),
                        createVNode(_component_el_step, {
                          title: `${unref(t)("chartDetail.viewerTitle")} ${chartPoints.value.length}/2`
                        }, null, 8, ["title"])
                      ]),
                      _: 1
                    }, 8, ["active"]),
                    createVNode(_component_el_descriptions, {
                      column: 1,
                      border: "",
                      size: "small"
                    }, {
                      default: withCtx(() => [
                        (openBlock(), createElementBlock(Fragment, null, renderList(2, (index) => {
                          return createVNode(_component_el_descriptions_item, {
                            key: index,
                            label: `Point ${index}`
                          }, {
                            default: withCtx(() => [
                              mapPoints.value[index - 1] && chartPoints.value[index - 1] ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                createTextVNode(toDisplayString(formatCoordinate(mapPoints.value[index - 1].lat)) + ", " + toDisplayString(formatCoordinate(mapPoints.value[index - 1].lon)) + " ↔ " + toDisplayString(Math.round(chartPoints.value[index - 1].x)) + ", " + toDisplayString(Math.round(chartPoints.value[index - 1].y)), 1)
                              ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                createTextVNode("-")
                              ], 64))
                            ]),
                            _: 2
                          }, 1032, ["label"]);
                        }), 64))
                      ]),
                      _: 1
                    }),
                    createBaseVNode("div", _hoisted_5, [
                      createVNode(_component_el_button, {
                        disabled: !aircraft.value?.connected || mapPoints.value.length >= 2,
                        onClick: captureAircraftPosition
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(unref(t)("chartDetail.captureFromAircraft")), 1)
                        ]),
                        _: 1
                      }, 8, ["disabled"]),
                      createVNode(_component_el_button, { onClick: clearPoints }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(unref(t)("chartDetail.clearMapPoints")), 1)
                        ]),
                        _: 1
                      }),
                      createVNode(_component_el_button, {
                        type: "primary",
                        disabled: mapPoints.value.length !== 2 || chartPoints.value.length !== 2,
                        onClick: saveReferencePoints
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(unref(t)("chartDetail.saveReference")), 1)
                        ]),
                        _: 1
                      }, 8, ["disabled"])
                    ])
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_component_el_col, { span: 16 }, {
              default: withCtx(() => [
                createVNode(_component_el_tabs, {
                  modelValue: activePanel.value,
                  "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => activePanel.value = $event),
                  type: "border-card",
                  class: "workspace-tabs"
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_tab_pane, {
                      name: "map",
                      label: unref(t)("chartDetail.mapPickerTitle")
                    }, {
                      default: withCtx(() => [
                        createBaseVNode("div", _hoisted_6, [
                          createVNode(_component_el_autocomplete, {
                            modelValue: mapSearch.value,
                            "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => mapSearch.value = $event),
                            "fetch-suggestions": searchMapPoints,
                            "value-key": "ident",
                            placeholder: unref(t)("map.searchPlaceholder"),
                            onSelect: focusMapPoint
                          }, null, 8, ["modelValue", "placeholder"]),
                          createVNode(_component_el_alert, {
                            title: unref(t)("chartDetail.countMap", { count: mapPoints.value.length }),
                            type: "info",
                            closable: false
                          }, null, 8, ["title"])
                        ]),
                        createBaseVNode("div", {
                          ref_key: "mapElement",
                          ref: mapElement,
                          class: "reference-map"
                        }, null, 512)
                      ]),
                      _: 1
                    }, 8, ["label"]),
                    createVNode(_component_el_tab_pane, {
                      name: "chart",
                      label: unref(t)("chartDetail.viewerTitle")
                    }, {
                      default: withCtx(() => [
                        createBaseVNode("div", _hoisted_7, [
                          createVNode(_component_el_slider, {
                            modelValue: imageZoom.value,
                            "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => imageZoom.value = $event),
                            min: 25,
                            max: 200,
                            step: 25,
                            "show-stops": ""
                          }, null, 8, ["modelValue"]),
                          createVNode(_component_el_button, {
                            onClick: _cache[10] || (_cache[10] = ($event) => imageZoom.value = 100)
                          }, {
                            default: withCtx(() => [
                              createTextVNode(toDisplayString(unref(t)("chartPreview.resetZoom")), 1)
                            ]),
                            _: 1
                          }),
                          createVNode(_component_el_alert, {
                            title: unref(t)("chartDetail.countChart", { count: chartPoints.value.length }),
                            type: "info",
                            closable: false
                          }, null, 8, ["title"])
                        ]),
                        withDirectives((openBlock(), createElementBlock("div", _hoisted_8, [
                          unref(assetError) ? (openBlock(), createBlock(_component_el_result, {
                            key: 0,
                            icon: "error",
                            title: unref(t)("chartPreview.noAssetTitle"),
                            "sub-title": unref(assetError)
                          }, null, 8, ["title", "sub-title"])) : unref(assetUrl) ? (openBlock(), createElementBlock("div", {
                            key: 1,
                            ref_key: "imageStage",
                            ref: imageStage,
                            class: "chart-image-stage",
                            style: normalizeStyle({ width: `${imageZoom.value}%` }),
                            onClick: captureChartPoint
                          }, [
                            createBaseVNode("img", {
                              src: unref(assetUrl),
                              alt: chart.value.title,
                              draggable: "false"
                            }, null, 8, _hoisted_9),
                            (openBlock(true), createElementBlock(Fragment, null, renderList(chartPoints.value, (point, index) => {
                              return openBlock(), createElementBlock("span", {
                                key: index,
                                class: "chart-point",
                                style: normalizeStyle(chartPointStyle(point))
                              }, toDisplayString(index + 1), 5);
                            }), 128)),
                            aircraftChartPoint.value ? (openBlock(), createElementBlock("span", {
                              key: 0,
                              class: "chart-aircraft",
                              style: normalizeStyle(chartPointStyle(aircraftChartPoint.value)),
                              title: unref(t)("map.aircraftMarker")
                            }, [
                              createVNode(_component_el_icon, null, {
                                default: withCtx(() => [
                                  createVNode(unref(position_default))
                                ]),
                                _: 1
                              })
                            ], 12, _hoisted_10)) : createCommentVNode("", true)
                          ], 4)) : createCommentVNode("", true)
                        ])), [
                          [_directive_loading, unref(assetLoading)]
                        ])
                      ]),
                      _: 1
                    }, 8, ["label"])
                  ]),
                  _: 1
                }, 8, ["modelValue"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })) : createCommentVNode("", true),
        createVNode(_component_el_dialog, {
          modelValue: deleteDialogVisible.value,
          "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => deleteDialogVisible.value = $event),
          title: unref(t)("chartDetail.deleteDialogTitle"),
          width: "480"
        }, {
          footer: withCtx(() => [
            createVNode(_component_el_button, {
              onClick: _cache[13] || (_cache[13] = ($event) => deleteDialogVisible.value = false)
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("common.cancel")), 1)
              ]),
              _: 1
            }),
            createVNode(_component_el_button, {
              type: "danger",
              disabled: deleteConfirmation.value !== chart.value?.title,
              onClick: deleteChart
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("chartDetail.confirmDelete")), 1)
              ]),
              _: 1
            }, 8, ["disabled"])
          ]),
          default: withCtx(() => [
            createVNode(_component_el_alert, {
              title: `${unref(t)("chartDetail.deletePromptPrefix")} ${chart.value?.title} ${unref(t)("chartDetail.deletePromptSuffix")}`,
              type: "warning",
              closable: false
            }, null, 8, ["title"]),
            createVNode(_component_el_input, {
              modelValue: deleteConfirmation.value,
              "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => deleteConfirmation.value = $event),
              class: "delete-input"
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        }, 8, ["modelValue", "title"])
      ])), [
        [_directive_loading, loading.value]
      ]);
    };
  }
});
const ChartDetailView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-7ca9b440"]]);
export {
  ChartDetailView as default
};
