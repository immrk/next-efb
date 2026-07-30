import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  calculatePinchZoom,
  getPinchCenter,
  getPinchDistance,
  type PinchCenter
} from '../utils/pinchZoom'

interface UseTouchPinchZoomOptions {
  enabled: boolean
  zoom: number
  minimum: number
  maximum: number
  onZoomChange: (zoom: number) => void
}

interface UseTouchPinchZoomResult<
  TSurface extends HTMLElement,
  TContent extends HTMLElement
> {
  surfaceRef: RefObject<TSurface | null>
  contentRef: RefObject<TContent | null>
  isPinching: boolean
}

interface PinchState {
  active: boolean
  startDistance: number
  startZoom: number
  worldX: number
  worldY: number
  center: PinchCenter
  nextZoom: number
}

export function useTouchPinchZoom<
  TSurface extends HTMLElement,
  TContent extends HTMLElement
>({
  enabled,
  zoom,
  minimum,
  maximum,
  onZoomChange
}: UseTouchPinchZoomOptions): UseTouchPinchZoomResult<TSurface, TContent> {
  const surfaceRef = useRef<TSurface | null>(null)
  const contentRef = useRef<TContent | null>(null)
  const zoomRef = useRef(zoom)
  const onZoomChangeRef = useRef(onZoomChange)
  const frameRef = useRef<number | null>(null)
  const pinchRef = useRef<PinchState>({
    active: false,
    startDistance: 0,
    startZoom: zoom,
    worldX: 0,
    worldY: 0,
    center: { clientX: 0, clientY: 0 },
    nextZoom: zoom
  })
  const [isPinching, setIsPinching] = useState(false)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!enabled || !surface) return

    const cancelPendingCompensation = () => {
      if (frameRef.current === null) return
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    const compensateScroll = () => {
      frameRef.current = null

      const content = contentRef.current
      if (!content || !pinchRef.current.active) return

      const contentRect = content.getBoundingClientRect()
      const { center, nextZoom, worldX, worldY } = pinchRef.current
      surface.scrollLeft +=
        contentRect.left + worldX * nextZoom - center.clientX
      surface.scrollTop +=
        contentRect.top + worldY * nextZoom - center.clientY
    }

    const scheduleScrollCompensation = () => {
      cancelPendingCompensation()
      frameRef.current = requestAnimationFrame(compensateScroll)
    }

    const beginPinch = (event: TouchEvent) => {
      if (event.touches.length !== 2) return
      const first = event.touches.item(0)
      const second = event.touches.item(1)
      const content = contentRef.current
      if (!first || !second || !content) return

      const distance = getPinchDistance(first, second)
      if (distance <= 0) return

      event.preventDefault()
      const center = getPinchCenter(first, second)
      const contentRect = content.getBoundingClientRect()
      const currentZoom = zoomRef.current
      pinchRef.current = {
        active: true,
        startDistance: distance,
        startZoom: currentZoom,
        worldX: (center.clientX - contentRect.left) / currentZoom,
        worldY: (center.clientY - contentRect.top) / currentZoom,
        center,
        nextZoom: currentZoom
      }
      setIsPinching(true)
    }

    const updatePinch = (event: TouchEvent) => {
      if (!pinchRef.current.active || event.touches.length !== 2) return
      const first = event.touches.item(0)
      const second = event.touches.item(1)
      if (!first || !second) return

      event.preventDefault()
      const nextZoom = calculatePinchZoom({
        startZoom: pinchRef.current.startZoom,
        startDistance: pinchRef.current.startDistance,
        currentDistance: getPinchDistance(first, second),
        minimum,
        maximum
      })
      pinchRef.current.center = getPinchCenter(first, second)
      pinchRef.current.nextZoom = nextZoom
      onZoomChangeRef.current(nextZoom)
      scheduleScrollCompensation()
    }

    const finishPinch = (event: TouchEvent) => {
      if (!pinchRef.current.active || event.touches.length >= 2) return
      event.preventDefault()
      pinchRef.current.active = false
      cancelPendingCompensation()
      setIsPinching(false)
    }

    const cancelPinch = () => {
      pinchRef.current.active = false
      cancelPendingCompensation()
      setIsPinching(false)
    }

    surface.addEventListener('touchstart', beginPinch, { passive: false })
    surface.addEventListener('touchmove', updatePinch, { passive: false })
    surface.addEventListener('touchend', finishPinch, { passive: false })
    surface.addEventListener('touchcancel', cancelPinch, { passive: false })

    return () => {
      surface.removeEventListener('touchstart', beginPinch)
      surface.removeEventListener('touchmove', updatePinch)
      surface.removeEventListener('touchend', finishPinch)
      surface.removeEventListener('touchcancel', cancelPinch)
      cancelPendingCompensation()
    }
  }, [enabled, maximum, minimum])

  return {
    surfaceRef,
    contentRef,
    isPinching
  }
}
