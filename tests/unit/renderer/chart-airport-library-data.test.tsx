import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChart } from '../../helpers/factories'

const libraryMocks = vi.hoisted(() => ({
  remoteChanged: null as (() => void) | null,
  listChartAirports: vi.fn(),
  listChartsByAirport: vi.fn(),
  onChartsChanged: vi.fn((listener: () => void) => {
    libraryMocks.remoteChanged = listener
    return vi.fn()
  })
}))

vi.mock('../../../src/renderer/client', () => {
  const appClient = {
    listChartAirports: libraryMocks.listChartAirports,
    listChartsByAirport: libraryMocks.listChartsByAirport,
    onChartsChanged: libraryMocks.onChartsChanged
  }
  return { getAppClient: () => appClient }
})

import { useChartAirportLibraryData } from '../../../src/renderer/hooks/useChartAirportLibraryData'

describe('useChartAirportLibraryData', () => {
  beforeEach(() => {
    libraryMocks.remoteChanged = null
    libraryMocks.listChartAirports.mockReset().mockResolvedValue([
      { airportCode: 'ZBAA', chartCount: 1 }
    ])
    libraryMocks.listChartsByAirport.mockReset().mockResolvedValue([
      createChart({ airportCode: 'ZBAA' })
    ])
    libraryMocks.onChartsChanged.mockClear()
  })

  it('keeps an expanded airport visible during a same-query background refresh', async () => {
    const { result } = renderHook(() => useChartAirportLibraryData())

    await waitFor(() => expect(result.current.airports).toHaveLength(1))
    act(() => result.current.setExpandedAirportCode('ZBAA'))
    await waitFor(() => expect(result.current.charts).toHaveLength(1))
    expect(result.current.isLoadingCharts).toBe(false)

    act(() => libraryMocks.remoteChanged?.())

    expect(result.current.charts).toHaveLength(1)
    expect(result.current.isLoadingCharts).toBe(false)
    await waitFor(() => expect(libraryMocks.listChartsByAirport).toHaveBeenCalledTimes(2))
    expect(result.current.charts).toHaveLength(1)
    expect(result.current.isLoadingCharts).toBe(false)
  })
})
