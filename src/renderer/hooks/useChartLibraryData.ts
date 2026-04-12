import { useEffect, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type {
  ChartImportResult,
  ChartRecord,
  PickedChartFile,
  StorageSummary
} from '@shared/chart-types'
import { getAppClient } from '../client'
import { notifyChartChanged, subscribeChartChanged } from '../utils/chartSync'

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
  const appClient = getAppClient()
  const [charts, setCharts] = useState<ChartRecord[]>([])
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null)

  const refresh = () => {
    void appClient.listCharts().then(setCharts)
    void appClient.getStorageSummary().then(setStorageSummary)
  }

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeChartChanged(() => {
      refresh()
    })
    return () => {
      unsubscribe()
    }
  }, [appClient])

  const importPickedChart = async (picked: PickedChartFile | null): Promise<ChartImportResult | null> => {
    if (!picked) return null

    let displayImageBase64: string | null = null
    let displayImageMimeType: string | null = null

    if (picked.fileFormat === 'pdf') {
      const rasterized = await rasterizeSinglePagePdf(picked)
      displayImageBase64 = rasterized.base64
      displayImageMimeType = rasterized.mimeType
    }

    const result = await appClient.finalizeChartImport({
      sourcePath: picked.sourcePath,
      title: picked.fileName.replace(/\.[^.]+$/, ''),
      sourceFileName: picked.fileName,
      sourceFileBase64: picked.base64,
      sourceFileMimeType: picked.mimeType,
      sourceFileFormat: picked.fileFormat,
      displayImageBase64,
      displayImageMimeType
    })

    refresh()
    notifyChartChanged()
    return result
  }

  const importChart = async (): Promise<ChartImportResult | null> => {
    const picked = await appClient.pickChartFile()
    return importPickedChart(picked)
  }

  const importChartFromUrl = async (url: string): Promise<ChartImportResult | null> => {
    const picked = await appClient.importChartFromUrl({ url })
    return importPickedChart(picked)
  }

  const deleteChart = async (chartId: string): Promise<void> => {
    await appClient.deleteChart(chartId)
    refresh()
    notifyChartChanged()
  }

  return {
    charts,
    storageSummary,
    refresh,
    importChart,
    importChartFromUrl,
    deleteChart
  }
}
