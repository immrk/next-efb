import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { NavAirportProcedures } from '@shared/flight-plan-types'
import type { StorageSummary } from '@shared/chart-types'
import { createChart, createReferencePoints, createSettings } from '../../helpers/factories'
import { ChartBundleService } from '../../../src/main/services/storage/ChartBundleService'
import { ChartRepository } from '../../../src/main/services/storage/ChartRepository'
import {
  createZipArchive,
  readZipArchive
} from '../../../src/main/services/storage/ZipArchive'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('ChartBundleService', () => {
  it('previews an update and rematches portable bindings to local navigation ids', () => {
    const source = createEnvironment()
    const target = createEnvironment()
    const chartId = 'shared-chart'
    const sourcePath = writePng(source.storage.chartsRoot, chartId, 'source.png', 'source-data')
    const chart = createChart({
      id: chartId,
      title: 'ILS Z 09L',
      sourceFilePath: sourcePath,
      previewImagePath: sourcePath,
      titleMode: 'approach-procedure',
      boundRunwayNames: ['09L'],
      boundApproachProcedureIds: ['approach:101'],
      updatedAt: 2_000
    })
    source.repository.createChart(chart)
    source.repository.saveReferencePoints(chartId, createReferencePoints(chartId))

    const bundlePath = join(source.root, 'community.zip')
    source.service(sourceNav()).exportBundle(
      bundlePath,
      [chartId],
      createSettings(),
      '0.2.0'
    )

    const oldTargetPath = writePng(
      target.storage.chartsRoot,
      chartId,
      'source.png',
      'old-data'
    )
    target.repository.createChart(
      createChart({
        id: chartId,
        title: 'Local older content',
        sourceFilePath: oldTargetPath,
        previewImagePath: oldTargetPath,
        updatedAt: Date.now() + 100_000
      })
    )
    const targetService = target.service(targetNav())
    const preview = targetService.previewImport(bundlePath, createSettings())

    expect(preview.charts).toHaveLength(1)
    expect(preview.charts[0]).toMatchObject({
      id: chartId,
      action: 'update',
      isOlderThanLocal: true
    })

    const result = targetService.importBundle(
      {
        sessionId: preview.sessionId,
        chartIds: [chartId]
      },
      createSettings()
    )
    expect(result).toMatchObject({ createdCount: 0, updatedCount: 1 })
    expect(target.repository.getChart(chartId)).toMatchObject({
      title: 'ILS Z 09L',
      titleMode: 'approach-procedure',
      boundRunwayNames: ['9L'],
      boundApproachProcedureIds: ['approach:999'],
      isGeoreferenced: true
    })
    expect(target.repository.listReferencePoints(chartId)).toMatchObject([
      { index: 1, mapLat: 30, mapLon: 120, chartX: 100, chartY: 200 },
      { index: 2, mapLat: 30, mapLon: 121, chartX: 300, chartY: 200 }
    ])
    expect(readFileSync(target.repository.getChart(chartId)!.sourceFilePath)).toEqual(
      readFileSync(sourcePath)
    )
  })

  it('keeps unavailable bindings for users to adjust after import', () => {
    const source = createEnvironment()
    const target = createEnvironment()
    const chartId = 'portable-chart'
    const sourcePath = writePng(source.storage.chartsRoot, chartId, 'source.png', 'portable')
    source.repository.createChart(
      createChart({
        id: chartId,
        sourceFilePath: sourcePath,
        previewImagePath: sourcePath,
        titleMode: 'approach-procedure',
        boundRunwayNames: ['36R'],
        boundApproachProcedureIds: ['approach:101']
      })
    )
    source.repository.saveReferencePoints(chartId, createReferencePoints(chartId))
    const bundlePath = join(source.root, 'portable.zip')
    source.service(sourceNav()).exportBundle(
      bundlePath,
      [chartId],
      createSettings(),
      '0.2.0'
    )

    const targetService = target.service(() => emptyProcedures())
    const preview = targetService.previewImport(bundlePath, createSettings())

    targetService.importBundle(
      {
        sessionId: preview.sessionId,
        chartIds: [chartId]
      },
      createSettings()
    )
    expect(target.repository.getChart(chartId)).toMatchObject({
      titleMode: 'approach-procedure',
      boundRunwayNames: ['36R'],
      boundApproachProcedureIds: ['approach:101'],
      isGeoreferenced: true
    })
    expect(target.repository.listReferencePoints(chartId)).toHaveLength(2)
  })

  it('rejects a bundle whose asset hash does not match the manifest', () => {
    const source = createEnvironment()
    const target = createEnvironment()
    const chartId = 'hash-chart'
    const sourcePath = writePng(source.storage.chartsRoot, chartId, 'source.png', 'hash')
    source.repository.createChart(
      createChart({
        id: chartId,
        sourceFilePath: sourcePath,
        previewImagePath: sourcePath
      })
    )
    const bundlePath = join(source.root, 'valid.zip')
    source.service(sourceNav()).exportBundle(
      bundlePath,
      [chartId],
      createSettings(),
      '0.2.0'
    )

    const entries = readZipArchive(readFileSync(bundlePath), {
      maxEntries: 500,
      maxEntrySize: 128 * 1024 * 1024,
      maxTotalSize: 512 * 1024 * 1024
    })
    const manifest = JSON.parse(entries.get('manifest.json')!.toString('utf8')) as {
      charts: Array<{ assets: { source: { sha256: string } } }>
    }
    manifest.charts[0]!.assets.source.sha256 = '0'.repeat(64)
    entries.set('manifest.json', Buffer.from(JSON.stringify(manifest), 'utf8'))
    const damagedPath = join(source.root, 'damaged.zip')
    writeFileSync(
      damagedPath,
      createZipArchive(
        [...entries.entries()].map(([name, data]) => ({ name, data }))
      )
    )

    expect(() =>
      target.service(targetNav()).previewImport(damagedPath, createSettings())
    ).toThrow('CHART_BUNDLE_ASSET_INTEGRITY_FAILED')
  })
})

function createEnvironment() {
  const root = mkdtempSync(join(tmpdir(), 'nextefb-bundle-'))
  roots.push(root)
  const storage: StorageSummary = {
    databasePath: ':memory:',
    chartsRoot: join(root, 'charts'),
    defaultChartsRoot: join(root, 'charts'),
    legacyChartsRoot: join(root, 'legacy')
  }
  mkdirSync(storage.chartsRoot, { recursive: true })
  const repository = new ChartRepository(storage)
  return {
    root,
    storage,
    repository,
    service: (
      getAirportProcedures: (
        settings: ReturnType<typeof createSettings>,
        airportIdent: string
      ) => NavAirportProcedures
    ) =>
      new ChartBundleService({
        chartRepository: repository,
        getStorageSummary: () => storage,
        navDataService: { getAirportProcedures }
      })
  }
}

function writePng(
  chartsRoot: string,
  chartId: string,
  fileName: string,
  payload: string
): string {
  const chartDir = join(chartsRoot, chartId)
  mkdirSync(chartDir, { recursive: true })
  const filePath = join(chartDir, fileName)
  writeFileSync(
    filePath,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from(payload)
    ])
  )
  return filePath
}

function sourceNav() {
  return () =>
    procedures({
      runwayName: '09L',
      procedureId: 'approach:101'
    })
}

function targetNav() {
  return () =>
    procedures({
      runwayName: '9L',
      procedureId: 'approach:999'
    })
}

function procedures(options: {
  runwayName: string
  procedureId: string
}): NavAirportProcedures {
  return {
    airport: {
      ident: 'ZBAA',
      name: 'Beijing',
      city: null,
      country: null,
      lat: 40,
      lon: 116
    },
    runways: [
      {
        name: options.runwayName,
        displayName: options.runwayName,
        lengthM: 3_800,
        widthM: 60,
        surface: 'A',
        headingDeg: 90
      },
      {
        name: '36R',
        displayName: '36R',
        lengthM: 3_800,
        widthM: 60,
        surface: 'A',
        headingDeg: 360
      }
    ],
    departures: [],
    arrivals: [],
    transitions: [],
    approaches: [
      {
        id: options.procedureId,
        name: 'ILS Z 09L',
        procedureType: 'approach',
        runwayName: options.runwayName
      }
    ]
  }
}

function emptyProcedures(): NavAirportProcedures {
  return {
    airport: null,
    runways: [],
    departures: [],
    arrivals: [],
    transitions: [],
    approaches: []
  }
}
