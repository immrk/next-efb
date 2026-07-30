import { useEffect, useState } from 'react'
import type { ChartAssetPayload, ChartRecord, GeoReferencePoint } from '@shared/chart-types'
import { getAppClient } from '../client'
import { subscribeChartChanged } from '../utils/chartSync'
import { useChartRasterAsset } from './useChartRasterAsset'

export function useMapOverlayChart(chartId: string | null) {
  const appClient = getAppClient()
  const [chart, setChart] = useState<ChartRecord | null>(null)
  const [asset, setAsset] = useState<ChartAssetPayload | null>(null)
  const [points, setPoints] = useState<GeoReferencePoint[]>([])

  useEffect(() => {
    const refresh = () => {
      if (!chartId) {
        setChart(null)
        setAsset(null)
        setPoints([])
        return
      }

      void appClient.getChart(chartId).then(setChart)
      void appClient.getChartAsset(chartId).then(setAsset)
      void appClient.getChartReferencePoints(chartId).then(setPoints)
    }

    refresh()
    const unsubscribe = subscribeChartChanged(refresh)
    return () => {
      unsubscribe()
    }
  }, [appClient, chartId])

  const raster = useChartRasterAsset(asset)

  return {
    chart,
    points,
    ...raster
  }
}
