import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import type { ChartAssetPayload, GeoReferencePoint } from '@shared/chart-types'
import type { AircraftState } from '@shared/types'
import { useChartRasterAsset } from '../hooks/useChartRasterAsset'
import { projectAircraftToChart } from '../utils/chartMath'
import { ChartAircraftArrow } from './AircraftArrow'

interface ChartImagePreviewProps {
  chartTitle: string
  asset: ChartAssetPayload | null
  points: GeoReferencePoint[]
  aircraft: AircraftState | null
  draftChartPoints?: Array<{ x: number; y: number }>
  onChartClick?: (point: { x: number; y: number }) => void
}

export function ChartImagePreview({
  chartTitle,
  asset,
  points,
  aircraft,
  draftChartPoints = [],
  onChartClick
}: ChartImagePreviewProps) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    active: boolean
    moved: boolean
    startX: number
    startY: number
    originPanX: number
    originPanY: number
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originPanX: 0,
    originPanY: 0
  })
  const { rasterUrl, width: rasterWidth, height: rasterHeight, error: rasterError } =
    useChartRasterAsset(asset)
  const projected = useMemo(() => projectAircraftToChart(aircraft, points), [aircraft, points])
  const naturalWidth = rasterWidth ?? 0
  const naturalHeight = rasterHeight ?? 0

  const projectedPercent = useMemo(() => {
    if (!projected || !naturalWidth || !naturalHeight) return null
    return {
      left: `${(projected.x / naturalWidth) * 100}%`,
      top: `${(projected.y / naturalHeight) * 100}%`
    }
  }, [naturalHeight, naturalWidth, projected])

  const clampZoom = (value: number) => Math.min(5, Math.max(0.4, value))

  const updateZoom = (nextZoom: number, clientX?: number, clientY?: number) => {
    const clamped = clampZoom(nextZoom)
    if (!viewportRef.current || clientX === undefined || clientY === undefined) {
      setZoom(clamped)
      return
    }

    const rect = viewportRef.current.getBoundingClientRect()
    const pointerX = clientX - rect.left
    const pointerY = clientY - rect.top

    const worldX = (pointerX - pan.x) / zoom
    const worldY = (pointerY - pan.y) / zoom

    setZoom(clamped)
    setPan({
      x: pointerX - worldX * clamped,
      y: pointerY - worldY * clamped
    })
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const ratio = event.deltaY > 0 ? 0.9 : 1.1
    updateZoom(zoom * ratio, event.clientX, event.clientY)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType !== 'touch') return
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originPanX: pan.x,
      originPanY: pan.y
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragRef.current.moved = true
    }
    setPan({
      x: dragRef.current.originPanX + deltaX,
      y: dragRef.current.originPanY + deltaY
    })
  }

  const finishDrag = () => {
    dragRef.current.active = false
    setIsDragging(false)
  }

  const handleChartClick = (event: MouseEvent<HTMLElement>) => {
    if (!onChartClick) return
    if (!naturalWidth || !naturalHeight) return
    if (dragRef.current.moved) return

    const viewportRect = viewportRef.current?.getBoundingClientRect()
    if (!viewportRect) return

    const pointerX = event.clientX - viewportRect.left
    const pointerY = event.clientY - viewportRect.top
    const x = (pointerX - pan.x) / zoom
    const y = (pointerY - pan.y) / zoom

    onChartClick({
      x: Math.max(0, Math.min(naturalWidth, x)),
      y: Math.max(0, Math.min(naturalHeight, y))
    })
  }

  if (!asset) {
    return (
      <div className="empty-state">
        <strong>{t('chartPreview.noAssetTitle')}</strong>
        <p>{t('chartPreview.noAssetDescription')}</p>
      </div>
    )
  }

  if (!rasterUrl) {
    return (
      <div className="empty-state">
        <strong>{t('chartPreview.notReadyTitle')}</strong>
        <p>{rasterError ?? asset.mimeType}</p>
      </div>
    )
  }

  return (
    <div className="chart-preview-frame">
      <div className="chart-zoom-toolbar">
        <button
          type="button"
          className="chart-zoom-button"
          onClick={() => updateZoom(zoom - 0.1)}
        >
          -
        </button>
        <span className="chart-zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="chart-zoom-button"
          onClick={() => updateZoom(zoom + 0.1)}
        >
          +
        </button>
        <button
          type="button"
          className="chart-zoom-button"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
        >
          {t('chartPreview.resetZoom')}
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`chart-preview-viewport ${isDragging ? 'dragging' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div
          className="chart-surface chart-pan-stage"
          style={{
            width: naturalWidth,
            height: naturalHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
          onClick={handleChartClick}
          onDragStart={(event) => event.preventDefault()}
        >
          <img
            ref={imageRef}
            src={rasterUrl}
            alt={chartTitle}
            className="chart-image chart-image-zoomed"
            draggable={false}
          />
          {projectedPercent ? (
            <ChartAircraftArrow
              x={projectedPercent.left}
              y={projectedPercent.top}
              headingDeg={aircraft?.headingDeg ?? 0}
            />
          ) : null}
          {draftChartPoints.map((point, index) => (
            <div
              key={`${point.x}-${point.y}`}
              className="chart-reference-dot"
              style={{
                left: naturalWidth ? `${(point.x / naturalWidth) * 100}%` : point.x,
                top: naturalHeight ? `${(point.y / naturalHeight) * 100}%` : point.y
              }}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
