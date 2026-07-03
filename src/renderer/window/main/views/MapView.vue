<template>
  <section class="map-page">
    <div ref="mapElement" class="map-canvas" />

    <el-card shadow="always" class="map-toolbar">
      <div class="toolbar-row">
        <el-autocomplete
          v-model="mapSearch"
          :fetch-suggestions="searchMapPoints"
          value-key="ident"
          :placeholder="t('map.searchPlaceholder')"
          clearable
          @select="focusSearchResult"
        >
          <template #default="{ item }">
            <el-space>
              <el-tag size="small">{{ typeLabel(item.type) }}</el-tag>
              <el-text>{{ item.ident }} · {{ item.name || '-' }}</el-text>
            </el-space>
          </template>
        </el-autocomplete>
        <el-button-group>
          <el-button
            v-for="layer in layerOptions"
            :key="layer.key"
            :type="navLayers[layer.key] ? 'primary' : 'default'"
            @click="toggleNavLayer(layer.key)"
          >
            {{ layer.label }}
          </el-button>
        </el-button-group>
        <el-select
          v-if="settings"
          :model-value="settings.mapTileProvider"
          class="provider-select"
          @change="changeMapProvider"
        >
          <el-option
            v-for="provider in providerOptions"
            :key="provider.value"
            :value="provider.value"
            :label="provider.label"
          />
        </el-select>
        <el-tag :type="connection?.connected ? 'success' : 'info'">
          {{ connection?.connected ? t('status.connected') : t('status.disconnected') }}
        </el-tag>
      </div>
    </el-card>

    <el-button-group class="map-controls">
      <el-button
        :icon="Aim"
        :disabled="!aircraft?.connected"
        :type="followAircraft ? 'primary' : 'default'"
        :title="followAircraft ? t('map.followAircraftStop') : t('map.followAircraftStart')"
        @click="toggleFollow"
      />
      <el-button
        :icon="FullScreen"
        :disabled="routePoints.length === 0"
        :title="t('map.fitRoute')"
        @click="fitRoute"
      />
    </el-button-group>

    <el-space class="map-actions" direction="vertical">
      <el-button type="primary" :icon="Promotion" @click="flightPlanVisible = true">
        {{ t('flightPlan.title') }}
      </el-button>
      <el-button :icon="Files" @click="chartsVisible = true">
        {{ t('nav.charts') }}
      </el-button>
    </el-space>

    <el-card shadow="always" class="flight-status">
      <el-descriptions :column="2" size="small">
        <el-descriptions-item :label="t('status.altitude')">
          {{ formatNumber(aircraft?.altitudeFt) }} ft
        </el-descriptions-item>
        <el-descriptions-item :label="t('status.speed')">
          {{ formatNumber(aircraft?.groundSpeedKts) }} kt
        </el-descriptions-item>
        <el-descriptions-item :label="t('status.heading')">
          {{ formatNumber(aircraft?.headingDeg) }}°
        </el-descriptions-item>
        <el-descriptions-item :label="t('status.source')">
          {{ aircraft?.source || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-drawer v-model="flightPlanVisible" :title="t('flightPlan.title')" size="480">
      <el-alert
        v-if="navStatus && !navStatus.exists"
        :title="t('flightPlan.navDataRequired')"
        :description="t('flightPlan.navDataRequiredHint')"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-form label-position="top" class="drawer-form">
        <el-divider content-position="left">{{ t('flightPlan.departureSection') }}</el-divider>
        <el-form-item :label="t('flightPlan.departureAirport')">
          <el-select
            v-model="draft.departureAirport"
            filterable
            remote
            reserve-keyword
            :remote-method="searchDepartureAirports"
            :loading="airportSearching"
            @change="loadDepartureProcedures"
          >
            <el-option
              v-for="airport in departureAirportOptions"
              :key="airport.ident"
              :value="airport.ident"
              :label="`${airport.ident} · ${airport.name}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('flightPlan.departureRunway')">
          <el-select v-model="draft.departureRunway" clearable>
            <el-option
              v-for="runway in departureProcedures.runways"
              :key="runway.name"
              :value="runway.name"
              :label="runway.displayName"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('flightPlan.departureProcedure')">
          <el-select v-model="draft.departureProcedureId" clearable filterable>
            <el-option
              v-for="procedure in filteredDepartures"
              :key="procedure.id"
              :value="procedure.id"
              :label="procedure.name"
            />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">{{ t('flightPlan.routeSection') }}</el-divider>
        <el-form-item :label="t('flightPlan.enroute')">
          <el-input
            v-model="draft.enrouteText"
            type="textarea"
            :rows="4"
            :placeholder="t('flightPlan.enroutePlaceholder')"
          />
        </el-form-item>

        <el-divider content-position="left">{{ t('flightPlan.arrivalSection') }}</el-divider>
        <el-form-item :label="t('flightPlan.destinationAirport')">
          <el-select
            v-model="draft.destinationAirport"
            filterable
            remote
            reserve-keyword
            :remote-method="searchDestinationAirports"
            :loading="airportSearching"
            @change="loadDestinationProcedures"
          >
            <el-option
              v-for="airport in destinationAirportOptions"
              :key="airport.ident"
              :value="airport.ident"
              :label="`${airport.ident} · ${airport.name}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('flightPlan.arrivalRunway')">
          <el-select v-model="draft.arrivalRunway" clearable>
            <el-option
              v-for="runway in destinationProcedures.runways"
              :key="runway.name"
              :value="runway.name"
              :label="runway.displayName"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('flightPlan.arrivalProcedure')">
          <el-select v-model="draft.arrivalProcedureId" clearable filterable>
            <el-option
              v-for="procedure in filteredArrivals"
              :key="procedure.id"
              :value="procedure.id"
              :label="procedure.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('flightPlan.approachProcedure')">
          <el-select v-model="draft.approachProcedureId" clearable filterable>
            <el-option
              v-for="procedure in filteredApproaches"
              :key="procedure.id"
              :value="procedure.id"
              :label="procedure.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('flightPlan.arrivalTransition')">
          <el-select v-model="draft.arrivalTransitionId" clearable filterable>
            <el-option
              v-for="transition in destinationProcedures.transitions"
              :key="transition.id"
              :value="transition.id"
              :label="transition.name"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="flightPlanResult?.unresolvedTokens.length"
        :title="t('flightPlan.unresolved')"
        :description="flightPlanResult.unresolvedTokens.join(', ')"
        type="warning"
        show-icon
      />

      <template #footer>
        <div class="drawer-footer">
          <el-button :loading="simbriefLoading" @click="importSimBrief">
            {{ t('flightPlan.importSimbrief') }}
          </el-button>
          <el-button @click="clearFlightPlan">{{ t('flightPlan.clear') }}</el-button>
          <el-button type="primary" :loading="planBuilding" @click="buildFlightPlan">
            {{ t('flightPlan.build') }}
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer v-model="chartsVisible" :title="t('nav.charts')" size="420">
      <el-empty v-if="dockCards.length === 0" :description="t('charts.emptyDescription')" />
      <el-table v-else :data="dockCards" highlight-current-row>
        <el-table-column :label="t('chartDetail.fieldTitle')">
          <template #default="{ row }">
            {{
              row.kind === 'manual'
                ? row.chart.title
                : `${row.airportCode} · ${row.procedureName}`
            }}
          </template>
        </el-table-column>
        <el-table-column :label="t('chartDetail.fieldChartType')" width="110">
          <template #default="{ row }">
            <el-tag :type="dockCardTagType(row)">
              {{ dockCardStateLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column width="150">
          <template #default="{ row }">
            <el-button
              :type="activeChartId === dockCardChartId(row) ? 'primary' : 'default'"
              @click="handleDockCard(row)"
            >
              {{ dockCardActionLabel(row) }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="router.push('/charts')">{{ t('mapMount.goChartLibrary') }}</el-button>
      </template>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Aim, Files, FullScreen, Promotion } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import L, { type Layer, type LayerGroup, type Map as LeafletMap, type TileLayer } from 'leaflet'
import type { MapTileProvider } from '@shared/types'
import type {
  BuildFlightPlanInput,
  BuildFlightPlanResult,
  FlightPlanSelection,
  NavAirportOption,
  NavAirportProcedures,
  NavProcedureOption
} from '@shared/flight-plan-types'
import type {
  NavMapLayerVisibility,
  NavMapSearchResult,
  NavMapSearchType
} from '@shared/nav-map-types'
import { getAppClient } from '../../../client'
import { useAppState } from '../../../composables/useAppState'
import { useChartLibrary } from '../../../composables/useChartLibrary'
import { getMapTileConfig } from '../../../utils/mapTileProviders'
import {
  persistStoredChartDockState,
  persistStoredFlightPlanDraft,
  persistStoredFlightPlanResult,
  readStoredChartDockState,
  readStoredFlightPlanDraft,
  readStoredFlightPlanResult
} from '../../../utils/flightPlanPersistence'
import { filterProceduresByRunway } from '../../../utils/navProcedures'
import {
  buildManualMountCards,
  buildProcedureMountCards,
  type DockCard
} from '../../../utils/chartMountCards'

const EMPTY_PROCEDURES: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [],
  transitions: [],
  approaches: []
}
const MAP_VIEW_KEY = 'nextefb.map-view.v2'
const NAV_LAYERS_KEY = 'nextefb.nav-layers.v2'
const client = getAppClient()
const router = useRouter()
const { t } = useI18n()
const appState = useAppState()
const aircraft = computed(() => appState.aircraft.value)
const connection = computed(() => appState.connection.value)
const settings = computed(() => appState.settings.value)
const { charts } = useChartLibrary()
const mapElement = ref<HTMLElement>()
const flightPlanVisible = ref(false)
const chartsVisible = ref(false)
const mapSearch = ref('')
const followAircraft = ref(false)
const planBuilding = ref(false)
const simbriefLoading = ref(false)
const airportSearching = ref(false)
const departureAirportOptions = ref<NavAirportOption[]>([])
const destinationAirportOptions = ref<NavAirportOption[]>([])
const departureProcedures = ref<NavAirportProcedures>(EMPTY_PROCEDURES)
const destinationProcedures = ref<NavAirportProcedures>(EMPTY_PROCEDURES)
const navStatus = ref<Awaited<ReturnType<typeof client.getNavDataStatus>> | null>(null)
const draft = reactive<BuildFlightPlanInput>(readStoredFlightPlanDraft())
const storedResult = readStoredFlightPlanResult()
const flightPlanResult = ref<BuildFlightPlanResult | null>(
  storedResult ? { ...storedResult, unresolvedTokens: [], summary: '' } : null
)
const dock = readStoredChartDockState()
const activeChartId = ref<string | null>(dock.activeChartId)
const navLayers = reactive<NavMapLayerVisibility>(readNavLayers())
const layerOptions: Array<{ key: keyof NavMapLayerVisibility; label: string }> = [
  { key: 'airports', label: 'APT' },
  { key: 'airways', label: 'AWY' },
  { key: 'vors', label: 'VOR' },
  { key: 'ndbs', label: 'NDB' },
  { key: 'waypoints', label: 'WPT' }
]
const providerOptions = computed(() => [
  { value: 'esriWorldStreet', label: t('settings.mapTileProviderEsriWorldStreet') },
  { value: 'osm', label: t('settings.mapTileProviderOsm') },
  { value: 'osmHot', label: t('settings.mapTileProviderOsmHot') },
  { value: 'osmfr', label: t('settings.mapTileProviderOsmFr') },
  { value: 'cartoLight', label: t('settings.mapTileProviderCartoLight') },
  { value: 'cartoVoyager', label: t('settings.mapTileProviderCartoVoyager') }
])
const routePoints = computed(() => flightPlanResult.value?.points ?? [])
const flightPlanSelection = computed<FlightPlanSelection | null>(() => {
  if (
    !draft.departureProcedureId &&
    !draft.arrivalProcedureId &&
    !draft.approachProcedureId
  ) {
    return null
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
  }
})
const procedureCards = computed(() =>
  buildProcedureMountCards(charts.value, flightPlanSelection.value, {
    departure: departureProcedures.value,
    destination: destinationProcedures.value
  })
)
const procedureChartIds = computed(
  () =>
    new Set(
      procedureCards.value
        .map((card) => card.chartId)
        .filter((chartId): chartId is string => Boolean(chartId))
    )
)
const dockCards = computed<DockCard[]>(() => [
  ...procedureCards.value,
  ...buildManualMountCards(charts.value, procedureChartIds.value)
])
const filteredDepartures = computed(() =>
  filterProceduresByRunway(departureProcedures.value.departures, draft.departureRunway ?? '')
)
const filteredArrivals = computed(() =>
  filterProceduresByRunway(destinationProcedures.value.arrivals, draft.arrivalRunway ?? '')
)
const filteredApproaches = computed(() =>
  filterProceduresByRunway(destinationProcedures.value.approaches, draft.arrivalRunway ?? '')
)

let map: LeafletMap | null = null
let tileLayer: TileLayer | null = null
let aircraftLayer: Layer | null = null
let routeLayer: LayerGroup | null = null
let navLayerGroup: LayerGroup | null = null
let chartOverlayCleanup: (() => void) | null = null
let navRefreshTimer: number | null = null

watch(
  draft,
  (value) => persistStoredFlightPlanDraft({ ...value }),
  { deep: true }
)

watch(
  () => settings.value?.mapTileProvider,
  () => replaceTileLayer()
)

watch(
  [aircraft, followAircraft],
  () => updateAircraftLayer(),
  { deep: true }
)

watch(routePoints, () => renderRoute(), { deep: true })
watch(activeChartId, (value) => {
  persistStoredChartDockState({
    mountedChartIds: value ? [value] : [],
    activeChartId: value,
    overlayDismissed: false
  })
  void renderChartOverlay(value)
})

watch(
  navLayers,
  () => {
    window.localStorage.setItem(NAV_LAYERS_KEY, JSON.stringify(navLayers))
    scheduleNavRefresh()
  },
  { deep: true }
)

onMounted(async () => {
  await nextTick()
  const storedView = readMapView()
  map = L.map(mapElement.value!, { zoomControl: true }).setView(
    [storedView.lat, storedView.lon],
    storedView.zoom
  )
  replaceTileLayer()
  routeLayer = L.layerGroup().addTo(map)
  navLayerGroup = L.layerGroup().addTo(map)
  map.on('moveend zoomend', () => {
    if (!map) return
    const center = map.getCenter()
    window.localStorage.setItem(
      MAP_VIEW_KEY,
      JSON.stringify({ lat: center.lat, lon: center.lng, zoom: map.getZoom() })
    )
    scheduleNavRefresh()
  })
  updateAircraftLayer()
  renderRoute()
  scheduleNavRefresh()
  void renderChartOverlay(activeChartId.value)
  navStatus.value = await client.getNavDataStatus()
  if (draft.departureAirport) await loadDepartureProcedures()
  if (draft.destinationAirport) await loadDestinationProcedures()
})

onBeforeUnmount(() => {
  if (navRefreshTimer !== null) window.clearTimeout(navRefreshTimer)
  chartOverlayCleanup?.()
  map?.remove()
  map = null
})

function replaceTileLayer(): void {
  if (!map) return
  tileLayer?.remove()
  const config = getMapTileConfig(settings.value?.mapTileProvider)
  tileLayer = L.tileLayer(config.url, {
    attribution: config.attribution,
    updateWhenIdle: false,
    ...(config.subdomains ? { subdomains: config.subdomains } : {})
  }).addTo(map)
  tileLayer.bringToBack()
}

function updateAircraftLayer(): void {
  if (!map) return
  aircraftLayer?.remove()
  aircraftLayer = null
  const value = aircraft.value
  if (!value?.connected || !Number.isFinite(value.lat) || !Number.isFinite(value.lon)) return
  aircraftLayer = L.circleMarker([value.lat, value.lon], {
    radius: 7,
    color: 'var(--el-color-primary)',
    fillColor: 'var(--el-color-primary)',
    fillOpacity: 1
  })
    .bindTooltip(t('map.aircraftMarker'))
    .addTo(map)
  if (followAircraft.value) map.panTo([value.lat, value.lon])
}

function renderRoute(): void {
  if (!routeLayer) return
  routeLayer.clearLayers()
  const result = flightPlanResult.value
  if (!result) return
  const segments = result.segments.length
    ? result.segments
    : [{ points: result.points, dashed: false }]
  for (const segment of segments) {
    if (segment.points.length < 2) continue
    L.polyline(
      segment.points.map((point) => [point.lat, point.lon]),
      {
        color: 'var(--el-color-primary)',
        weight: 3,
        dashArray: segment.dashed ? '10 10' : undefined
      }
    ).addTo(routeLayer)
  }
  result.points.forEach((point, index) => {
    L.circleMarker([point.lat, point.lon], {
      radius: index === 0 || index === result.points.length - 1 ? 6 : 4,
      color: 'var(--el-color-primary)',
      fillColor: 'var(--el-bg-color)',
      fillOpacity: 1
    })
      .bindTooltip(`${index + 1}. ${point.ident}`)
      .addTo(routeLayer!)
  })
}

function fitRoute(): void {
  if (!map || routePoints.value.length === 0) return
  followAircraft.value = false
  map.fitBounds(
    L.latLngBounds(routePoints.value.map((point) => [point.lat, point.lon])),
    { padding: [40, 40] }
  )
}

function toggleFollow(): void {
  followAircraft.value = !followAircraft.value
  updateAircraftLayer()
}

async function changeMapProvider(value: MapTileProvider): Promise<void> {
  appState.setSettings(await client.updateSettings({ mapTileProvider: value }))
}

function toggleNavLayer(key: keyof NavMapLayerVisibility): void {
  navLayers[key] = !navLayers[key]
}

function scheduleNavRefresh(): void {
  if (navRefreshTimer !== null) window.clearTimeout(navRefreshTimer)
  navRefreshTimer = window.setTimeout(() => void refreshNavFeatures(), 180)
}

async function refreshNavFeatures(): Promise<void> {
  if (!map || !navLayerGroup) return
  const bounds = map.getBounds()
  const zoom = map.getZoom()
  const layers: NavMapLayerVisibility = {
    airports: navLayers.airports,
    airways: navLayers.airways && zoom >= 5,
    vors: navLayers.vors && zoom >= 6,
    ndbs: navLayers.ndbs && zoom >= 6,
    waypoints: navLayers.waypoints && zoom >= 8
  }
  if (!Object.values(layers).some(Boolean)) {
    navLayerGroup.clearLayers()
    return
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
    })
    navLayerGroup.clearLayers()
    features.airways.forEach((feature) =>
      L.polyline(
        [
          [feature.fromLat, feature.fromLon],
          [feature.toLat, feature.toLon]
        ],
        { color: 'var(--el-color-info)', weight: 1 }
      )
        .bindTooltip(`${feature.name} ${feature.airwayType}`)
        .addTo(navLayerGroup!)
    )
    const addPoint = (lat: number, lon: number, label: string, radius: number) =>
      L.circleMarker([lat, lon], {
        radius,
        color: 'var(--el-color-primary)',
        fillColor: 'var(--el-bg-color)',
        fillOpacity: 1
      })
        .bindTooltip(label)
        .addTo(navLayerGroup!)
    features.airports.forEach((value) =>
      addPoint(value.lat, value.lon, [value.ident, value.name].filter(Boolean).join(' · '), 5)
    )
    features.vors.forEach((value) => addPoint(value.lat, value.lon, value.ident || 'VOR', 4))
    features.ndbs.forEach((value) => addPoint(value.lat, value.lon, value.ident || 'NDB', 4))
    features.waypoints.forEach((value) => addPoint(value.lat, value.lon, value.ident, 3))
  } catch {
    navLayerGroup.clearLayers()
  }
}

async function searchMapPoints(
  query: string,
  callback: (items: NavMapSearchResult[]) => void
): Promise<void> {
  const types = layerOptions
    .filter((item) => item.key !== 'airways' && navLayers[item.key])
    .map((item) => item.key) as NavMapSearchType[]
  if (!query.trim() || types.length === 0) {
    callback([])
    return
  }
  try {
    callback(await client.searchNavMapPoints({ query, types, limit: 20 }))
  } catch {
    callback([])
  }
}

function focusSearchResult(item: NavMapSearchResult): void {
  followAircraft.value = false
  map?.setView([item.lat, item.lon], Math.max(map.getZoom(), 10))
}

function typeLabel(type: NavMapSearchType): string {
  return type === 'airports' ? 'APT' : type === 'waypoints' ? 'WPT' : type.toUpperCase()
}

async function searchAirports(query: string): Promise<NavAirportOption[]> {
  if (query.trim().length < 2) return []
  airportSearching.value = true
  try {
    return await client.searchNavAirports(query.trim())
  } finally {
    airportSearching.value = false
  }
}

async function searchDepartureAirports(query: string): Promise<void> {
  departureAirportOptions.value = await searchAirports(query)
}

async function searchDestinationAirports(query: string): Promise<void> {
  destinationAirportOptions.value = await searchAirports(query)
}

async function loadDepartureProcedures(): Promise<void> {
  const ident = draft.departureAirport.trim().toUpperCase()
  departureProcedures.value = ident ? await client.getNavAirportProcedures(ident) : EMPTY_PROCEDURES
}

async function loadDestinationProcedures(): Promise<void> {
  const ident = draft.destinationAirport.trim().toUpperCase()
  destinationProcedures.value = ident
    ? await client.getNavAirportProcedures(ident)
    : EMPTY_PROCEDURES
}

async function buildFlightPlan(): Promise<void> {
  if (!draft.departureAirport || !draft.destinationAirport) {
    ElMessage.warning(`${t('flightPlan.departureAirport')} / ${t('flightPlan.destinationAirport')}`)
    return
  }
  planBuilding.value = true
  try {
    flightPlanResult.value = await client.buildFlightPlan({ ...draft })
    persistStoredFlightPlanResult(flightPlanResult.value)
    fitRoute()
    ElMessage.success(t('feedback.updated'))
  } catch {
    ElMessage.error(t('flightPlan.error'))
  } finally {
    planBuilding.value = false
  }
}

async function importSimBrief(): Promise<void> {
  simbriefLoading.value = true
  try {
    const result = await client.importSimBrief({
      username: settings.value?.simbrief.username,
      userId: settings.value?.simbrief.userId
    })
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
    })
    departureAirportOptions.value = [
      { ident: result.departureAirport, name: result.departureAirport, city: null, country: null, lat: 0, lon: 0 }
    ]
    destinationAirportOptions.value = [
      { ident: result.destinationAirport, name: result.destinationAirport, city: null, country: null, lat: 0, lon: 0 }
    ]
    await Promise.all([loadDepartureProcedures(), loadDestinationProcedures()])
    draft.departureProcedureId = findProcedureId(
      departureProcedures.value.departures,
      result.departureProcedureName
    )
    draft.arrivalProcedureId = findProcedureId(
      destinationProcedures.value.arrivals,
      result.arrivalProcedureName
    )
    draft.approachProcedureId = findProcedureId(
      destinationProcedures.value.approaches,
      result.approachProcedureName
    )
    draft.arrivalTransitionId =
      destinationProcedures.value.transitions.find(
        (value) => value.name === result.arrivalTransitionName
      )?.id ?? null
    ElMessage.success(t('feedback.imported'))
  } catch {
    ElMessage.error(t('flightPlan.error'))
  } finally {
    simbriefLoading.value = false
  }
}

function findProcedureId(items: NavProcedureOption[], name: string | null): string | null {
  return items.find((item) => item.name === name)?.id ?? null
}

function clearFlightPlan(): void {
  Object.assign(draft, {
    departureAirport: '',
    destinationAirport: '',
    enrouteText: '',
    departureRunway: null,
    departureProcedureId: null,
    arrivalRunway: null,
    arrivalProcedureId: null,
    approachProcedureId: null,
    arrivalTransitionId: null
  })
  departureProcedures.value = EMPTY_PROCEDURES
  destinationProcedures.value = EMPTY_PROCEDURES
  flightPlanResult.value = null
  persistStoredFlightPlanResult(null)
}

function toggleChart(chartId: string): void {
  activeChartId.value = activeChartId.value === chartId ? null : chartId
}

function dockCardChartId(card: DockCard): string | null {
  return card.kind === 'manual' ? card.chart.id : card.chartId
}

function dockCardTagType(card: DockCard): 'success' | 'warning' | 'info' {
  if (card.kind === 'manual' || card.state === 'active') return 'success'
  if (card.state === 'missing-georef') return 'warning'
  return 'info'
}

function dockCardStateLabel(card: DockCard): string {
  if (card.kind === 'manual') return t('mapMount.manual')
  if (card.state === 'active') return t('mapMount.active')
  if (card.state === 'missing-georef') return t('mapMount.noGeoref')
  return t('mapMount.noChart')
}

function dockCardActionLabel(card: DockCard): string {
  const chartId = dockCardChartId(card)
  if (chartId && activeChartId.value === chartId) return t('common.close')
  if (card.kind === 'procedure' && card.state === 'missing-chart') {
    return t('mapMount.goChartLibrary')
  }
  if (card.kind === 'procedure' && card.state === 'missing-georef') {
    return t('mapMount.goBindGeo')
  }
  return t('mapMount.activate')
}

function handleDockCard(card: DockCard): void {
  if (card.kind === 'procedure' && card.state === 'missing-chart') {
    chartsVisible.value = false
    void router.push('/charts')
    return
  }
  const chartId = dockCardChartId(card)
  if (!chartId) return
  if (card.kind === 'procedure' && card.state === 'missing-georef') {
    chartsVisible.value = false
    void router.push(`/charts/${chartId}`)
    return
  }
  toggleChart(chartId)
}

async function renderChartOverlay(chartId: string | null): Promise<void> {
  chartOverlayCleanup?.()
  chartOverlayCleanup = null
  if (!map || !chartId) return
  const [asset, points] = await Promise.all([
    client.getChartAsset(chartId),
    client.getChartReferencePoints(chartId)
  ])
  if (!asset || points.length < 2) return
  const blob = asset.url
    ? await fetch(asset.url).then((response) => response.blob())
    : asset.base64
      ? base64ToBlob(asset.base64, asset.mimeType)
      : null
  if (!blob) return
  const objectUrl = URL.createObjectURL(blob)
  const container = L.DomUtil.create('div', 'chart-overlay-container', map.getPanes().overlayPane)
  const image = document.createElement('img')
  image.src = objectUrl
  image.alt = ''
  image.style.position = 'absolute'
  image.style.transformOrigin = '0 0'
  image.style.opacity = String((settings.value?.chartOpacity ?? 100) / 100)
  container.appendChild(image)

  const update = () => {
    if (!map) return
    const [first, second] = points
    const a = map.latLngToLayerPoint([first.mapLat, first.mapLon])
    const b = map.latLngToLayerPoint([second.mapLat, second.mapLon])
    const chartVector = { x: second.chartX - first.chartX, y: second.chartY - first.chartY }
    const mapVector = { x: b.x - a.x, y: b.y - a.y }
    const scale = Math.hypot(mapVector.x, mapVector.y) / Math.hypot(chartVector.x, chartVector.y)
    const angle =
      Math.atan2(mapVector.y, mapVector.x) - Math.atan2(chartVector.y, chartVector.x)
    const matrixA = scale * Math.cos(angle)
    const matrixB = scale * Math.sin(angle)
    const matrixC = -scale * Math.sin(angle)
    const matrixD = scale * Math.cos(angle)
    const matrixE = a.x - matrixA * first.chartX - matrixC * first.chartY
    const matrixF = a.y - matrixB * first.chartX - matrixD * first.chartY
    image.style.transform = `matrix(${matrixA}, ${matrixB}, ${matrixC}, ${matrixD}, ${matrixE}, ${matrixF})`
  }
  image.onload = update
  map.on('zoom viewreset move', update)
  chartOverlayCleanup = () => {
    map?.off('zoom viewreset move', update)
    container.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

function readMapView(): { lat: number; lon: number; zoom: number } {
  try {
    const value = JSON.parse(window.localStorage.getItem(MAP_VIEW_KEY) || '')
    if (
      Number.isFinite(value.lat) &&
      Number.isFinite(value.lon) &&
      Number.isFinite(value.zoom)
    ) {
      return value
    }
  } catch {
    // Use the language-sensitive default.
  }
  return settings.value?.language === 'en-US'
    ? { lat: 39.5, lon: -98.35, zoom: 5 }
    : { lat: 35.8, lon: 104.1, zoom: 5 }
}

function readNavLayers(): NavMapLayerVisibility {
  try {
    return {
      airports: false,
      airways: false,
      vors: false,
      ndbs: false,
      waypoints: false,
      ...JSON.parse(window.localStorage.getItem(NAV_LAYERS_KEY) || '{}')
    }
  } catch {
    return { airports: false, airways: false, vors: false, ndbs: false, waypoints: false }
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], {
    type: mimeType
  })
}

function formatNumber(value: number | undefined): string {
  return Number.isFinite(value) ? Math.round(value!).toLocaleString() : '-'
}
</script>

<style scoped>
.map-page {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map-canvas {
  width: 100%;
  height: 100%;
}

.map-toolbar {
  position: absolute;
  top: var(--el-component-size-small);
  left: var(--el-component-size-small);
  right: var(--el-component-size-small);
  z-index: 500;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: var(--el-component-size-small);
}

.toolbar-row .el-autocomplete {
  flex: 1;
}

.provider-select {
  width: 220px;
}

.map-controls {
  position: absolute;
  left: var(--el-component-size-small);
  bottom: var(--el-component-size-small);
  z-index: 500;
}

.map-actions {
  position: absolute;
  right: var(--el-component-size-small);
  top: 90px;
  z-index: 500;
}

.map-actions .el-button {
  width: 100%;
  margin-left: 0;
}

.flight-status {
  position: absolute;
  right: var(--el-component-size-small);
  bottom: var(--el-component-size-small);
  z-index: 500;
  min-width: 320px;
}

.drawer-form .el-select {
  width: 100%;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--el-component-size-small);
}
</style>
