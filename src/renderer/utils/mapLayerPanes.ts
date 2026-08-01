import type { Map as LeafletMap } from 'leaflet'

export const CHART_OVERLAY_PANE_NAME = 'chartOverlayPane'
export const CHART_OVERLAY_PANE_Z_INDEX = 350
export const LEAFLET_VECTOR_OVERLAY_PANE_Z_INDEX = 400

type LeafletPaneMap = Pick<LeafletMap, 'createPane' | 'getPane'>

/**
 * Keeps georeferenced chart rasters above map tiles but below Leaflet's vector
 * overlay pane, where flight-plan routes and their interaction layers render.
 */
export function ensureChartOverlayPane(map: LeafletPaneMap): HTMLElement {
  const pane = map.getPane(CHART_OVERLAY_PANE_NAME) ?? map.createPane(CHART_OVERLAY_PANE_NAME)
  pane.style.zIndex = String(CHART_OVERLAY_PANE_Z_INDEX)
  pane.style.pointerEvents = 'none'
  return pane
}
