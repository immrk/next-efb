import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChart, createSettings } from '../../helpers/factories'
import { ElectronAppClient } from '../../../src/renderer/client/ElectronAppClient'
import { WebLanAppClient } from '../../../src/renderer/client/WebLanAppClient'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  readonly url: string
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn(() => this.onclose?.())

  constructor(url: string | URL) {
    this.url = String(url)
    FakeWebSocket.instances.push(this)
  }

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent<string>)
  }
}

describe('application clients', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    window.history.replaceState({}, '', '/')
    window.localStorage.clear()
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as Partial<Window>).msfsApi
  })

  it('forwards Electron calls and subscriptions to the preload API', async () => {
    const off = vi.fn()
    const updateState = {
      supported: true,
      phase: 'available' as const,
      currentVersion: '0.1.0',
      availableVersion: '0.2.0',
      releaseName: 'NextEFB v0.2.0',
      releaseNotes: 'New release',
      releaseDate: '2026-07-30T00:00:00.000Z',
      progressPercent: null,
      transferredBytes: null,
      totalBytes: null,
      bytesPerSecond: null,
      errorMessage: null
    }
    const vatsimStatus = {
      phase: 'ready' as const,
      revision: 1,
      fetchedAt: 1,
      feedUpdatedAt: 1,
      nextRefreshAt: 2,
      lastError: null,
      counts: { pilots: 10, controllers: 2, atis: 1, connectedClients: 13 }
    }
    const preload = {
      getSnapshot: vi.fn().mockResolvedValue({ aircraft: null, connection: null }),
      getSettings: vi.fn().mockResolvedValue(createSettings()),
      getChart: vi.fn().mockResolvedValue(createChart()),
      listCharts: vi.fn().mockResolvedValue([createChart()]),
      updateSettings: vi.fn().mockResolvedValue(createSettings({ language: 'zh-CN' })),
      getAppUpdateState: vi.fn().mockResolvedValue(updateState),
      checkForAppUpdate: vi.fn().mockResolvedValue(updateState),
      downloadAndInstallAppUpdate: vi.fn().mockResolvedValue(updateState),
      onAppUpdateStateChange: vi.fn(() => off),
      getVatsimStatus: vi.fn().mockResolvedValue(vatsimStatus),
      getVatsimMapFeatures: vi.fn().mockResolvedValue({ pilots: [] }),
      searchVatsimPilots: vi.fn().mockResolvedValue([]),
      refreshVatsim: vi.fn().mockResolvedValue(vatsimStatus),
      onVatsimChanged: vi.fn(() => off),
      performWindowAction: vi.fn().mockResolvedValue({ isMaximized: true }),
      onAircraftUpdate: vi.fn(() => off)
    }
    Object.defineProperty(window, 'msfsApi', {
      configurable: true,
      value: preload
    })
    const client = new ElectronAppClient()

    expect(client.getRuntime()).toMatchObject({
      host: 'electron',
      canWrite: true,
      canManageLocalFiles: true
    })
    await expect(client.getSettings()).resolves.toMatchObject({ language: 'en-US' })
    await expect(client.getChart('chart-1')).resolves.toMatchObject({ id: 'chart-1' })
    await expect(client.listCharts()).resolves.toHaveLength(1)
    await client.updateSettings({ language: 'zh-CN' })
    await expect(client.getAppUpdateState()).resolves.toMatchObject({
      availableVersion: '0.2.0'
    })
    await client.checkForAppUpdate()
    await client.downloadAndInstallAppUpdate()
    await expect(client.getVatsimStatus()).resolves.toMatchObject({ revision: 1 })
    await client.getVatsimMapFeatures({} as never)
    await client.searchVatsimPilots({ query: 'DAL1' })
    await client.refreshVatsim()
    await client.performWindowAction('toggle-maximize')
    const listener = vi.fn()
    expect(client.onAircraftUpdate(listener)).toBe(off)
    expect(client.onAppUpdateStateChange(listener)).toBe(off)
    expect(client.onVatsimChanged(listener)).toBe(off)

    expect(preload.getChart).toHaveBeenCalledWith('chart-1')
    expect(preload.updateSettings).toHaveBeenCalledWith({ language: 'zh-CN' })
    expect(preload.performWindowAction).toHaveBeenCalledWith('toggle-maximize')
    expect(preload.checkForAppUpdate).toHaveBeenCalledOnce()
    expect(preload.downloadAndInstallAppUpdate).toHaveBeenCalledOnce()
    expect(preload.onAppUpdateStateChange).toHaveBeenCalledWith(listener)
    expect(preload.onVatsimChanged).toHaveBeenCalledWith(listener)
    expect(preload.searchVatsimPilots).toHaveBeenCalledWith({ query: 'DAL1' })
    expect(preload.onAircraftUpdate).toHaveBeenCalledWith(listener)
    expect(client.onChartsChanged(vi.fn())).toEqual(expect.any(Function))
    expect(client.onSettingsChanged(vi.fn())).toEqual(expect.any(Function))
  })

  it('authenticates LAN requests, strips URL tokens and builds asset URLs', async () => {
    window.history.replaceState({}, '', '/?token=secret')
    const chart = createChart()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const payload = url === '/api/charts/chart-1' ? chart : createSettings()
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new WebLanAppClient()
    expect(client.getRuntime()).toMatchObject({ host: 'web', canWrite: true })
    expect(window.location.search).toBe('')
    expect(
      window.localStorage.getItem(`msfs-lan-token:${window.location.origin}`)
    ).toBe('secret')
    expect(FakeWebSocket.instances[0].url).toContain('/ws?token=secret')

    await client.getSettings()
    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(firstHeaders.get('Authorization')).toBe('Bearer secret')

    await client.updateSettings({ language: 'zh-CN' })
    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === '/api/settings' && init?.method === 'PATCH'
    )
    expect(updateCall?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ language: 'zh-CN' })
    })
    expect((updateCall?.[1]?.headers as Headers).get('Content-Type')).toBe(
      'application/json; charset=utf-8'
    )

    await expect(client.getChartAsset('chart-1')).resolves.toMatchObject({
      chartId: 'chart-1',
      fileFormat: 'png',
      mimeType: 'image/png',
      url: expect.stringContaining('/assets/charts/chart-1/preview?token=secret')
    })
  })

  it('maps LAN endpoints, window fallbacks and request failures', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }))
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = new WebLanAppClient()

    await client.searchNavAirports('Z BA')
    await client.getNavAirportProcedures('Z/BAA')
    await client.buildFlightPlan({} as never)
    await client.searchNavMapPoints({ query: 'PEK', types: ['vors'] })
    await client.getVatsimStatus()
    await client.getVatsimMapFeatures({} as never)
    await client.searchVatsimPilots({ query: 'DAL1' })
    await client.refreshVatsim()
    await client.importChartFromUrl({ url: 'https://example.com/chart.pdf' })
    await client.deleteChart('chart id')
    await client.importChecklistFromUrl({ url: 'https://example.com/checklist.pdf' })
    await client.updateChecklist({
      id: 'checklist id',
      title: 'Normal Procedures',
      aircraftModel: 'A320'
    })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/nav/airports?query=Z%20BA',
      '/api/nav/airport/Z%2FBAA/procedures',
      '/api/nav/plan',
      '/api/nav/search-points',
      '/api/vatsim/status',
      '/api/vatsim/map-features',
      '/api/vatsim/search-pilots',
      '/api/vatsim/refresh',
      '/api/charts/import-from-url',
      '/api/charts/chart id',
      '/api/checklists/import-from-url',
      '/api/checklists/checklist%20id'
    ])
    expect(await client.getWindowState()).toEqual({ isMaximized: false })
    expect(await client.performWindowAction()).toEqual({ isMaximized: false })
    expect(await client.performDevAction()).toBe(false)
    expect(await client.pickNavSqliteFile()).toBeNull()
    expect(await client.pickChartsDirectory()).toBeNull()
    await expect(client.getAppUpdateState()).resolves.toMatchObject({
      supported: false,
      phase: 'unsupported'
    })
    await expect(client.checkForAppUpdate()).resolves.toMatchObject({
      supported: false
    })
    await expect(client.downloadAndInstallAppUpdate()).resolves.toMatchObject({
      supported: false
    })
    expect(client.onAppUpdateStateChange(vi.fn())).toEqual(expect.any(Function))

    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(client.getSettings()).rejects.toThrow('LAN request failed: 503')
  })

  it('dispatches socket events and removes listeners', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    )
    const client = new WebLanAppClient()
    const socket = FakeWebSocket.instances[0]
    const aircraft = vi.fn()
    const connection = vi.fn()
    const charts = vi.fn()
    const checklists = vi.fn()
    const settings = vi.fn()
    const vatsim = vi.fn()
    const offAircraft = client.onAircraftUpdate(aircraft)
    client.onConnectionUpdate(connection)
    client.onChartsChanged(charts)
    client.onChecklistsChanged(checklists)
    client.onSettingsChanged(settings)
    client.onVatsimChanged(vatsim)

    socket.emit({ type: 'aircraft:update', payload: { connected: true } })
    socket.emit({ type: 'connection:update', payload: { connected: false } })
    socket.emit({ type: 'chart:changed' })
    socket.emit({ type: 'checklist:changed' })
    socket.emit({ type: 'settings:changed' })
    socket.emit({ type: 'vatsim:changed', payload: { phase: 'ready', revision: 2 } })
    expect(aircraft).toHaveBeenCalledWith({ connected: true })
    expect(connection).toHaveBeenCalledWith({ connected: false })
    expect(charts).toHaveBeenCalledOnce()
    expect(checklists).toHaveBeenCalledOnce()
    expect(settings).toHaveBeenCalledOnce()
    expect(vatsim).toHaveBeenCalledWith({ phase: 'ready', revision: 2 })

    offAircraft()
    socket.emit({ type: 'aircraft:update', payload: { connected: false } })
    expect(aircraft).toHaveBeenCalledOnce()
  })

  it('opens external URLs and reports the current LAN status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    )
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const client = new WebLanAppClient()

    await expect(client.openExternal('https://example.com')).resolves.toBe(true)
    expect(open).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer'
    )
    await expect(client.getRemoteAccessStatus()).resolves.toMatchObject({
      enabled: true,
      running: true,
      primaryAccessUrl: window.location.origin,
      accessUrls: [window.location.origin]
    })
  })
})
