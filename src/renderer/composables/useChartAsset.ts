import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import type { ChartAssetPayload } from '@shared/chart-types'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export function useChartAsset(asset: Ref<ChartAssetPayload | null>) {
  const url = ref<string | null>(null)
  const width = ref<number | null>(null)
  const height = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let currentObjectUrl: string | null = null
  let runId = 0

  function clearObjectUrl(): void {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }

  watch(
    asset,
    async (value) => {
      const id = ++runId
      clearObjectUrl()
      url.value = null
      width.value = null
      height.value = null
      error.value = null
      if (!value) return
      loading.value = true
      try {
        const blob = value.url
          ? await fetch(value.url).then((response) => response.blob())
          : value.base64
            ? base64ToBlob(value.base64, value.mimeType)
            : null
        if (!blob) throw new Error('EMPTY_CHART_ASSET')
        const result =
          value.fileFormat === 'pdf' ? await renderPdf(blob) : await renderImage(blob)
        if (id !== runId) {
          URL.revokeObjectURL(result.url)
          return
        }
        currentObjectUrl = result.url
        url.value = result.url
        width.value = result.width
        height.value = result.height
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : 'CHART_RENDER_FAILED'
      } finally {
        if (id === runId) loading.value = false
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(clearObjectUrl)
  return { url, width, height, loading, error }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], {
    type: mimeType
  })
}

async function renderImage(blob: Blob): Promise<{ url: string; width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  const image = new Image()
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = reject
    image.src = url
  })
  return { url, ...dimensions }
}

async function renderPdf(blob: Blob): Promise<{ url: string; width: number; height: number }> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
  try {
    const page = await (await task.promise).getPage(1)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: context, viewport }).promise
    const output = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PDF_RENDER_FAILED'))))
    )
    return { url: URL.createObjectURL(output), width: canvas.width, height: canvas.height }
  } finally {
    void task.destroy()
  }
}
