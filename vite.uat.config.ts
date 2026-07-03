import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AppSettings } from './src/shared/types'
import type { ChartRecord } from './src/shared/chart-types'

const pixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

let settings: AppSettings = {
  language: 'zh-CN',
  followAircraft: false,
  refreshIntervalMs: 1000,
  providerMode: 'mock',
  mapTileProvider: 'esriWorldStreet',
  chartOpacity: 80,
  storage: { chartLibraryPath: null },
  navData: { sqlitePath: '/mock/little_navmap.sqlite', autoDetect: true },
  simbrief: { username: 'demo-pilot', userId: '' },
  lanAccess: {
    enabled: true,
    port: 4174,
    authEnabled: false,
    authToken: 'mock-token',
    allowWrite: true
  }
}

let charts: ChartRecord[] = [
  {
    id: 'mock-chart',
    title: 'ZBAA ILS 36L',
    airportCode: 'ZBAA',
    chartType: 'approach',
    titleMode: 'approach-procedure',
    boundRunwayNames: ['36L'],
    boundApproachProcedureIds: ['approach:1'],
    sourceFilePath: '/mock/ZBAA-ILS-36L.png',
    previewImagePath: '/mock/ZBAA-ILS-36L.png',
    fileFormat: 'png',
    width: 1,
    height: 1,
    isGeoreferenced: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [vue(), mockApiPlugin()],
  publicDir: resolve(__dirname, 'assets/branding'),
  resolve: {
    alias: {
      '@branding': resolve(__dirname, 'assets/branding'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true
  }
})

function mockApiPlugin(): Plugin {
  return {
    name: 'nextefb-uat-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1')
        if (url.pathname === '/assets/charts/mock-chart/preview') {
          response.setHeader('Content-Type', 'image/png')
          response.end(pixelPng)
          return
        }
        if (!url.pathname.startsWith('/api/')) {
          next()
          return
        }

        const body = await readBody(request)
        if (url.pathname === '/api/snapshot') {
          return json(response, {
            aircraft: {
              connected: true,
              source: 'mock',
              lat: 40.08,
              lon: 116.58,
              altitudeFt: 12000,
              headingDeg: 180,
              groundSpeedKts: 260,
              onGround: false,
              updatedAt: Date.now()
            },
            connection: {
              connected: true,
              source: 'mock',
              messageCode: 'MOCK_READY',
              updatedAt: Date.now()
            }
          })
        }
        if (url.pathname === '/api/settings') {
          if (request.method === 'PATCH') {
            settings = mergeSettings(settings, body as Partial<AppSettings>)
          }
          return json(response, settings)
        }
        if (url.pathname === '/api/nav/status') {
          return json(response, {
            defaultPath: '/mock/little_navmap.sqlite',
            configuredPath: settings.navData.sqlitePath,
            activePath: settings.navData.sqlitePath,
            exists: true,
            source: 'manual',
            message: 'ready'
          })
        }
        if (url.pathname === '/api/nav/airports') {
          const query = (url.searchParams.get('query') ?? '').toUpperCase()
          return json(
            response,
            [
              { ident: 'ZBAA', name: 'Beijing Capital', city: 'Beijing', country: 'CN', lat: 40.08, lon: 116.58 },
              { ident: 'ZSPD', name: 'Shanghai Pudong', city: 'Shanghai', country: 'CN', lat: 31.14, lon: 121.8 }
            ].filter((airport) => `${airport.ident}${airport.name}`.toUpperCase().includes(query))
          )
        }
        if (/^\/api\/nav\/airport\/[^/]+\/procedures$/.test(url.pathname)) {
          const ident = decodeURIComponent(url.pathname.split('/')[4]).toUpperCase()
          return json(response, mockProcedures(ident))
        }
        if (url.pathname === '/api/nav/plan') {
          return json(response, {
            points: [
              { ident: 'ZBAA', lat: 40.08, lon: 116.58, source: 'airport' },
              { ident: 'ZSPD', lat: 31.14, lon: 121.8, source: 'airport' }
            ],
            segments: [
              {
                points: [
                  { ident: 'ZBAA', lat: 40.08, lon: 116.58, source: 'airport' },
                  { ident: 'ZSPD', lat: 31.14, lon: 121.8, source: 'airport' }
                ],
                phase: 'enroute'
              }
            ],
            unresolvedTokens: [],
            summary: 'ZBAA-ZSPD'
          })
        }
        if (url.pathname === '/api/nav/map-features') {
          return json(response, {
            airports: [{ id: 1, ident: 'ZBAA', name: 'Beijing Capital', type: 1, lat: 40.08, lon: 116.58, longestRunwayLengthFt: 12467, numApproach: 4 }],
            waypoints: [],
            vors: [],
            ndbs: [],
            airways: [],
            overflow: { airports: false, waypoints: false, vors: false, ndbs: false, airways: false },
            fetchedAt: Date.now()
          })
        }
        if (url.pathname === '/api/nav/search-points') {
          return json(response, [
            { id: 'airport:1', type: 'airports', ident: 'ZBAA', name: 'Beijing Capital', lat: 40.08, lon: 116.58 }
          ])
        }
        if (url.pathname === '/api/simbrief/import') {
          return json(response, {
            departureAirport: 'ZBAA',
            destinationAirport: 'ZSPD',
            alternateAirport: null,
            routeText: 'DCT P117',
            departureRunway: '36L',
            arrivalRunway: '34L',
            departureProcedureName: 'RENOB-9D',
            arrivalProcedureName: 'SASAN-1A',
            approachProcedureName: 'ILS 34L',
            arrivalTransitionName: null,
            source: 'simbrief'
          })
        }
        if (url.pathname === '/api/storage-summary') {
          return json(response, {
            databasePath: '/mock/nextefb.sqlite',
            chartsRoot: '/mock/charts',
            defaultChartsRoot: '/mock/charts',
            legacyChartsRoot: '/mock/legacy'
          })
        }
        if (url.pathname === '/api/charts') {
          if (request.method === 'POST') {
            const input = body as {
              title?: string
              sourceFileName?: string
              sourceFileFormat?: ChartRecord['fileFormat']
            }
            const imported: ChartRecord = {
              id: `mock-import-${charts.length + 1}`,
              title: input.title || input.sourceFileName || 'Imported Chart',
              airportCode: null,
              chartType: 'general',
              titleMode: 'manual',
              boundRunwayNames: [],
              boundApproachProcedureIds: [],
              sourceFilePath: `/mock/${input.sourceFileName || 'imported.png'}`,
              previewImagePath: `/mock/${input.sourceFileName || 'imported.png'}`,
              fileFormat: input.sourceFileFormat || 'png',
              width: 1,
              height: 1,
              isGeoreferenced: false,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
            charts = [...charts, imported]
            return json(response, { chart: imported })
          }
          return json(response, charts)
        }
        if (url.pathname === '/api/charts/import-from-url') {
          return json(response, {
            sourcePath: null,
            fileName: 'downloaded.png',
            fileFormat: 'png',
            mimeType: 'image/png',
            base64: pixelPng.toString('base64')
          })
        }
        if (url.pathname === '/api/charts/mock-chart/reference-points') {
          return json(response, [
            { id: 'one', chartId: 'mock-chart', index: 1, mapLat: 40.08, mapLon: 116.58, chartX: 0, chartY: 0 },
            { id: 'two', chartId: 'mock-chart', index: 2, mapLat: 40.09, mapLon: 116.59, chartX: 1, chartY: 1 }
          ])
        }
        if (url.pathname === '/api/charts/mock-chart') {
          if (request.method === 'DELETE') {
            charts = []
            return json(response, { success: true })
          }
          if (request.method === 'PATCH') {
            charts = charts.map((chart) =>
              chart.id === 'mock-chart'
                ? { ...chart, ...(body as Partial<ChartRecord>), updatedAt: Date.now() }
                : chart
            )
          }
          return json(response, charts.find((chart) => chart.id === 'mock-chart') ?? null)
        }

        response.statusCode = 404
        json(response, { error: 'Not found' })
      })
    }
  }
}

function mergeSettings(current: AppSettings, partial: Partial<AppSettings>): AppSettings {
  return {
    ...current,
    ...partial,
    storage: { ...current.storage, ...partial.storage },
    navData: { ...current.navData, ...partial.navData },
    simbrief: { ...current.simbrief, ...partial.simbrief },
    lanAccess: { ...current.lanAccess, ...partial.lanAccess }
  }
}

function mockProcedures(ident: string) {
  return {
    airport: { ident, name: ident, city: null, country: 'CN', lat: 0, lon: 0 },
    runways: [
      { name: '36L', displayName: '36L', lengthM: 3800, widthM: 60, surface: 'ASPHALT', headingDeg: 360 },
      { name: '34L', displayName: '34L', lengthM: 3800, widthM: 60, surface: 'ASPHALT', headingDeg: 340 }
    ],
    departures: [{ id: 'departure:1', name: 'RENOB-9D', procedureType: 'departure', runwayName: '36L' }],
    arrivals: [{ id: 'arrival:1', name: 'SASAN-1A', procedureType: 'arrival', runwayName: '34L' }],
    approaches: [{ id: 'approach:1', name: 'ILS 34L', procedureType: 'approach', runwayName: '34L' }],
    transitions: []
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method ?? '')) return {}
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

function json(response: ServerResponse, value: unknown): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(value))
}
