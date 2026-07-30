import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { StorageSummary } from '@shared/chart-types'
import { createChart, createReferencePoints } from '../../helpers/factories'
import { ChartRepository } from '../../../src/main/services/storage/ChartRepository'

describe('ChartRepository', () => {
  let root: string
  let storage: StorageSummary

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nextefb-charts-'))
    storage = {
      databasePath: ':memory:',
      chartsRoot: join(root, 'charts'),
      defaultChartsRoot: join(root, 'charts'),
      legacyChartsRoot: join(root, 'legacy')
    }
  })

  it('creates, lists, reads and updates charts', () => {
    const repository = new ChartRepository(storage)
    const older = createChart({ id: 'old', title: 'Old', updatedAt: 100 })
    const newer = createChart({ id: 'new', title: 'New', updatedAt: 200 })

    expect(repository.createChart(older)).toEqual(older)
    repository.createChart(newer)
    expect(repository.listCharts().map((chart) => chart.id)).toEqual(['new', 'old'])
    expect(repository.getChart('missing')).toBeNull()

    const updated = repository.updateChart({
      id: 'old',
      title: 'Updated',
      airportCode: 'zspd',
      chartType: 'airport',
      titleMode: 'approach-procedure',
      boundRunwayNames: ['17L', '35R'],
      boundApproachProcedureIds: ['approach:8', 'approach:9']
    })
    expect(updated).toMatchObject({
      id: 'old',
      title: 'Updated',
      airportCode: 'zspd',
      chartType: 'airport',
      titleMode: 'approach-procedure',
      boundRunwayNames: ['17L', '35R'],
      boundApproachProcedureIds: ['approach:8', 'approach:9']
    })
  })

  it('replaces reference points and maintains georeference state', () => {
    const repository = new ChartRepository(storage)
    repository.createChart(createChart())
    const points = createReferencePoints()

    expect(repository.saveReferencePoints('chart-1', points)).toEqual(points)
    expect(repository.getChart('chart-1')?.isGeoreferenced).toBe(true)

    expect(repository.saveReferencePoints('chart-1', points.slice(0, 1))).toEqual(
      points.slice(0, 1)
    )
    expect(repository.getChart('chart-1')?.isGeoreferenced).toBe(false)

    repository.deleteChart('chart-1')
    expect(repository.getChart('chart-1')).toBeNull()
    expect(repository.listReferencePoints('chart-1')).toEqual([])
  })

  it('relocates only asset paths that belong to the previous root', () => {
    const repository = new ChartRepository(storage)
    const insideSource = join(storage.chartsRoot, 'chart-1', 'source.png')
    const insidePreview = join(storage.chartsRoot, 'chart-1', 'display.png')
    repository.createChart(
      createChart({
        sourceFilePath: insideSource,
        previewImagePath: insidePreview
      })
    )
    repository.createChart(
      createChart({
        id: 'external',
        sourceFilePath: join(root, 'external.png'),
        previewImagePath: null
      })
    )

    const nextRoot = join(root, 'next')
    repository.relocateChartAssetPaths(storage.chartsRoot, nextRoot)
    expect(repository.getChart('chart-1')).toMatchObject({
      sourceFilePath: join(nextRoot, 'chart-1', 'source.png'),
      previewImagePath: join(nextRoot, 'chart-1', 'display.png')
    })
    expect(repository.getChart('external')?.sourceFilePath).toBe(join(root, 'external.png'))
  })
})
