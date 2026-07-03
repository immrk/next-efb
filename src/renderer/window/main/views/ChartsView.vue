<template>
  <section class="page-container">
    <header class="page-header">
      <div>
        <el-text tag="h2">{{ t('nav.charts') }}</el-text>
        <el-text type="info">{{ storageSummary?.chartsRoot }}</el-text>
      </div>
      <div class="page-actions">
        <el-input
          v-model="search"
          clearable
          :prefix-icon="Search"
          :placeholder="t('charts.searchPlaceholder')"
        />
        <el-button type="primary" :icon="Upload" :loading="importing" @click="handleImport">
          {{ t('charts.importAction') }}
        </el-button>
        <el-button :icon="Link" @click="urlDialogVisible = true">
          {{ t('charts.importUrlToggle') }}
        </el-button>
      </div>
    </header>

    <el-skeleton :loading="loading" animated>
      <el-empty
        v-if="filteredCharts.length === 0"
        :description="search ? t('charts.searchEmpty') : t('charts.emptyDescription')"
      />
      <el-row v-else :gutter="16">
        <el-col
          v-for="chart in filteredCharts"
          :key="chart.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <el-card shadow="hover" class="chart-card" @click="openChart(chart.id)">
            <template #header>
              <div class="card-header">
                <el-text truncated>{{ chart.title }}</el-text>
                <el-tag :type="chart.isGeoreferenced ? 'success' : 'info'">
                  {{
                    chart.isGeoreferenced
                      ? t('charts.georeferenced')
                      : t('charts.notGeoreferenced')
                  }}
                </el-tag>
              </div>
            </template>
            <el-descriptions :column="1" size="small">
              <el-descriptions-item :label="t('chartDetail.fieldAirportCode')">
                {{ chart.airportCode || '-' }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('chartDetail.fieldChartType')">
                {{ t(`chartType.${chart.chartType}`) }}
              </el-descriptions-item>
              <el-descriptions-item label="Format">
                {{ chart.fileFormat.toUpperCase() }}
              </el-descriptions-item>
            </el-descriptions>
            <template #footer>
              <el-button type="primary" text :icon="Edit" @click.stop="openChart(chart.id)">
                {{ t('chartDetail.editMeta') }}
              </el-button>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </el-skeleton>

    <el-dialog v-model="urlDialogVisible" :title="t('charts.importUrlToggle')" width="520">
      <el-input v-model="importUrl" :placeholder="t('charts.importUrlPlaceholder')" />
      <template #footer>
        <el-button @click="urlDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="importing" @click="handleUrlImport">
          {{ t('charts.importUrlAction') }}
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Edit, Link, Search, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useChartLibrary } from '../../../composables/useChartLibrary'

const { t } = useI18n()
const router = useRouter()
const { charts, storageSummary, loading, importChart, importChartFromUrl } = useChartLibrary()
const search = ref('')
const importUrl = ref('')
const importing = ref(false)
const urlDialogVisible = ref(false)

const filteredCharts = computed(() => {
  const needle = search.value.trim().toLowerCase()
  if (!needle) return charts.value
  return charts.value.filter((chart) =>
    [chart.title, chart.airportCode, chart.chartType, chart.fileFormat]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  )
})

function openChart(chartId: string): void {
  void router.push(`/charts/${chartId}`)
}

async function handleImport(): Promise<void> {
  importing.value = true
  try {
    const result = await importChart()
    if (result) {
      ElMessage.success(t('feedback.imported'))
      openChart(result.chart.id)
    }
  } catch {
    ElMessage.error(t('charts.importFailed'))
  } finally {
    importing.value = false
  }
}

async function handleUrlImport(): Promise<void> {
  const url = importUrl.value.trim()
  if (!/^https?:\/\//i.test(url)) {
    ElMessage.warning(t('charts.importUrlErrorInvalid'))
    return
  }
  importing.value = true
  try {
    const result = await importChartFromUrl(url)
    if (result) {
      urlDialogVisible.value = false
      importUrl.value = ''
      ElMessage.success(t('feedback.imported'))
      openChart(result.chart.id)
    }
  } catch {
    ElMessage.error(t('charts.importUrlFailed'))
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.chart-card {
  margin-bottom: var(--el-component-size-small);
  cursor: pointer;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--el-component-size-small);
}
</style>
