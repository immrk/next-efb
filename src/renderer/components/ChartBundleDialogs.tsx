import {
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import { PackageCheck, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ChartBundleImportChartPreview,
  ChartBundleImportPreview,
  ChartRecord,
  ChartType
} from '@shared/chart-types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

const CHART_TYPE_ORDER: ChartType[] = ['airport', 'sid', 'star', 'approach', 'general']

interface ChartBundleImportDialogProps {
  preview: ChartBundleImportPreview | null
  pending: boolean
  onCancel: () => void
  onConfirm: (chartIds: string[]) => void
}

export function ChartBundleImportDialog({
  preview,
  pending,
  onCancel,
  onConfirm
}: ChartBundleImportDialogProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedIds(new Set(preview?.charts.map((chart) => chart.id) ?? []))
  }, [preview])

  if (!preview) return null

  const allSelected =
    preview.charts.length > 0 && selectedIds.size === preview.charts.length
  const selectedCharts = preview.charts.filter((chart) => selectedIds.has(chart.id))
  const createCount = selectedCharts.filter((chart) => chart.action === 'create').length
  const updateCount = selectedCharts.length - createCount
  const groups = groupCharts(preview.charts)

  return (
    <div className="chart-meta-modal-backdrop chart-bundle-backdrop">
      <section
        className="chart-meta-modal chart-bundle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-bundle-import-title"
      >
        <header className="chart-meta-modal-head chart-bundle-head">
          <div>
            <h3 id="chart-bundle-import-title">{t('charts.bundleImportTitle')}</h3>
            <p>
              {t('charts.bundleImportSummary', {
                file: preview.fileName,
                count: preview.charts.length,
                size: formatBytes(preview.totalAssetSizeBytes)
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            onClick={onCancel}
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="chart-meta-modal-body chart-bundle-body">
          <div className="chart-bundle-policy">
            <PackageCheck aria-hidden="true" />
            <span>{t('charts.bundleImportPolicy')}</span>
          </div>

          <label className="chart-bundle-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => {
                setSelectedIds(
                  event.target.checked
                    ? new Set(preview.charts.map((chart) => chart.id))
                    : new Set()
                )
              }}
            />
            <span>{t('charts.bundleSelectAll')}</span>
          </label>

          <div className="chart-bundle-groups">
            {groups.map((airportGroup) => (
              <ChartBundleAirportGroup
                key={airportGroup.airportCode}
                group={airportGroup}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                renderChart={(chart) => (
                  <ImportChartItem
                    key={chart.id}
                    chart={chart}
                    selected={selectedIds.has(chart.id)}
                    setSelectedIds={setSelectedIds}
                  />
                )}
              />
            ))}
          </div>
        </div>

        <footer className="chart-meta-modal-foot chart-bundle-foot">
          <span>
            {t('charts.bundleSelectionSummary', {
              count: selectedIds.size,
              create: createCount,
              update: updateCount
            })}
          </span>
          <div>
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={pending || selectedIds.size === 0}
              onClick={() => onConfirm([...selectedIds])}
            >
              {pending ? t('charts.bundleImporting') : t('charts.bundleConfirmImport')}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function ImportChartItem({
  chart,
  selected,
  setSelectedIds
}: {
  chart: ChartBundleImportChartPreview
  selected: boolean
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
}) {
  const { t } = useTranslation()

  return (
    <label className={`chart-bundle-chart ${selected ? 'is-selected' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) =>
          setSingleSelection(setSelectedIds, chart.id, event.target.checked)
        }
      />
      <div className="chart-bundle-chart-copy">
        <div className="chart-bundle-chart-title">
          <strong>{chart.title}</strong>
          <div>
            <Badge variant={chart.action === 'update' ? 'secondary' : 'outline'}>
              {t(`charts.bundleAction.${chart.action}`)}
            </Badge>
            {chart.isOlderThanLocal ? (
              <Badge variant="destructive">{t('charts.bundleOlderVersion')}</Badge>
            ) : null}
          </div>
        </div>
        <span className="chart-bundle-chart-meta">{formatBytes(chart.assetSizeBytes)}</span>
        {chart.action === 'update' &&
        chart.localTitle &&
        chart.localTitle !== chart.title ? (
          <span className="chart-bundle-local-title">
            {t('charts.bundleLocalTitle', { title: chart.localTitle })}
          </span>
        ) : null}
      </div>
    </label>
  )
}

interface ChartBundleExportDialogProps {
  open: boolean
  charts: ChartRecord[]
  initialChartId: string | null
  pending: boolean
  onCancel: () => void
  onConfirm: (chartIds: string[]) => void
}

export function ChartBundleExportDialog({
  open,
  charts,
  initialChartId,
  pending,
  onCancel,
  onConfirm
}: ChartBundleExportDialogProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    const initial =
      initialChartId && charts.some((chart) => chart.id === initialChartId)
        ? [initialChartId]
        : charts[0]
          ? [charts[0].id]
          : []
    setSelectedIds(new Set(initial))
  }, [charts, initialChartId, open])

  if (!open) return null
  const allSelected = charts.length > 0 && selectedIds.size === charts.length
  const groups = groupCharts(charts)

  return (
    <div className="chart-meta-modal-backdrop chart-bundle-backdrop">
      <section
        className="chart-meta-modal chart-bundle-modal chart-bundle-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-bundle-export-title"
      >
        <header className="chart-meta-modal-head chart-bundle-head">
          <div>
            <h3 id="chart-bundle-export-title">{t('charts.bundleExportTitle')}</h3>
            <p>{t('charts.bundleExportHint')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            onClick={onCancel}
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="chart-meta-modal-body chart-bundle-body">
          <label className="chart-bundle-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked
                    ? new Set(charts.map((chart) => chart.id))
                    : new Set()
                )
              }
            />
            <span>{t('charts.bundleSelectAll')}</span>
          </label>
          <div className="chart-bundle-groups">
            {groups.map((airportGroup) => (
              <ChartBundleAirportGroup
                key={airportGroup.airportCode}
                group={airportGroup}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                renderChart={(chart) => (
                  <ExportChartItem
                    key={chart.id}
                    chart={chart}
                    selected={selectedIds.has(chart.id)}
                    setSelectedIds={setSelectedIds}
                  />
                )}
              />
            ))}
          </div>
        </div>

        <footer className="chart-meta-modal-foot chart-bundle-foot">
          <span>{t('charts.bundleExportSelection', { count: selectedIds.size })}</span>
          <div>
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={pending || selectedIds.size === 0}
              onClick={() => onConfirm([...selectedIds])}
            >
              {pending ? t('charts.bundleExporting') : t('charts.bundleConfirmExport')}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function ExportChartItem({
  chart,
  selected,
  setSelectedIds
}: {
  chart: ChartRecord
  selected: boolean
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
}) {
  const { t } = useTranslation()

  return (
    <label
      className={`chart-bundle-chart chart-bundle-export-chart ${
        selected ? 'is-selected' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) =>
          setSingleSelection(setSelectedIds, chart.id, event.target.checked)
        }
      />
      <div className="chart-bundle-chart-copy">
        <strong>{chart.title}</strong>
        <span className="chart-bundle-chart-meta">
          {chart.isGeoreferenced
            ? t('charts.georeferenced')
            : t('charts.notGeoreferenced')}
        </span>
      </div>
    </label>
  )
}

interface GroupableChart {
  id: string
  airportCode: string | null
  chartType: ChartType
  title: string
}

interface ChartAirportGroup<T extends GroupableChart> {
  airportCode: string
  charts: T[]
  types: Array<{
    type: ChartType
    charts: T[]
  }>
}

function ChartBundleAirportGroup<T extends GroupableChart>({
  group,
  selectedIds,
  setSelectedIds,
  renderChart
}: {
  group: ChartAirportGroup<T>
  selectedIds: Set<string>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  renderChart: (chart: T) => ReactNode
}) {
  const { t } = useTranslation()
  const airportIds = group.charts.map((chart) => chart.id)
  const airportSelected = countSelected(airportIds, selectedIds)

  return (
    <section className="chart-bundle-airport-group">
      <header className="chart-bundle-airport-head">
        <GroupCheckbox
          ids={airportIds}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          label={t('charts.bundleToggleGroup', { name: group.airportCode })}
        />
        <strong>{group.airportCode}</strong>
        <Badge variant="outline">
          {airportSelected}/{airportIds.length}
        </Badge>
      </header>

      <div className="chart-bundle-type-groups">
        {group.types.map((typeGroup) => {
          const typeIds = typeGroup.charts.map((chart) => chart.id)
          const typeSelected = countSelected(typeIds, selectedIds)
          return (
            <section key={typeGroup.type} className="chart-bundle-type-group">
              <header className="chart-bundle-type-head">
                <GroupCheckbox
                  ids={typeIds}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  label={t('charts.bundleToggleGroup', {
                    name: `${group.airportCode} ${t(`chartType.${typeGroup.type}`)}`
                  })}
                />
                <span>{t(`chartType.${typeGroup.type}`)}</span>
                <Badge variant="secondary">
                  {typeSelected}/{typeIds.length}
                </Badge>
              </header>
              <div className="chart-bundle-chart-list">
                {typeGroup.charts.map(renderChart)}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function GroupCheckbox({
  ids,
  selectedIds,
  setSelectedIds,
  label
}: {
  ids: string[]
  selectedIds: Set<string>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  label: string
}) {
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id))
  return (
    <input
      className="chart-bundle-group-checkbox"
      type="checkbox"
      checked={allSelected}
      aria-label={label}
      onChange={() => setGroupSelection(setSelectedIds, ids, !allSelected)}
    />
  )
}

function groupCharts<T extends GroupableChart>(charts: T[]): ChartAirportGroup<T>[] {
  const airports = new Map<string, T[]>()
  for (const chart of charts) {
    const airportCode = chart.airportCode?.trim().toUpperCase() || 'UNSPEC'
    const bucket = airports.get(airportCode) ?? []
    bucket.push(chart)
    airports.set(airportCode, bucket)
  }

  return [...airports.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([airportCode, airportCharts]) => ({
      airportCode,
      charts: airportCharts,
      types: CHART_TYPE_ORDER.filter((type) =>
        airportCharts.some((chart) => chart.chartType === type)
      ).map((type) => ({
        type,
        charts: airportCharts
          .filter((chart) => chart.chartType === type)
          .sort((left, right) => left.title.localeCompare(right.title))
      }))
    }))
}

function countSelected(ids: string[], selectedIds: Set<string>): number {
  return ids.filter((id) => selectedIds.has(id)).length
}

function setSingleSelection(
  setter: Dispatch<SetStateAction<Set<string>>>,
  id: string,
  selected: boolean
) {
  setGroupSelection(setter, [id], selected)
}

function setGroupSelection(
  setter: Dispatch<SetStateAction<Set<string>>>,
  ids: string[],
  selected: boolean
) {
  setter((current) => {
    const next = new Set(current)
    for (const id of ids) {
      if (selected) next.add(id)
      else next.delete(id)
    }
    return next
  })
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
