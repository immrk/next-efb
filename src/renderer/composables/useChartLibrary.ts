import { onBeforeUnmount, onMounted, readonly, ref, shallowReadonly } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import type {
  ChartImportResult,
  ChartRecord,
  PickedChartFile,
  StorageSummary
} from '@shared/chart-types'
import { getAppClient } from '../client'
import { notifyChartChanged, subscribeChartChanged } from '../utils/chartSync'

const charts = ref<ChartRecord[]>([])
const storageSummary = ref<StorageSummary | null>(null)
const loading = ref(false)
let consumers = 0
let unsubscribe: (() => void) | null = null

export function useChartLibrary() {
  const client = getAppClient()

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      ;[charts.value, storageSummary.value] = await Promise.all([
        client.listCharts(),
        client.getStorageSummary()
      ])
    } finally {
      loading.value = false
    }
  }

  async function importPickedChart(picked: PickedChartFile | null): Promise<ChartImportResult | null> {
    if (!picked) return null
    const preview = picked.fileFormat === 'pdf' ? await rasterizeSinglePagePdf(picked) : null
    const result = await client.finalizeChartImport({
      sourcePath: picked.sourcePath,
      title: picked.fileName.replace(/\.[^.]+$/, ''),
      sourceFileName: picked.fileName,
      sourceFileBase64: picked.base64,
      sourceFileMimeType: picked.mimeType,
      sourceFileFormat: picked.fileFormat,
      displayImageBase64: preview?.base64 ?? null,
      displayImageMimeType: preview?.mimeType ?? null
    })
    await refresh()
    notifyChartChanged()
    return result
  }

  async function importChart(): Promise<ChartImportResult | null> {
    return importPickedChart(await client.pickChartFile())
  }

  async function importChartFromUrl(url: string): Promise<ChartImportResult | null> {
    return importPickedChart(await client.importChartFromUrl({ url }))
  }

  async function deleteChart(chartId: string): Promise<void> {
    await client.deleteChart(chartId)
    await refresh()
    notifyChartChanged()
  }

  onMounted(() => {
    consumers += 1
    if (consumers === 1) unsubscribe = subscribeChartChanged(() => void refresh())
    void refresh()
  })

  onBeforeUnmount(() => {
    consumers -= 1
    if (consumers === 0) {
      unsubscribe?.()
      unsubscribe = null
    }
  })

  return {
    charts: shallowReadonly(charts),
    storageSummary: readonly(storageSummary),
    loading: readonly(loading),
    refresh,
    importChart,
    importChartFromUrl,
    deleteChart
  }
}

async function rasterizeSinglePagePdf(
  file: PickedChartFile
): Promise<{ base64: string; mimeType: string }> {
  const binary = atob(file.base64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const loadingTask = pdfjs.getDocument({ data: bytes })
  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages !== 1) throw new Error('PDF_MULTI_PAGE_NOT_SUPPORTED')
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: context, viewport }).promise
    return {
      base64: canvas.toDataURL('image/png').split(',')[1] ?? '',
      mimeType: 'image/png'
    }
  } finally {
    void loadingTask.destroy()
  }
}
