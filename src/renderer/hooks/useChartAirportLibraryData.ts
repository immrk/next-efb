import { useEffect, useState } from 'react'
import type {
  ChartAirportSummary,
  ChartImportResult,
  ChartRecord,
  PickedChartFile
} from '@shared/chart-types'
import { getAppClient } from '../client'
import { finalizePickedChart } from '../utils/chartImport'
import { notifyChartChanged, subscribeChartChanged } from '../utils/chartSync'

const SEARCH_DEBOUNCE_MS = 200

export function useChartAirportLibraryData() {
  const appClient = getAppClient()
  const [airports, setAirports] = useState<ChartAirportSummary[]>([])
  const [charts, setCharts] = useState<ChartRecord[]>([])
  const [expandedAirportCode, setExpandedAirportCode] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isLoadingAirports, setIsLoadingAirports] = useState(true)
  const [isLoadingCharts, setIsLoadingCharts] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => subscribeChartChanged(() => setRevision((current) => current + 1)), [])

  useEffect(() => {
    let active = true
    setIsLoadingAirports(true)
    const timer = window.setTimeout(() => {
      void appClient.listChartAirports(search).then(
        (nextAirports) => {
          if (!active) return
          setAirports(nextAirports)
          setExpandedAirportCode((current) =>
            current && nextAirports.some((airport) => airport.airportCode === current)
              ? current
              : null
          )
          setIsLoadingAirports(false)
        },
        () => {
          if (!active) return
          setAirports([])
          setIsLoadingAirports(false)
        }
      )
    }, search.trim() ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [appClient, revision, search])

  useEffect(() => {
    let active = true
    if (!expandedAirportCode) {
      setCharts([])
      setIsLoadingCharts(false)
      return () => {
        active = false
      }
    }

    setCharts([])
    setIsLoadingCharts(true)
    const timer = window.setTimeout(() => {
      void appClient.listChartsByAirport(expandedAirportCode, search).then(
        (nextCharts) => {
          if (!active) return
          setCharts(nextCharts)
          setIsLoadingCharts(false)
        },
        () => {
          if (!active) return
          setCharts([])
          setIsLoadingCharts(false)
        }
      )
    }, search.trim() ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [appClient, expandedAirportCode, revision, search])

  const importPickedChart = async (
    picked: PickedChartFile | null
  ): Promise<ChartImportResult | null> => {
    const result = await finalizePickedChart(appClient, picked)
    if (result) {
      notifyChartChanged()
    }
    return result
  }

  const importChart = async (): Promise<ChartImportResult | null> =>
    importPickedChart(await appClient.pickChartFile())

  const importChartFromUrl = async (url: string): Promise<ChartImportResult | null> =>
    importPickedChart(await appClient.importChartFromUrl({ url }))

  return {
    airports,
    charts,
    expandedAirportCode,
    search,
    isLoadingAirports,
    isLoadingCharts,
    revision,
    setExpandedAirportCode,
    setSearch,
    importChart,
    importChartFromUrl
  }
}
