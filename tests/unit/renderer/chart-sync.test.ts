import { beforeEach, describe, expect, it, vi } from 'vitest'

const syncMocks = vi.hoisted(() => ({
  remoteChanged: null as (() => void) | null,
  offRemote: vi.fn(),
  onChartsChanged: vi.fn((listener: () => void) => {
    syncMocks.remoteChanged = listener
    return syncMocks.offRemote
  })
}))

vi.mock('../../../src/renderer/client', () => ({
  getAppClient: () => ({
    onChartsChanged: syncMocks.onChartsChanged
  })
}))

import {
  notifyChartChanged,
  subscribeChartChanged
} from '../../../src/renderer/utils/chartSync'

describe('chart change synchronization', () => {
  beforeEach(() => {
    syncMocks.remoteChanged = null
    syncMocks.offRemote.mockClear()
    syncMocks.onChartsChanged.mockClear()
  })

  it('combines local browser events and remote client events', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeChartChanged(listener)

    notifyChartChanged()
    syncMocks.remoteChanged?.()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    expect(syncMocks.offRemote).toHaveBeenCalledOnce()
    notifyChartChanged()
    syncMocks.remoteChanged?.()
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
