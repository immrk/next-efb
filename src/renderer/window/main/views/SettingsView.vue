<template>
  <section class="page-container">
    <header class="page-header">
      <div>
        <el-text tag="h2">{{ t('settings.title') }}</el-text>
        <el-text type="info">{{ t('settings.subtitle') }}</el-text>
      </div>
    </header>

    <el-skeleton :loading="!settings" animated>
      <el-space v-if="settings" direction="vertical" fill class="settings-stack">
        <el-card shadow="never">
          <template #header>{{ t('settings.language') }}</template>
          <el-form label-position="top">
            <el-form-item :label="t('settings.language')">
              <el-select :model-value="settings.language" @change="updateLanguage">
                <el-option value="zh-CN" :label="t('settings.languageZhCN')" />
                <el-option value="en-US" label="English" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="runtime.isDev" :label="t('settings.provider')">
              <el-select :model-value="settings.providerMode" @change="updateProvider">
                <el-option value="simconnect" :label="t('settings.providerSimConnect')" />
                <el-option value="mock" :label="t('settings.providerMock')" />
              </el-select>
              <el-text type="info">{{ t('settings.providerNotice') }}</el-text>
            </el-form-item>
            <el-form-item :label="t('settings.mapTileProvider')">
              <el-select :model-value="settings.mapTileProvider" @change="updateMapProvider">
                <el-option
                  v-for="provider in mapProviders"
                  :key="provider.value"
                  :value="provider.value"
                  :label="provider.label"
                />
              </el-select>
              <el-text type="info">{{ t('settings.mapTileProviderHint') }}</el-text>
            </el-form-item>
            <el-form-item :label="t('settings.chartOpacity')">
              <el-slider
                :model-value="settings.chartOpacity"
                :min="20"
                :max="100"
                :step="5"
                show-input
                @change="updateChartOpacity"
              />
              <el-text type="info">{{ t('settings.chartOpacityHint') }}</el-text>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>{{ t('settings.navDataTitle') }}</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item :label="t('settings.navDataDefaultPath', { path: '' })">
              {{ navStatus?.defaultPath || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('settings.navDataActivePath', { path: '' })">
              {{ navStatus?.activePath || t('settings.navDataMissing') }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="setting-row">
            <el-input v-model="navPath" :placeholder="t('settings.navDataPathPlaceholder')" />
            <el-button v-if="runtime.host === 'electron'" @click="pickNavPath">
              {{ t('settings.navDataBrowse') }}
            </el-button>
            <el-button type="primary" @click="saveNavPath">
              {{ t('settings.navDataSave') }}
            </el-button>
            <el-button @click="clearNavPath">{{ t('settings.navDataClear') }}</el-button>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>{{ t('settings.chartLibraryTitle') }}</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item :label="t('settings.chartLibraryDefaultPath', { path: '' })">
              {{ storage?.defaultChartsRoot || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('settings.chartLibraryActivePath', { path: '' })">
              {{ storage?.chartsRoot || '-' }}
            </el-descriptions-item>
          </el-descriptions>
          <el-text type="info">{{ t('settings.chartLibraryHint') }}</el-text>
          <div class="setting-row">
            <el-input v-model="chartPath" :placeholder="storage?.defaultChartsRoot" />
            <el-button v-if="runtime.host === 'electron'" @click="pickChartPath">
              {{ t('settings.chartLibraryBrowse') }}
            </el-button>
            <el-button type="primary" :loading="savingChartPath" @click="saveChartPath(chartPath)">
              {{ t('settings.chartLibrarySave') }}
            </el-button>
            <el-button :loading="savingChartPath" @click="saveChartPath(null)">
              {{ t('settings.chartLibraryReset') }}
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>{{ t('settings.simbriefTitle') }}</template>
          <el-form label-position="top">
            <el-form-item :label="t('settings.simbriefUsername')">
              <el-input v-model="simbriefUsername" />
            </el-form-item>
            <el-button type="primary" @click="saveSimBrief">
              {{ t('settings.simbriefSave') }}
            </el-button>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>{{ t('settings.remoteAccess') }}</template>
          <el-alert
            :title="
              remoteStatus?.running
                ? t('settings.remoteAccessEnabled')
                : t('settings.remoteAccessDisabled')
            "
            :type="remoteStatus?.running ? 'success' : 'info'"
            :closable="false"
          />
          <div v-if="remoteStatus?.primaryAccessUrl" class="remote-access">
            <div>
              <el-link type="primary" @click="openAccessUrl">
                {{ remoteStatus.primaryAccessUrl }}
              </el-link>
              <el-text type="info">{{ t('settings.remoteAccessOpenHint') }}</el-text>
            </div>
            <el-image v-if="qrCodeUrl" :src="qrCodeUrl" fit="contain" class="qr-code" />
          </div>
          <el-form
            v-if="runtime.host === 'electron'"
            label-position="left"
            label-width="220"
            class="lan-form"
          >
            <el-form-item :label="t('settings.remoteAccessEnabledToggle')">
              <el-switch
                :model-value="settings.lanAccess.enabled"
                @change="updateLan({ enabled: Boolean($event) })"
              />
            </el-form-item>
            <el-form-item :label="t('settings.remoteAccessAuthToggle')">
              <el-switch
                :model-value="settings.lanAccess.authEnabled"
                @change="updateLan({ authEnabled: Boolean($event) })"
              />
            </el-form-item>
            <el-form-item :label="t('settings.remoteAccessApplyPort')">
              <el-input-number v-model="lanPort" :min="1024" :max="65535" />
              <el-button type="primary" @click="updateLan({ port: lanPort })">
                {{ t('settings.remoteAccessApplyPort') }}
              </el-button>
            </el-form-item>
            <el-form-item v-if="settings.lanAccess.authEnabled" label="Token">
              <el-input :model-value="settings.lanAccess.authToken" readonly />
            </el-form-item>
          </el-form>
        </el-card>
      </el-space>
    </el-skeleton>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import QRCode from 'qrcode'
import { useI18n } from 'vue-i18n'
import type {
  AircraftSource,
  AppLanguage,
  AppSettings,
  MapTileProvider,
  RemoteAccessStatus
} from '@shared/types'
import type { NavDataStatus } from '@shared/flight-plan-types'
import type { StorageSummary } from '@shared/chart-types'
import { getAppClient } from '../../../client'
import { useAppState } from '../../../composables/useAppState'

const client = getAppClient()
const runtime = client.getRuntime()
const { t, locale } = useI18n()
const appState = useAppState()
const settings = computed(() => appState.settings.value)
const navStatus = ref<NavDataStatus | null>(null)
const storage = ref<StorageSummary | null>(null)
const remoteStatus = ref<RemoteAccessStatus | null>(null)
const navPath = ref('')
const chartPath = ref('')
const simbriefUsername = ref('')
const lanPort = ref(31831)
const qrCodeUrl = ref('')
const savingChartPath = ref(false)

const mapProviders = computed(() => [
  { value: 'esriWorldStreet', label: t('settings.mapTileProviderEsriWorldStreet') },
  { value: 'osm', label: t('settings.mapTileProviderOsm') },
  { value: 'osmHot', label: t('settings.mapTileProviderOsmHot') },
  { value: 'osmfr', label: t('settings.mapTileProviderOsmFr') },
  { value: 'cartoLight', label: t('settings.mapTileProviderCartoLight') },
  { value: 'cartoVoyager', label: t('settings.mapTileProviderCartoVoyager') }
])

watch(
  settings,
  (value) => {
    if (!value) return
    navPath.value = value.navData.sqlitePath ?? ''
    chartPath.value = value.storage.chartLibraryPath ?? storage.value?.chartsRoot ?? ''
    simbriefUsername.value = value.simbrief.username
    lanPort.value = value.lanAccess.port
  },
  { immediate: true }
)

watch(
  () => remoteStatus.value?.primaryAccessUrl,
  async (value) => {
    qrCodeUrl.value = value ? await QRCode.toDataURL(value, { margin: 1, width: 180 }) : ''
  }
)

onMounted(async () => {
  ;[navStatus.value, storage.value, remoteStatus.value] = await Promise.all([
    client.getNavDataStatus(),
    client.getStorageSummary(),
    client.getRemoteAccessStatus()
  ])
  if (settings.value) chartPath.value = settings.value.storage.chartLibraryPath ?? storage.value.chartsRoot
})

async function applySettings(partial: Partial<AppSettings>): Promise<void> {
  appState.setSettings(await client.updateSettings(partial))
}

async function updateLanguage(value: AppLanguage): Promise<void> {
  await applySettings({ language: value })
  locale.value = value
}

async function updateProvider(value: AircraftSource): Promise<void> {
  await applySettings({ providerMode: value })
}

async function updateMapProvider(value: MapTileProvider): Promise<void> {
  await applySettings({ mapTileProvider: value })
}

async function updateChartOpacity(value: number | number[]): Promise<void> {
  await applySettings({ chartOpacity: Array.isArray(value) ? value[0] : value })
}

async function pickNavPath(): Promise<void> {
  const value = await client.pickNavSqliteFile()
  if (value) navPath.value = value
}

async function saveNavPath(): Promise<void> {
  await applySettings({ navData: { autoDetect: true, sqlitePath: navPath.value.trim() || null } })
  navStatus.value = await client.getNavDataStatus()
  ElMessage.success(t('feedback.saved'))
}

async function clearNavPath(): Promise<void> {
  navPath.value = ''
  await saveNavPath()
}

async function pickChartPath(): Promise<void> {
  const value = await client.pickChartsDirectory()
  if (value) chartPath.value = value
}

async function saveChartPath(value: string | null): Promise<void> {
  savingChartPath.value = true
  try {
    await applySettings({ storage: { chartLibraryPath: value?.trim() || null } })
    storage.value = await client.getStorageSummary()
    chartPath.value = settings.value?.storage.chartLibraryPath ?? storage.value.chartsRoot
    ElMessage.success(t('feedback.saved'))
  } finally {
    savingChartPath.value = false
  }
}

async function saveSimBrief(): Promise<void> {
  await applySettings({
    simbrief: { username: simbriefUsername.value.trim(), userId: '' }
  })
  ElMessage.success(t('feedback.saved'))
}

async function updateLan(partial: Partial<AppSettings['lanAccess']>): Promise<void> {
  if (!settings.value) return
  await applySettings({ lanAccess: { ...settings.value.lanAccess, ...partial } })
  remoteStatus.value = await client.getRemoteAccessStatus()
}

function openAccessUrl(): void {
  if (remoteStatus.value?.primaryAccessUrl) {
    void client.openExternal(remoteStatus.value.primaryAccessUrl)
  }
}
</script>

<style scoped>
.settings-stack {
  width: 100%;
}

.setting-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--el-component-size-small);
  margin-top: var(--el-component-size-small);
}

.setting-row .el-input {
  flex: 1;
  min-width: 280px;
}

.remote-access {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--el-component-size);
  margin: var(--el-component-size) 0;
}

.remote-access > div {
  display: flex;
  flex-direction: column;
  gap: var(--el-component-size-small);
}

.qr-code {
  width: 180px;
  height: 180px;
}

.lan-form .el-button {
  margin-left: var(--el-component-size-small);
}
</style>
