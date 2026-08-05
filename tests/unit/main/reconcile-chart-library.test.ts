import { describe, expect, it, vi } from 'vitest'
import { reconcileChartLibrary } from '../../../src/main/services/storage/reconcileChartLibrary'

describe('reconcileChartLibrary', () => {
  it('does not publish a library change for a filesystem event with no missing charts', () => {
    const deleteChartFiles = vi.fn()
    const onChanged = vi.fn()

    const removed = reconcileChartLibrary(
      { reconcileMissingCharts: vi.fn(() => []) },
      { deleteChartFiles },
      onChanged
    )

    expect(removed).toEqual([])
    expect(deleteChartFiles).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('publishes once after removing missing chart records and files', () => {
    const deleteChartFiles = vi.fn()
    const onChanged = vi.fn()

    const removed = reconcileChartLibrary(
      { reconcileMissingCharts: vi.fn(() => ['chart-1', 'chart-2']) },
      { deleteChartFiles },
      onChanged
    )

    expect(removed).toEqual(['chart-1', 'chart-2'])
    expect(deleteChartFiles).toHaveBeenNthCalledWith(1, 'chart-1')
    expect(deleteChartFiles).toHaveBeenNthCalledWith(2, 'chart-2')
    expect(onChanged).toHaveBeenCalledOnce()
  })
})
