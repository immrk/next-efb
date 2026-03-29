import { useEffect, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type {
  ChartImportResult,
  ChartRecord,
  PickedChartFile,
  StorageSummary
} from '@shared/chart-types'

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function rasterizeSinglePagePdf(file: PickedChartFile): Promise<{ base64: string; mimeType: string }> {
  const loadingTask = pdfjs.getDocument({
    data: base64ToUint8Array(file.base64),
    disableWorker: true
  } as Parameters<typeof pdfjs.getDocument>[0])

  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages !== 1) {
      throw new Error('PDF_MULTI_PAGE_NOT_SUPPORTED')
    }

    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('CANVAS_CONTEXT_UNAVAILABLE')
    }

    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: context, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error('PDF_TO_IMAGE_FAILED'))
          return
        }
        resolve(nextBlob)
      }, 'image/png')
    })

    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })

    return {
      base64: btoa(binary),
      mimeType: 'image/png'
    }
  } finally {
    void loadingTask.destroy()
  }
}

export function useChartLibraryData() {
  const [charts, setCharts] = useState<ChartRecord[]>([])
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null)

  const refresh = () => {
    void window.msfsApi.listCharts().then(setCharts)
    void window.msfsApi.getStorageSummary().then(setStorageSummary)
  }

  useEffect(() => {
    refresh()
  }, [])

  const importChart = async (): Promise<ChartImportResult | null> => {
    const picked = await window.msfsApi.pickChartFile()
    if (!picked) return null

    let displayImageBase64: string | null = null
    let displayImageMimeType: string | null = null

    if (picked.fileFormat === 'pdf') {
      const rasterized = await rasterizeSinglePagePdf(picked)
      displayImageBase64 = rasterized.base64
      displayImageMimeType = rasterized.mimeType
    }

    const result = await window.msfsApi.finalizeChartImport({
      sourcePath: picked.sourcePath,
      title: picked.fileName.replace(/\.[^.]+$/, ''),
      displayImageBase64,
      displayImageMimeType
    })

    refresh()
    return result
  }

  const deleteChart = async (chartId: string): Promise<void> => {
    await window.msfsApi.deleteChart(chartId)
    refresh()
  }

  return {
    charts,
    storageSummary,
    refresh,
    importChart,
    deleteChart
  }
}
