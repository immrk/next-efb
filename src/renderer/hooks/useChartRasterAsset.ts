import { useEffect, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { ChartAssetPayload } from '@shared/chart-types'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

async function blobToImageUrl(blob: Blob): Promise<{ url: string; width: number; height: number }> {
  const url = URL.createObjectURL(blob)

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = reject
    image.src = url
  })

  return {
    url,
    width: dimensions.width,
    height: dimensions.height
  }
}

async function renderPdfFirstPage(blob: Blob): Promise<{ url: string; width: number; height: number }> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data: bytes })

  try {
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas 2D context unavailable')
    }

    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: context, viewport }).promise

    const blobResult = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error('Failed to export PDF canvas'))
          return
        }
        resolve(nextBlob)
      }, 'image/png')
    })

    const url = URL.createObjectURL(blobResult)
    return {
      url,
      width: canvas.width,
      height: canvas.height
    }
  } finally {
    void loadingTask.destroy()
  }
}

export function useChartRasterAsset(asset: ChartAssetPayload | null) {
  const [rasterUrl, setRasterUrl] = useState<string | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let currentUrl: string | null = null

    async function run() {
      if (!asset) {
        setRasterUrl(null)
        setWidth(null)
        setHeight(null)
        setError(null)
        return
      }

      try {
        const result = asset.url
          ? await blobToImageUrl(await fetch(asset.url).then((response) => response.blob()))
          : asset.base64
            ? asset.fileFormat === 'pdf'
              ? await renderPdfFirstPage(base64ToBlob(asset.base64, asset.mimeType))
              : await blobToImageUrl(base64ToBlob(asset.base64, asset.mimeType))
            : null

        if (!result) {
          throw new Error('Asset payload is empty')
        }

        if (!active) {
          URL.revokeObjectURL(result.url)
          return
        }

        currentUrl = result.url
        setRasterUrl(result.url)
        setWidth(result.width)
        setHeight(result.height)
        setError(null)
      } catch (nextError) {
        if (!active) return
        setRasterUrl(null)
        setWidth(null)
        setHeight(null)
        setError(nextError instanceof Error ? nextError.message : 'Failed to render asset')
      }
    }

    void run()

    return () => {
      active = false
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [asset])

  return {
    rasterUrl,
    width,
    height,
    error
  }
}
