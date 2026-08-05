import { describe, expect, it, vi } from 'vitest'
import {
  CHART_OVERLAY_PANE_NAME,
  CHART_OVERLAY_PANE_Z_INDEX,
  LEAFLET_VECTOR_OVERLAY_PANE_Z_INDEX,
  ensureChartOverlayPane
} from '../../../src/renderer/utils/mapLayerPanes'

describe('map layer panes', () => {
  it('creates a non-interactive chart pane below flight-plan vectors', () => {
    const pane = document.createElement('div')
    const map = {
      getPane: vi.fn(() => undefined),
      createPane: vi.fn(() => pane)
    }

    expect(ensureChartOverlayPane(map)).toBe(pane)
    expect(map.getPane).toHaveBeenCalledWith(CHART_OVERLAY_PANE_NAME)
    expect(map.createPane).toHaveBeenCalledWith(CHART_OVERLAY_PANE_NAME)
    expect(pane.style.zIndex).toBe(String(CHART_OVERLAY_PANE_Z_INDEX))
    expect(pane.style.pointerEvents).toBe('none')
    expect(CHART_OVERLAY_PANE_Z_INDEX).toBeLessThan(LEAFLET_VECTOR_OVERLAY_PANE_Z_INDEX)
  })

  it('reuses the chart pane when it already exists', () => {
    const pane = document.createElement('div')
    const map = {
      getPane: vi.fn(() => pane),
      createPane: vi.fn()
    }

    expect(ensureChartOverlayPane(map)).toBe(pane)
    expect(map.createPane).not.toHaveBeenCalled()
  })
})
