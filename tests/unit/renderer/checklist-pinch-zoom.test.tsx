import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTouchPinchZoom } from '../../../src/renderer/hooks/useTouchPinchZoom'
import {
  calculatePinchZoom,
  clampZoom,
  getPinchCenter,
  getPinchDistance
} from '../../../src/renderer/utils/pinchZoom'

describe('checklist pinch zoom math', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('measures two-finger distance', () => {
    expect(
      getPinchDistance(
        { clientX: 10, clientY: 20 },
        { clientX: 40, clientY: 60 }
      )
    ).toBe(50)
  })

  it('measures the center between two fingers', () => {
    expect(
      getPinchCenter(
        { clientX: 40, clientY: 20 },
        { clientX: 160, clientY: 100 }
      )
    ).toEqual({ clientX: 100, clientY: 60 })
  })

  it('scales from the gesture start and clamps to viewer limits', () => {
    expect(
      calculatePinchZoom({
        startZoom: 1,
        startDistance: 100,
        currentDistance: 150,
        minimum: 0.65,
        maximum: 2.25
      })
    ).toBe(1.5)

    expect(
      calculatePinchZoom({
        startZoom: 2,
        startDistance: 100,
        currentDistance: 300,
        minimum: 0.65,
        maximum: 2.25
      })
    ).toBe(2.25)

    expect(clampZoom(0.2, 0.65, 2.25)).toBe(0.65)
  })

  it('keeps one-finger scrolling native and handles two-finger pinch events', () => {
    function PinchHarness() {
      const [zoom, setZoom] = useState(1)
      const { surfaceRef, contentRef } = useTouchPinchZoom<
        HTMLDivElement,
        HTMLDivElement
      >({
        enabled: true,
        zoom,
        minimum: 0.65,
        maximum: 2.25,
        onZoomChange: setZoom
      })

      return (
        <div ref={surfaceRef} data-testid="surface">
          <div ref={contentRef} data-testid="content">
            {zoom.toFixed(2)}
          </div>
        </div>
      )
    }

    render(<PinchHarness />)
    const surface = screen.getByTestId('surface')
    const content = screen.getByTestId('content')
    let flushAnimationFrame = () => {}
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      flushAnimationFrame = () => callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(content, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 20 - surface.scrollLeft,
          top: 30 - surface.scrollTop,
          right: 220 - surface.scrollLeft,
          bottom: 230 - surface.scrollTop,
          width: 200,
          height: 200,
          x: 20 - surface.scrollLeft,
          y: 30 - surface.scrollTop,
          toJSON: () => ({})
        }) as DOMRect
    )

    const singleTouch = createTouchEvent('touchstart', [
      { clientX: 0, clientY: 0 }
    ])
    surface.dispatchEvent(singleTouch)
    expect(singleTouch.defaultPrevented).toBe(false)

    const pinchStart = createTouchEvent('touchstart', [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 }
    ])
    surface.dispatchEvent(pinchStart)
    expect(pinchStart.defaultPrevented).toBe(true)

    const pinchMove = createTouchEvent('touchmove', [
      { clientX: 100, clientY: 100 },
      { clientX: 300, clientY: 100 }
    ])
    act(() => {
      surface.dispatchEvent(pinchMove)
    })
    expect(pinchMove.defaultPrevented).toBe(true)
    expect(surface).toHaveTextContent('2.00')

    act(() => {
      flushAnimationFrame()
    })
    expect(surface.scrollLeft).toBe(80)
    expect(surface.scrollTop).toBe(70)

    const pinchEnd = createTouchEvent('touchend', [
      { clientX: 0, clientY: 0 }
    ])
    surface.dispatchEvent(pinchEnd)
    expect(pinchEnd.defaultPrevented).toBe(true)
  })
})

function createTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Array<{ clientX: number; clientY: number }>
): TouchEvent {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true
  }) as TouchEvent
  const touches = {
    length: points.length,
    item: (index: number) => points[index] ?? null,
    ...points
  }
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: touches
  })
  return event
}
