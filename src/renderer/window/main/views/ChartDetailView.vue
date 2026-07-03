<template>
  <section v-loading="loading" class="page-container chart-detail">
    <header class="page-header">
      <div class="page-actions">
        <el-button :icon="ArrowLeft" @click="router.push('/charts')">
          {{ t('common.back') }}
        </el-button>
        <el-text tag="h2">{{ chart?.title || t('chartDetail.title') }}</el-text>
        <el-tag v-if="chart" :type="chart.isGeoreferenced ? 'success' : 'info'">
          {{
            chart.isGeoreferenced ? t('charts.georeferenced') : t('charts.notGeoreferenced')
          }}
        </el-tag>
      </div>
      <div class="page-actions">
        <el-button type="danger" plain :icon="Delete" @click="deleteDialogVisible = true">
          {{ t('chartDetail.delete') }}
        </el-button>
        <el-button type="primary" :icon="Check" @click="saveMetadata">
          {{ t('chartDetail.saveMeta') }}
        </el-button>
      </div>
    </header>

    <el-row v-if="chart" :gutter="16">
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>{{ t('chartDetail.metaTitle') }}</template>
          <el-form label-position="top">
            <el-form-item :label="t('chartDetail.fieldTitle')" required>
              <el-input v-model="metadata.title" />
            </el-form-item>
            <el-form-item :label="t('chartDetail.fieldAirportCode')">
              <el-input v-model="metadata.airportCode" @change="loadProcedures" />
            </el-form-item>
            <el-form-item :label="t('chartDetail.fieldChartType')">
              <el-select v-model="metadata.chartType" @change="handleChartTypeChange">
                <el-option
                  v-for="type in chartTypes"
                  :key="type"
                  :value="type"
                  :label="t(`chartType.${type}`)"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="bindable" :label="t('chartDetail.procedureModeTitle')">
              <el-radio-group v-model="metadata.titleMode">
                <el-radio-button value="manual">{{ t('chartDetail.modeManual') }}</el-radio-button>
                <el-radio-button value="approach-procedure">
                  {{ t('chartDetail.modeProcedure') }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
            <template v-if="metadata.titleMode === 'approach-procedure' && bindable">
              <el-form-item :label="t('chartDetail.procedureRunway')">
                <el-select v-model="metadata.boundRunwayNames" multiple clearable>
                  <el-option
                    v-for="runway in procedures.runways"
                    :key="runway.name"
                    :value="runway.name"
                    :label="runway.displayName"
                  />
                </el-select>
              </el-form-item>
              <el-form-item :label="procedureLabel">
                <el-select
                  v-model="metadata.boundApproachProcedureIds"
                  multiple
                  clearable
                  filterable
                >
                  <el-option
                    v-for="procedure in availableProcedures"
                    :key="procedure.id"
                    :value="procedure.id"
                    :label="procedure.name"
                  />
                </el-select>
              </el-form-item>
            </template>
          </el-form>
        </el-card>

        <el-card shadow="never" class="point-card">
          <template #header>{{ t('chartDetail.saveReference') }}</template>
          <el-steps :active="Math.min(mapPoints.length, chartPoints.length)" finish-status="success">
            <el-step :title="`${t('chartDetail.mapPickerTitle')} ${mapPoints.length}/2`" />
            <el-step :title="`${t('chartDetail.viewerTitle')} ${chartPoints.length}/2`" />
          </el-steps>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item v-for="index in 2" :key="index" :label="`Point ${index}`">
              <template v-if="mapPoints[index - 1] && chartPoints[index - 1]">
                {{ formatCoordinate(mapPoints[index - 1].lat) }},
                {{ formatCoordinate(mapPoints[index - 1].lon) }} ↔
                {{ Math.round(chartPoints[index - 1].x) }},
                {{ Math.round(chartPoints[index - 1].y) }}
              </template>
              <template v-else>-</template>
            </el-descriptions-item>
          </el-descriptions>
          <div class="point-actions">
            <el-button
              :disabled="!aircraft?.connected || mapPoints.length >= 2"
              @click="captureAircraftPosition"
            >
              {{ t('chartDetail.captureFromAircraft') }}
            </el-button>
            <el-button @click="clearPoints">{{ t('chartDetail.clearMapPoints') }}</el-button>
            <el-button
              type="primary"
              :disabled="mapPoints.length !== 2 || chartPoints.length !== 2"
              @click="saveReferencePoints"
            >
              {{ t('chartDetail.saveReference') }}
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-tabs v-model="activePanel" type="border-card" class="workspace-tabs">
          <el-tab-pane name="map" :label="t('chartDetail.mapPickerTitle')">
            <div class="map-search">
              <el-autocomplete
                v-model="mapSearch"
                :fetch-suggestions="searchMapPoints"
                value-key="ident"
                :placeholder="t('map.searchPlaceholder')"
                @select="focusMapPoint"
              />
              <el-alert
                :title="t('chartDetail.countMap', { count: mapPoints.length })"
                type="info"
                :closable="false"
              />
            </div>
            <div ref="mapElement" class="reference-map" />
          </el-tab-pane>
          <el-tab-pane name="chart" :label="t('chartDetail.viewerTitle')">
            <div class="chart-toolbar">
              <el-slider v-model="imageZoom" :min="25" :max="200" :step="25" show-stops />
              <el-button @click="imageZoom = 100">{{ t('chartPreview.resetZoom') }}</el-button>
              <el-alert
                :title="t('chartDetail.countChart', { count: chartPoints.length })"
                type="info"
                :closable="false"
              />
            </div>
            <div v-loading="assetLoading" class="chart-image-scroll">
              <el-result
                v-if="assetError"
                icon="error"
                :title="t('chartPreview.noAssetTitle')"
                :sub-title="assetError"
              />
              <div
                v-else-if="assetUrl"
                ref="imageStage"
                class="chart-image-stage"
                :style="{ width: `${imageZoom}%` }"
                @click="captureChartPoint"
              >
                <img :src="assetUrl" :alt="chart.title" draggable="false" />
                <span
                  v-for="(point, index) in chartPoints"
                  :key="index"
                  class="chart-point"
                  :style="chartPointStyle(point)"
                >
                  {{ index + 1 }}
                </span>
                <span
                  v-if="aircraftChartPoint"
                  class="chart-aircraft"
                  :style="chartPointStyle(aircraftChartPoint)"
                  :title="t('map.aircraftMarker')"
                >
                  <el-icon><Position /></el-icon>
                </span>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>

    <el-dialog v-model="deleteDialogVisible" :title="t('chartDetail.deleteDialogTitle')" width="480">
      <el-alert
        :title="`${t('chartDetail.deletePromptPrefix')} ${chart?.title} ${t('chartDetail.deletePromptSuffix')}`"
        type="warning"
        :closable="false"
      />
      <el-input v-model="deleteConfirmation" class="delete-input" />
      <template #footer>
        <el-button @click="deleteDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="danger"
          :disabled="deleteConfirmation !== chart?.title"
          @click="deleteChart"
        >
          {{ t('chartDetail.confirmDelete') }}
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, Check, Delete, Position } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import L, { type LayerGroup, type Map as LeafletMap } from 'leaflet'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type {
  ChartAssetPayload,
  ChartRecord,
  ChartTitleMode,
  ChartType,
  GeoReferencePoint
} from '@shared/chart-types'
import type {
  NavAirportProcedures,
  NavProcedureOption
} from '@shared/flight-plan-types'
import type { NavMapSearchResult } from '@shared/nav-map-types'
import { getAppClient } from '../../../client'
import { useAppState } from '../../../composables/useAppState'
import { useChartAsset } from '../../../composables/useChartAsset'
import { getMapTileConfig } from '../../../utils/mapTileProviders'
import { notifyChartChanged } from '../../../utils/chartSync'
import { projectAircraftToChart } from '../../../utils/chartMath'

const props = defineProps<{ chartId: string }>()
const EMPTY_PROCEDURES: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [],
  transitions: [],
  approaches: []
}
const client = getAppClient()
const router = useRouter()
const { t } = useI18n()
const appState = useAppState()
const aircraft = computed(() => appState.aircraft.value)
const settings = computed(() => appState.settings.value)
const loading = ref(true)
const chart = ref<ChartRecord | null>(null)
const asset = ref<ChartAssetPayload | null>(null)
const { url: assetUrl, loading: assetLoading, error: assetError } = useChartAsset(asset)
const procedures = ref<NavAirportProcedures>(EMPTY_PROCEDURES)
const metadata = reactive({
  title: '',
  airportCode: '',
  chartType: 'general' as ChartType,
  titleMode: 'manual' as ChartTitleMode,
  boundRunwayNames: [] as string[],
  boundApproachProcedureIds: [] as string[]
})
const chartTypes: ChartType[] = ['general', 'airport', 'sid', 'star', 'approach']
const bindable = computed(() => ['sid', 'star', 'approach'].includes(metadata.chartType))
const availableProcedures = computed<NavProcedureOption[]>(() => {
  const source =
    metadata.chartType === 'sid'
      ? procedures.value.departures
      : metadata.chartType === 'star'
        ? procedures.value.arrivals
        : procedures.value.approaches
  if (metadata.boundRunwayNames.length === 0) return source
  return source.filter(
    (item) => !item.runwayName || metadata.boundRunwayNames.includes(item.runwayName)
  )
})
const procedureLabel = computed(() =>
  metadata.chartType === 'sid'
    ? t('flightPlan.departureProcedure')
    : metadata.chartType === 'star'
      ? t('flightPlan.arrivalProcedure')
      : t('flightPlan.approachProcedure')
)
const activePanel = ref('map')
const mapElement = ref<HTMLElement>()
const mapSearch = ref('')
const mapPoints = ref<Array<{ lat: number; lon: number }>>([])
const chartPoints = ref<Array<{ x: number; y: number }>>([])
const aircraftChartPoint = computed(() => {
  if (mapPoints.value.length !== 2 || chartPoints.value.length !== 2) return null
  return projectAircraftToChart(
    aircraft.value,
    [0, 1].map((index) => ({
      id: '',
      chartId: props.chartId,
      index: (index + 1) as 1 | 2,
      mapLat: mapPoints.value[index].lat,
      mapLon: mapPoints.value[index].lon,
      chartX: chartPoints.value[index].x,
      chartY: chartPoints.value[index].y
    }))
  )
})
const imageZoom = ref(100)
const imageStage = ref<HTMLElement>()
const deleteDialogVisible = ref(false)
const deleteConfirmation = ref('')
let map: LeafletMap | null = null
let markerLayer: LayerGroup | null = null

watch(activePanel, async (value) => {
  if (value === 'map') {
    await nextTick()
    initializeMap()
    map?.invalidateSize()
  }
})

watch(mapPoints, renderMapPoints, { deep: true })

onMounted(async () => {
  try {
    await loadChart()
  } finally {
    loading.value = false
  }
  await nextTick()
  initializeMap()
})

onBeforeUnmount(() => map?.remove())

async function loadChart(): Promise<void> {
  const [record, chartAsset, points] = await Promise.all([
    client.getChart(props.chartId),
    client.getChartAsset(props.chartId),
    client.getChartReferencePoints(props.chartId)
  ])
  if (!record) {
    ElMessage.error(t('chartPreview.noAssetTitle'))
    await router.replace('/charts')
    return
  }
  chart.value = record
  asset.value = chartAsset
  Object.assign(metadata, {
    title: record.title,
    airportCode: record.airportCode ?? '',
    chartType: record.chartType,
    titleMode: record.titleMode,
    boundRunwayNames: [...record.boundRunwayNames],
    boundApproachProcedureIds: [...record.boundApproachProcedureIds]
  })
  mapPoints.value = points
    .sort((left, right) => left.index - right.index)
    .map((point) => ({ lat: point.mapLat, lon: point.mapLon }))
  chartPoints.value = points
    .sort((left, right) => left.index - right.index)
    .map((point) => ({ x: point.chartX, y: point.chartY }))
  await loadProcedures()
}

function initializeMap(): void {
  if (map || !mapElement.value) return
  const center =
    mapPoints.value[0] ??
    (aircraft.value?.connected ? { lat: aircraft.value.lat, lon: aircraft.value.lon } : { lat: 35.8, lon: 104.1 })
  map = L.map(mapElement.value).setView([center.lat, center.lon], mapPoints.value.length ? 10 : 5)
  const tile = getMapTileConfig(settings.value?.mapTileProvider)
  L.tileLayer(tile.url, {
    attribution: tile.attribution,
    ...(tile.subdomains ? { subdomains: tile.subdomains } : {})
  }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)
  map.on('click', (event: L.LeafletMouseEvent) => {
    if (mapPoints.value.length >= 2) return
    mapPoints.value = [...mapPoints.value, { lat: event.latlng.lat, lon: event.latlng.lng }]
  })
  renderMapPoints()
}

function renderMapPoints(): void {
  if (!markerLayer) return
  const targetLayer = markerLayer
  targetLayer.clearLayers()
  mapPoints.value.forEach((point, index) => {
    L.circleMarker([point.lat, point.lon], {
      radius: 7,
      color: 'var(--el-color-primary)',
      fillColor: 'var(--el-color-primary)',
      fillOpacity: 1
    })
      .bindTooltip(String(index + 1), { permanent: true })
      .addTo(targetLayer)
  })
  if (map && mapPoints.value.length === 2) {
    map.fitBounds(L.latLngBounds(mapPoints.value.map((point) => [point.lat, point.lon])), {
      padding: [40, 40]
    })
  }
}

async function searchMapPoints(
  query: string,
  callback: (items: NavMapSearchResult[]) => void
): Promise<void> {
  if (!query.trim()) {
    callback([])
    return
  }
  try {
    callback(
      await client.searchNavMapPoints({
        query,
        types: ['airports', 'waypoints', 'vors', 'ndbs'],
        limit: 20
      })
    )
  } catch {
    callback([])
  }
}

function focusMapPoint(value: unknown): void {
  const item = value as NavMapSearchResult
  map?.setView([item.lat, item.lon], 12)
}

function captureAircraftPosition(): void {
  if (!aircraft.value?.connected || mapPoints.value.length >= 2) return
  mapPoints.value = [
    ...mapPoints.value,
    { lat: aircraft.value.lat, lon: aircraft.value.lon }
  ]
}

function captureChartPoint(event: MouseEvent): void {
  if (chartPoints.value.length >= 2 || !imageStage.value || !assetUrl.value) return
  const image = imageStage.value.querySelector('img')
  if (!(image instanceof HTMLImageElement)) return
  const rect = image.getBoundingClientRect()
  chartPoints.value = [
    ...chartPoints.value,
    {
      x: ((event.clientX - rect.left) / rect.width) * image.naturalWidth,
      y: ((event.clientY - rect.top) / rect.height) * image.naturalHeight
    }
  ]
}

function chartPointStyle(point: { x: number; y: number }): Record<string, string> {
  const image = imageStage.value?.querySelector('img')
  const width = image instanceof HTMLImageElement ? image.naturalWidth : 1
  const height = image instanceof HTMLImageElement ? image.naturalHeight : 1
  return { left: `${(point.x / width) * 100}%`, top: `${(point.y / height) * 100}%` }
}

function clearPoints(): void {
  mapPoints.value = []
  chartPoints.value = []
}

async function saveReferencePoints(): Promise<void> {
  if (mapPoints.value.length !== 2 || chartPoints.value.length !== 2) return
  const points: GeoReferencePoint[] = [0, 1].map((index) => ({
    id: '',
    chartId: props.chartId,
    index: (index + 1) as 1 | 2,
    mapLat: mapPoints.value[index].lat,
    mapLon: mapPoints.value[index].lon,
    chartX: chartPoints.value[index].x,
    chartY: chartPoints.value[index].y
  }))
  await client.saveChartReferencePoints(props.chartId, points)
  await loadChart()
  notifyChartChanged()
  ElMessage.success(t('feedback.saved'))
}

async function loadProcedures(): Promise<void> {
  const airport = metadata.airportCode.trim().toUpperCase()
  procedures.value = airport ? await client.getNavAirportProcedures(airport) : EMPTY_PROCEDURES
}

function handleChartTypeChange(): void {
  if (!bindable.value) {
    metadata.titleMode = 'manual'
    metadata.boundRunwayNames = []
    metadata.boundApproachProcedureIds = []
  }
}

async function saveMetadata(): Promise<void> {
  if (!metadata.title.trim()) {
    ElMessage.warning(t('chartDetail.titleRequired'))
    return
  }
  let title = metadata.title.trim()
  if (metadata.titleMode === 'approach-procedure') {
    const selected = availableProcedures.value.filter((item) =>
      metadata.boundApproachProcedureIds.includes(item.id)
    )
    if (selected.length === 0) {
      ElMessage.warning(t('chartDetail.procedureRequired'))
      return
    }
    title = selected.map((item) => item.name).join(' / ')
  }
  const updated = await client.updateChart({
    id: props.chartId,
    title,
    airportCode: metadata.airportCode.trim().toUpperCase() || null,
    chartType: metadata.chartType,
    titleMode: metadata.titleMode,
    boundRunwayNames: [...metadata.boundRunwayNames],
    boundApproachProcedureIds: [...metadata.boundApproachProcedureIds]
  })
  if (updated) chart.value = updated
  metadata.title = title
  notifyChartChanged()
  ElMessage.success(t('feedback.saved'))
}

async function deleteChart(): Promise<void> {
  if (deleteConfirmation.value !== chart.value?.title) return
  await client.deleteChart(props.chartId)
  notifyChartChanged()
  ElMessage.success(t('feedback.deleted'))
  await router.replace('/charts')
}

function formatCoordinate(value: number): string {
  return value.toFixed(6)
}
</script>

<style scoped>
.chart-detail {
  height: 100%;
  overflow: auto;
}

.point-card {
  margin-top: var(--el-component-size-small);
}

.point-actions,
.map-search,
.chart-toolbar {
  display: flex;
  align-items: center;
  gap: var(--el-component-size-small);
  margin-top: var(--el-component-size-small);
}

.point-actions {
  flex-wrap: wrap;
}

.workspace-tabs {
  height: calc(100vh - 120px);
}

.reference-map {
  width: 100%;
  height: calc(100vh - 230px);
  margin-top: var(--el-component-size-small);
}

.map-search .el-autocomplete,
.chart-toolbar .el-slider {
  flex: 1;
}

.chart-image-scroll {
  height: calc(100vh - 230px);
  overflow: auto;
  margin-top: var(--el-component-size-small);
  border: 1px solid var(--el-border-color);
}

.chart-image-stage {
  position: relative;
  min-width: 100%;
  cursor: crosshair;
}

.chart-image-stage img {
  width: 100%;
  height: auto;
  display: block;
  user-select: none;
}

.chart-point,
.chart-aircraft {
  position: absolute;
  transform: translate(-50%, -50%);
  width: var(--el-component-size);
  height: var(--el-component-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--el-border-radius-circle);
  color: var(--el-color-white);
  background-color: var(--el-color-primary);
  pointer-events: none;
}

.delete-input {
  margin-top: var(--el-component-size);
}
</style>
