import { d as defineComponent, a as useI18n, g as createElementBlock, h as createBaseVNode, i as createVNode, j as withCtx, k as unref, b as ref, e as resolveComponent, u as useRouter, f as openBlock, l as createTextVNode, t as toDisplayString, C as search_default, D as upload_default, G as link_default, p as createBlock, F as Fragment, m as renderList, H as withModifiers, I as edit_default, A as computed, E as ElMessage, _ as _export_sfc } from "./index-CvrMHZCP.js";
import { u as useChartLibrary } from "./useChartLibrary-BEvTMR3g.js";
import "./chartSync-ClYV-2kA.js";
const _hoisted_1 = { class: "page-container" };
const _hoisted_2 = { class: "page-header" };
const _hoisted_3 = { class: "page-actions" };
const _hoisted_4 = { class: "card-header" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ChartsView",
  setup(__props) {
    const { t } = useI18n();
    const router = useRouter();
    const { charts, storageSummary, loading, importChart, importChartFromUrl } = useChartLibrary();
    const search = ref("");
    const importUrl = ref("");
    const importing = ref(false);
    const urlDialogVisible = ref(false);
    const filteredCharts = computed(() => {
      const needle = search.value.trim().toLowerCase();
      if (!needle) return charts.value;
      return charts.value.filter(
        (chart) => [chart.title, chart.airportCode, chart.chartType, chart.fileFormat].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
      );
    });
    function openChart(chartId) {
      void router.push(`/charts/${chartId}`);
    }
    async function handleImport() {
      importing.value = true;
      try {
        const result = await importChart();
        if (result) {
          ElMessage.success(t("feedback.imported"));
          openChart(result.chart.id);
        }
      } catch {
        ElMessage.error(t("charts.importFailed"));
      } finally {
        importing.value = false;
      }
    }
    async function handleUrlImport() {
      const url = importUrl.value.trim();
      if (!/^https?:\/\//i.test(url)) {
        ElMessage.warning(t("charts.importUrlErrorInvalid"));
        return;
      }
      importing.value = true;
      try {
        const result = await importChartFromUrl(url);
        if (result) {
          urlDialogVisible.value = false;
          importUrl.value = "";
          ElMessage.success(t("feedback.imported"));
          openChart(result.chart.id);
        }
      } catch {
        ElMessage.error(t("charts.importUrlFailed"));
      } finally {
        importing.value = false;
      }
    }
    return (_ctx, _cache) => {
      const _component_el_text = resolveComponent("el-text");
      const _component_el_input = resolveComponent("el-input");
      const _component_el_button = resolveComponent("el-button");
      const _component_el_empty = resolveComponent("el-empty");
      const _component_el_tag = resolveComponent("el-tag");
      const _component_el_descriptions_item = resolveComponent("el-descriptions-item");
      const _component_el_descriptions = resolveComponent("el-descriptions");
      const _component_el_card = resolveComponent("el-card");
      const _component_el_col = resolveComponent("el-col");
      const _component_el_row = resolveComponent("el-row");
      const _component_el_skeleton = resolveComponent("el-skeleton");
      const _component_el_dialog = resolveComponent("el-dialog");
      return openBlock(), createElementBlock("section", _hoisted_1, [
        createBaseVNode("header", _hoisted_2, [
          createBaseVNode("div", null, [
            createVNode(_component_el_text, { tag: "h2" }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("nav.charts")), 1)
              ]),
              _: 1
            }),
            createVNode(_component_el_text, { type: "info" }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(storageSummary)?.chartsRoot), 1)
              ]),
              _: 1
            })
          ]),
          createBaseVNode("div", _hoisted_3, [
            createVNode(_component_el_input, {
              modelValue: search.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => search.value = $event),
              clearable: "",
              "prefix-icon": unref(search_default),
              placeholder: unref(t)("charts.searchPlaceholder")
            }, null, 8, ["modelValue", "prefix-icon", "placeholder"]),
            createVNode(_component_el_button, {
              type: "primary",
              icon: unref(upload_default),
              loading: importing.value,
              onClick: handleImport
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("charts.importAction")), 1)
              ]),
              _: 1
            }, 8, ["icon", "loading"]),
            createVNode(_component_el_button, {
              icon: unref(link_default),
              onClick: _cache[1] || (_cache[1] = ($event) => urlDialogVisible.value = true)
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("charts.importUrlToggle")), 1)
              ]),
              _: 1
            }, 8, ["icon"])
          ])
        ]),
        createVNode(_component_el_skeleton, {
          loading: unref(loading),
          animated: ""
        }, {
          default: withCtx(() => [
            filteredCharts.value.length === 0 ? (openBlock(), createBlock(_component_el_empty, {
              key: 0,
              description: search.value ? unref(t)("charts.searchEmpty") : unref(t)("charts.emptyDescription")
            }, null, 8, ["description"])) : (openBlock(), createBlock(_component_el_row, {
              key: 1,
              gutter: 16
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(filteredCharts.value, (chart) => {
                  return openBlock(), createBlock(_component_el_col, {
                    key: chart.id,
                    xs: 24,
                    sm: 12,
                    md: 8,
                    lg: 6
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_card, {
                        shadow: "hover",
                        class: "chart-card",
                        onClick: ($event) => openChart(chart.id)
                      }, {
                        header: withCtx(() => [
                          createBaseVNode("div", _hoisted_4, [
                            createVNode(_component_el_text, { truncated: "" }, {
                              default: withCtx(() => [
                                createTextVNode(toDisplayString(chart.title), 1)
                              ]),
                              _: 2
                            }, 1024),
                            createVNode(_component_el_tag, {
                              type: chart.isGeoreferenced ? "success" : "info"
                            }, {
                              default: withCtx(() => [
                                createTextVNode(toDisplayString(chart.isGeoreferenced ? unref(t)("charts.georeferenced") : unref(t)("charts.notGeoreferenced")), 1)
                              ]),
                              _: 2
                            }, 1032, ["type"])
                          ])
                        ]),
                        footer: withCtx(() => [
                          createVNode(_component_el_button, {
                            type: "primary",
                            text: "",
                            icon: unref(edit_default),
                            onClick: withModifiers(($event) => openChart(chart.id), ["stop"])
                          }, {
                            default: withCtx(() => [
                              createTextVNode(toDisplayString(unref(t)("chartDetail.editMeta")), 1)
                            ]),
                            _: 1
                          }, 8, ["icon", "onClick"])
                        ]),
                        default: withCtx(() => [
                          createVNode(_component_el_descriptions, {
                            column: 1,
                            size: "small"
                          }, {
                            default: withCtx(() => [
                              createVNode(_component_el_descriptions_item, {
                                label: unref(t)("chartDetail.fieldAirportCode")
                              }, {
                                default: withCtx(() => [
                                  createTextVNode(toDisplayString(chart.airportCode || "-"), 1)
                                ]),
                                _: 2
                              }, 1032, ["label"]),
                              createVNode(_component_el_descriptions_item, {
                                label: unref(t)("chartDetail.fieldChartType")
                              }, {
                                default: withCtx(() => [
                                  createTextVNode(toDisplayString(unref(t)(`chartType.${chart.chartType}`)), 1)
                                ]),
                                _: 2
                              }, 1032, ["label"]),
                              createVNode(_component_el_descriptions_item, { label: "Format" }, {
                                default: withCtx(() => [
                                  createTextVNode(toDisplayString(chart.fileFormat.toUpperCase()), 1)
                                ]),
                                _: 2
                              }, 1024)
                            ]),
                            _: 2
                          }, 1024)
                        ]),
                        _: 2
                      }, 1032, ["onClick"])
                    ]),
                    _: 2
                  }, 1024);
                }), 128))
              ]),
              _: 1
            }))
          ]),
          _: 1
        }, 8, ["loading"]),
        createVNode(_component_el_dialog, {
          modelValue: urlDialogVisible.value,
          "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => urlDialogVisible.value = $event),
          title: unref(t)("charts.importUrlToggle"),
          width: "520"
        }, {
          footer: withCtx(() => [
            createVNode(_component_el_button, {
              onClick: _cache[3] || (_cache[3] = ($event) => urlDialogVisible.value = false)
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("common.cancel")), 1)
              ]),
              _: 1
            }),
            createVNode(_component_el_button, {
              type: "primary",
              loading: importing.value,
              onClick: handleUrlImport
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("charts.importUrlAction")), 1)
              ]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: withCtx(() => [
            createVNode(_component_el_input, {
              modelValue: importUrl.value,
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => importUrl.value = $event),
              placeholder: unref(t)("charts.importUrlPlaceholder")
            }, null, 8, ["modelValue", "placeholder"])
          ]),
          _: 1
        }, 8, ["modelValue", "title"])
      ]);
    };
  }
});
const ChartsView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-22e9d824"]]);
export {
  ChartsView as default
};
