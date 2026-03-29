import { useEffect, useState } from 'react'
import type { ChartAssetPayload, ChartRecord, GeoReferencePoint } from '@shared/chart-types'
import { useChartRasterAsset } from './useChartRasterAsset'

export function useMapOverlayChart(chartId: string | null) {
  const [chart, setChart] = useState<ChartRecord | null>(null)
  const [asset, setAsset] = useState<ChartAssetPayload | null>(null)
  const [points, setPoints] = useState<GeoReferencePoint[]>([])

  useEffect(() => {
    if (!chartId) {
      setChart(null)
      setAsset(null)
      setPoints([])
      return
    }

    void window.msfsApi.getChart(chartId).then(setChart)
    void window.msfsApi.getChartAsset(chartId).then(setAsset)
    void window.msfsApi.getChartReferencePoints(chartId).then(setPoints)
  }, [chartId])

  const raster = useChartRasterAsset(asset)

  return {
    chart,
    points,
    ...raster
  }
}
