import {
  useEffect,
  useLayoutEffect,
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
import { getChartFitView, getChartRotationDeg, projectAircraftToChart } from '../utils/chartMath'
import { ChartAircraftArrow } from './AircraftArrow'
import { Button } from './ui/button'

interface ChartImagePreviewProps {
  chartTitle: string
  asset: ChartAssetPayload | null
  points: GeoReferencePoint[]
  aircraft: AircraftState | null
  draftChartPoints?: Array<{ x: number; y: number }>
  autoFocusKey?: number
  onChartClick?: (point: { x: number; y: number }) => void
  onDraftChartPointMove?: (index: number, point: { x: number; y: number }) => void
}

function clampZoomValue(value: number): number {
  return Math.min(5, Math.max(0.4, value))
}

export function ChartImagePreview({
  chartTitle,
  asset,
  points,
  aircraft,
  draftChartPoints = [],
  autoFocusKey = 0,
  onChartClick,
  onDraftChartPointMove
}: ChartImagePreviewProps) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
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
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{
    active: boolean
    startDistance: number
    startZoom: number
    worldX: number
    worldY: number
  }>({
    active: false,
    startDistance: 0,
    startZoom: 1,
    worldX: 0,
    worldY: 0
  })
  const pinDragRef = useRef<{
    active: boolean
    index: number
  }>({
    active: false,
    index: -1
  })
  const suppressClickRef = useRef(false)
  const fittedRasterUrlRef = useRef<string | null>(null)
  const [draggingPinIndex, setDraggingPinIndex] = useState<number | null>(null)
  const { rasterUrl, width: rasterWidth, height: rasterHeight, error: rasterError } =
    useChartRasterAsset(asset)
  const projected = useMemo(() => projectAircraftToChart(aircraft, points), [aircraft, points])
  const chartRotationDeg = useMemo(() => getChartRotationDeg(points), [points])
  const naturalWidth = rasterWidth ?? 0
  const naturalHeight = rasterHeight ?? 0
  const fitView = useMemo(
    () =>
      getChartFitView(
        naturalWidth,
        naturalHeight,
        viewportSize.width,
        viewportSize.height
      ),
    [naturalHeight, naturalWidth, viewportSize.height, viewportSize.width]
  )
  const fitScale = fitView?.scale ?? 1
  const renderScale = fitScale * zoom

  const projectedScreenPoint = useMemo(() => {
    if (!projected) return null
    return {
      left: pan.x + projected.x * renderScale,
      top: pan.y + projected.y * renderScale
    }
  }, [pan.x, pan.y, projected, renderScale])

  const chartPins = useMemo(
    () =>
      draftChartPoints.map((point, index) => ({
        index,
        key: `${point.x}-${point.y}`,
        label: String(index + 1),
        left: pan.x + point.x * renderScale,
        top: pan.y + point.y * renderScale
      })),
    [draftChartPoints, pan.x, pan.y, renderScale]
  )
  const canDragPins = draftChartPoints.length === 2 && Boolean(onDraftChartPointMove)

  const clientToChartPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!viewportRef.current || !naturalWidth || !naturalHeight) return null
    const viewportRect = viewportRef.current.getBoundingClientRect()
    const pointerX = clientX - viewportRect.left
    const pointerY = clientY - viewportRect.top
    const x = (pointerX - pan.x) / renderScale
    const y = (pointerY - pan.y) / renderScale
    return {
      x: Math.max(0, Math.min(naturalWidth, x)),
      y: Math.max(0, Math.min(naturalHeight, y))
    }
  }

  const updateZoom = (nextZoom: number, clientX?: number, clientY?: number) => {
    const clamped = clampZoomValue(nextZoom)
    if (!viewportRef.current) {
      setZoom(clamped)
      return
    }

    const rect = viewportRef.current.getBoundingClientRect()
    const pointerX = clientX === undefined ? rect.width / 2 : clientX - rect.left
    const pointerY = clientY === undefined ? rect.height / 2 : clientY - rect.top

    const worldX = (pointerX - pan.x) / renderScale
    const worldY = (pointerY - pan.y) / renderScale
    const nextRenderScale = fitScale * clamped

    setZoom(clamped)
    setPan({
      x: pointerX - worldX * nextRenderScale,
      y: pointerY - worldY * nextRenderScale
    })
  }

  const resetToFit = () => {
    const viewportRect = viewportRef.current?.getBoundingClientRect()
    const nextFitView = viewportRect
      ? getChartFitView(
          naturalWidth,
          naturalHeight,
          viewportRect.width,
          viewportRect.height
        )
      : fitView

    setZoom(1)
    setPan({
      x: nextFitView?.panX ?? 0,
      y: nextFitView?.panY ?? 0
    })
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const ratio = event.deltaY > 0 ? 0.9 : 1.1
    updateZoom(zoom * ratio, event.clientX, event.clientY)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pinDragRef.current.active) return
    if (event.button !== 0 && event.pointerType !== 'touch') return
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    })
    event.currentTarget.setPointerCapture(event.pointerId)

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values())
      const centerX = (first.x + second.x) / 2
      const centerY = (first.y + second.y) / 2
      const rect = viewportRef.current?.getBoundingClientRect()
      const pointerX = rect ? centerX - rect.left : centerX
      const pointerY = rect ? centerY - rect.top : centerY
      const distance = Math.hypot(second.x - first.x, second.y - first.y)

      pinchRef.current = {
        active: distance > 0,
        startDistance: distance,
        startZoom: zoom,
        worldX: (pointerX - pan.x) / renderScale,
        worldY: (pointerY - pan.y) / renderScale
      }
      dragRef.current.active = false
      dragRef.current.moved = false
      setIsDragging(false)
      return
    }

    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originPanX: pan.x,
      originPanY: pan.y
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      })
    }

    if (pinchRef.current.active && pointersRef.current.size >= 2) {
      const [first, second] = Array.from(pointersRef.current.values())
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return

      const centerX = (first.x + second.x) / 2
      const centerY = (first.y + second.y) / 2
      const pointerX = centerX - rect.left
      const pointerY = centerY - rect.top
      const distance = Math.hypot(second.x - first.x, second.y - first.y)

      if (distance <= 0 || pinchRef.current.startDistance <= 0) {
        return
      }

      const nextZoom = clampZoomValue(
        pinchRef.current.startZoom * (distance / pinchRef.current.startDistance)
      )
      const nextRenderScale = fitScale * nextZoom
      setZoom(nextZoom)
      setPan({
        x: pointerX - pinchRef.current.worldX * nextRenderScale,
        y: pointerY - pinchRef.current.worldY * nextRenderScale
      })
      return
    }

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

  const finishDrag = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event) {
      pointersRef.current.delete(event.pointerId)
    }

    if (pointersRef.current.size < 2) {
      pinchRef.current.active = false
    }

    if (pointersRef.current.size === 1) {
      const [remainingPointer] = Array.from(pointersRef.current.values())
      dragRef.current = {
        active: true,
        moved: false,
        startX: remainingPointer.x,
        startY: remainingPointer.y,
        originPanX: pan.x,
        originPanY: pan.y
      }
      setIsDragging(true)
      return
    }

    dragRef.current.active = false
    setIsDragging(false)
  }

  const handleChartClick = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (!onChartClick) return
    if (dragRef.current.moved) return

    const point = clientToChartPoint(event.clientX, event.clientY)
    if (!point) return
    onChartClick(point)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !rasterUrl) return

    const measureViewport = () => {
      const rect = viewport.getBoundingClientRect()
      setViewportSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height }
      )
    }

    measureViewport()
    const observer = new ResizeObserver(measureViewport)
    observer.observe(viewport)

    return () => {
      observer.disconnect()
    }
  }, [rasterUrl])

  useLayoutEffect(() => {
    if (!rasterUrl || !fitView) return

    if (fittedRasterUrlRef.current !== rasterUrl) {
      fittedRasterUrlRef.current = rasterUrl
      setZoom(1)
      setPan({ x: fitView.panX, y: fitView.panY })
      return
    }

    if (zoom === 1) {
      setPan({ x: fitView.panX, y: fitView.panY })
    }
  }, [fitView, rasterUrl, zoom])

  useEffect(() => {
    if (autoFocusKey <= 0) return
    if (draftChartPoints.length !== 2) return
    if (!viewportRef.current || !naturalWidth || !naturalHeight) return

    const [p1, p2] = draftChartPoints
    if (!p1 || !p2) return

    const viewportRect = viewportRef.current.getBoundingClientRect()
    if (viewportRect.width <= 0 || viewportRect.height <= 0) return

    const minX = Math.max(0, Math.min(p1.x, p2.x))
    const minY = Math.max(0, Math.min(p1.y, p2.y))
    const maxX = Math.min(naturalWidth, Math.max(p1.x, p2.x))
    const maxY = Math.min(naturalHeight, Math.max(p1.y, p2.y))
    const boxWidth = Math.max(maxX - minX, 24)
    const boxHeight = Math.max(maxY - minY, 24)
    const padding = 72
    const availableWidth = Math.max(1, viewportRect.width - padding * 2)
    const availableHeight = Math.max(1, viewportRect.height - padding * 2)
    const targetZoom = clampZoomValue(
      Math.min(availableWidth / boxWidth, availableHeight / boxHeight) / fitScale
    )
    const targetRenderScale = fitScale * targetZoom
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setZoom(targetZoom)
    setPan({
      x: viewportRect.width / 2 - centerX * targetRenderScale,
      y: viewportRect.height / 2 - centerY * targetRenderScale
    })
  }, [autoFocusKey, draftChartPoints, fitScale, naturalHeight, naturalWidth])

  useEffect(() => {
    if (!canDragPins || !onDraftChartPointMove) return

    const handlePointerMove = (event: PointerEvent) => {
      if (!pinDragRef.current.active) return
      const point = clientToChartPoint(event.clientX, event.clientY)
      if (!point) return
      onDraftChartPointMove(pinDragRef.current.index, point)
    }

    const handlePointerUp = () => {
      if (!pinDragRef.current.active) return
      pinDragRef.current.active = false
      pinDragRef.current.index = -1
      setDraggingPinIndex(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [
    canDragPins,
    naturalHeight,
    naturalWidth,
    onDraftChartPointMove,
    pan.x,
    pan.y,
    renderScale
  ])

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
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="chart-zoom-button"
          onClick={() => updateZoom(zoom - 0.1)}
        >
          -
        </Button>
        <span className="chart-zoom-label">{Math.round(zoom * 100)}%</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="chart-zoom-button"
          onClick={() => updateZoom(zoom + 0.1)}
        >
          +
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="chart-zoom-button"
          onClick={resetToFit}
        >
          {t('chartPreview.resetZoom')}
        </Button>
      </div>

      <div
        ref={viewportRef}
        className={`chart-preview-viewport ${onChartClick ? 'selectable' : ''} ${isDragging ? 'dragging' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={handleChartClick}
      >
        <div
          className="chart-surface chart-pan-stage"
          style={{
            width: naturalWidth,
            height: naturalHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${renderScale})`
          }}
          onDragStart={(event) => event.preventDefault()}
        >
          <img
            ref={imageRef}
            src={rasterUrl}
            alt={chartTitle}
            className="chart-image chart-image-zoomed"
            draggable={false}
          />
        </div>
        {projectedScreenPoint ? (
          <ChartAircraftArrow
            x={projectedScreenPoint.left}
            y={projectedScreenPoint.top}
            headingDeg={(aircraft?.headingDeg ?? 0) + chartRotationDeg}
          />
        ) : null}
        {chartPins.map((pin) => (
          <div
            key={pin.key}
            className={`chart-reference-pin ${canDragPins ? 'draggable' : ''} ${draggingPinIndex === pin.index ? 'dragging' : ''}`}
            style={{
              left: pin.left,
              top: pin.top
            }}
            onPointerDown={(event) => {
              if (!canDragPins) return
              event.preventDefault()
              event.stopPropagation()
              suppressClickRef.current = true
              pinDragRef.current = {
                active: true,
                index: pin.index
              }
              setDraggingPinIndex(pin.index)
            }}
          >
            <span>{pin.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
