import { useEffect, useState } from 'react'
import type { ChartAssetPayload, ChartRecord, GeoReferencePoint } from '@shared/chart-types'
import { getAppClient } from '../client'
import { subscribeChartChanged } from '../utils/chartSync'

export function useChartDetailData(chartId: string | null) {
  const appClient = getAppClient()
  const [chart, setChart] = useState<ChartRecord | null>(null)
  const [asset, setAsset] = useState<ChartAssetPayload | null>(null)
  const [points, setPoints] = useState<GeoReferencePoint[]>([])
  const [resolvedChartId, setResolvedChartId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (!chartId) {
        setChart(null)
        setAsset(null)
        setPoints([])
        setResolvedChartId(null)
        return
      }

      setResolvedChartId(null)
      void Promise.all([
        appClient.getChart(chartId),
        appClient.getChartAsset(chartId),
        appClient.getChartReferencePoints(chartId)
      ]).then(([nextChart, nextAsset, nextPoints]) => {
        if (!active) return
        setChart(nextChart)
        setAsset(nextAsset)
        setPoints(nextPoints)
        setResolvedChartId(chartId)
      }).catch(() => {
        if (!active) return
        setChart(null)
        setAsset(null)
        setPoints([])
        setResolvedChartId(chartId)
      })
    }

    refresh()
    const unsubscribe = subscribeChartChanged(refresh)
    return () => {
      active = false
      unsubscribe()
    }
  }, [appClient, chartId])

  return {
    chart,
    asset,
    points,
    isLoading: Boolean(chartId) && chart?.id !== chartId && resolvedChartId !== chartId,
    setChart,
    setPoints
  }
}
