import * as pdfjs from 'pdfjs-dist'
import type { ChartImportResult, PickedChartFile } from '@shared/chart-types'
import type { AppClient } from '../client/AppClient'

export async function finalizePickedChart(
  appClient: AppClient,
  picked: PickedChartFile | null
): Promise<ChartImportResult | null> {
  if (!picked) return null

  let displayImageBase64: string | null = null
  let displayImageMimeType: string | null = null

  if (picked.fileFormat === 'pdf') {
    const rasterized = await rasterizeSinglePagePdf(picked)
    displayImageBase64 = rasterized.base64
    displayImageMimeType = rasterized.mimeType
  }

  return appClient.finalizeChartImport({
    sourcePath: picked.sourcePath,
    title: picked.fileName.replace(/\.[^.]+$/, ''),
    sourceFileName: picked.fileName,
    sourceFileBase64: picked.base64,
    sourceFileMimeType: picked.mimeType,
    sourceFileFormat: picked.fileFormat,
    displayImageBase64,
    displayImageMimeType
  })
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function rasterizeSinglePagePdf(
  file: PickedChartFile
): Promise<{ base64: string; mimeType: string }> {
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

    const bytes = new Uint8Array(await blob.arrayBuffer())
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
