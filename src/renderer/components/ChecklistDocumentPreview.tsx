import { useEffect, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { FileWarning, LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChecklistAssetPayload } from '@shared/checklist-types'
import { useTouchPinchZoom } from '../hooks/useTouchPinchZoom'
import { clampZoom } from '../utils/pinchZoom'
import { Button } from './ui/button'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface ChecklistDocumentPreviewProps {
  title: string
  asset: ChecklistAssetPayload | null
}

const CHECKLIST_MIN_ZOOM = 0.65
const CHECKLIST_MAX_ZOOM = 2.25

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function loadAssetBytes(asset: ChecklistAssetPayload): Promise<Uint8Array> {
  if (asset.base64) {
    return base64ToBytes(asset.base64)
  }
  if (asset.url) {
    const response = await fetch(asset.url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }
  throw new Error('CHECKLIST_ASSET_EMPTY')
}

function PdfPage({
  document,
  pageNumber
}: {
  document: PDFDocumentProxy
  pageNumber: number
}) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!canvas) return

    let active = true
    let page: PDFPageProxy | null = null
    let renderTask: ReturnType<PDFPageProxy['render']> | null = null

    void document
      .getPage(pageNumber)
      .then((loadedPage) => {
        if (!active) {
          loadedPage.cleanup()
          return
        }

        page = loadedPage
        const viewport = loadedPage.getViewport({ scale: 1 })
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('CANVAS_CONTEXT_UNAVAILABLE')
        }

        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        renderTask = loadedPage.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
        })
        return renderTask.promise
      })
      .then(() => {
        if (active) setError(false)
      })
      .catch((nextError) => {
        if (!active || nextError instanceof pdfjs.RenderingCancelledException) return
        setError(true)
      })

    return () => {
      active = false
      renderTask?.cancel()
      page?.cleanup()
    }
  }, [canvas, document, pageNumber])

  return (
    <figure className="checklist-pdf-page">
      {error ? <FileWarning aria-label="PDF page failed to render" /> : null}
      <canvas ref={setCanvas} aria-label={`Page ${pageNumber}`} />
      <figcaption>{pageNumber}</figcaption>
    </figure>
  )
}

function PdfPreview({
  asset,
  title
}: {
  asset: ChecklistAssetPayload
  title: string
}) {
  const { t } = useTranslation()
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [zoom, setZoom] = useState(1.15)
  const [error, setError] = useState<string | null>(null)
  const { surfaceRef, contentRef, isPinching } = useTouchPinchZoom<
    HTMLDivElement,
    HTMLDivElement
  >({
    enabled: Boolean(document),
    zoom,
    minimum: CHECKLIST_MIN_ZOOM,
    maximum: CHECKLIST_MAX_ZOOM,
    onZoomChange: setZoom
  })

  useEffect(() => {
    let active = true
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null
    setDocument(null)
    setError(null)
    setZoom(1.15)

    void loadAssetBytes(asset)
      .then((bytes) => {
        if (!active) return
        loadingTask = pdfjs.getDocument({ data: bytes })
        return loadingTask.promise
      })
      .then((loadedDocument) => {
        if (active && loadedDocument) {
          setDocument(loadedDocument)
        }
      })
      .catch((nextError) => {
        if (!active) return
        setError(nextError instanceof Error ? nextError.message : 'PDF_LOAD_FAILED')
      })

    return () => {
      active = false
      if (loadingTask) {
        void loadingTask.destroy()
      }
    }
  }, [asset])

  return (
    <section className="checklist-document-preview">
      <header className="checklist-preview-toolbar">
        <div className="checklist-preview-title">
          <strong>{title}</strong>
          {document ? (
            <span>{t('checklists.pageCount', { count: document.numPages })}</span>
          ) : null}
        </div>
        <div className="checklist-zoom-actions">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!document || zoom <= CHECKLIST_MIN_ZOOM}
            onClick={() =>
              setZoom((value) =>
                clampZoom(value - 0.1, CHECKLIST_MIN_ZOOM, CHECKLIST_MAX_ZOOM)
              )
            }
            aria-label={t('checklists.zoomOut')}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!document || zoom >= CHECKLIST_MAX_ZOOM}
            onClick={() =>
              setZoom((value) =>
                clampZoom(value + 0.1, CHECKLIST_MIN_ZOOM, CHECKLIST_MAX_ZOOM)
              )
            }
            aria-label={t('checklists.zoomIn')}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </header>
      <div
        ref={surfaceRef}
        className={`checklist-pdf-viewer ${isPinching ? 'is-pinching' : ''}`}
      >
        {error ? (
          <div className="empty-state">
            <FileWarning />
            <strong>{t('checklists.previewFailed')}</strong>
            <p>{error}</p>
          </div>
        ) : !document ? (
          <div className="empty-state">
            <LoaderCircle className="checklist-loading-icon" />
            <strong>{t('checklists.previewLoading')}</strong>
          </div>
        ) : (
          <div ref={contentRef} className="checklist-pdf-pages" style={{ zoom }}>
            {Array.from({ length: document.numPages }, (_, index) => (
              <PdfPage
                key={index + 1}
                document={document}
                pageNumber={index + 1}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ImagePreview({
  asset,
  title
}: {
  asset: ChecklistAssetPayload
  title: string
}) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const { surfaceRef, contentRef, isPinching } = useTouchPinchZoom<
    HTMLDivElement,
    HTMLImageElement
  >({
    enabled: Boolean(url),
    zoom,
    minimum: CHECKLIST_MIN_ZOOM,
    maximum: CHECKLIST_MAX_ZOOM,
    onZoomChange: setZoom
  })

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setUrl(null)
    setError(null)
    setZoom(1)

    void loadAssetBytes(asset)
      .then((bytes) => {
        if (!active) return
        const arrayBuffer = Uint8Array.from(bytes).buffer
        objectUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: asset.mimeType }))
        setUrl(objectUrl)
      })
      .catch((nextError) => {
        if (!active) return
        setError(nextError instanceof Error ? nextError.message : 'IMAGE_LOAD_FAILED')
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [asset])

  if (!url) {
    return (
      <div className="empty-state">
        {error ? <FileWarning /> : <LoaderCircle className="checklist-loading-icon" />}
        <strong>
          {error ? t('checklists.previewFailed') : t('checklists.previewLoading')}
        </strong>
        {error ? <p>{error}</p> : null}
      </div>
    )
  }

  return (
    <div
      ref={surfaceRef}
      className={`checklist-image-viewer ${isPinching ? 'is-pinching' : ''}`}
    >
      <img ref={contentRef} src={url} alt={title} style={{ zoom }} />
    </div>
  )
}

export function ChecklistDocumentPreview({
  title,
  asset
}: ChecklistDocumentPreviewProps) {
  const { t } = useTranslation()

  if (!asset) {
    return (
      <div className="empty-state">
        <FileWarning />
        <strong>{t('checklists.noAssetTitle')}</strong>
        <p>{t('checklists.noAssetDescription')}</p>
      </div>
    )
  }

  return asset.fileFormat === 'pdf' ? (
    <PdfPreview asset={asset} title={title} />
  ) : (
    <ImagePreview asset={asset} title={title} />
  )
}
