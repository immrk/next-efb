import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import { ChevronDown, FileText, LoaderCircle, Pencil, Pin, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChartAirportSummary, ChartRecord, ChartType } from '@shared/chart-types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { LibraryImportToolbar } from './LibraryImportToolbar'

const CHART_TYPE_ORDER: ChartType[] = ['airport', 'sid', 'star', 'approach', 'general']
const ROW_HEIGHT = { airport: 48, type: 32, chart: 58, status: 48 } as const
const VIRTUAL_OVERSCAN_PX = 240
const DEFAULT_VIEWPORT_HEIGHT = 640

type VirtualRow =
  | { key: string; kind: 'airport'; airport: ChartAirportSummary }
  | { key: string; kind: 'type'; airportCode: string; type: ChartType; chartCount: number }
  | { key: string; kind: 'chart'; chart: ChartRecord }
  | { key: string; kind: 'status'; status: 'loading' | 'empty' }

interface MeasuredRow {
  row: VirtualRow
  top: number
  height: number
}

interface ChartMountDrawerProps {
  mode?: 'overlay' | 'docked'
  isOpen?: boolean
  closable?: boolean
  charts: ChartRecord[]
  airports?: ChartAirportSummary[]
  expandedAirportCode?: string | null
  isAirportLoading?: boolean
  isLoadingAirports?: boolean
  searchValue?: string
  mountedChartIds?: string[]
  selectedChartId?: string | null
  showPinButton?: boolean
  onClose?: () => void
  onSelect?: (chartId: string) => void
  onPin?: (chartId: string) => void
  onEdit?: (chartId: string) => void
  onImport?: () => void
  onSearchValueChange?: (value: string) => void
  onExpandedAirportChange?: (airportCode: string | null) => void
  importUrlValue?: string
  importUrlPending?: boolean
  onImportUrlValueChange?: (value: string) => void
  onImportFromUrl?: () => void
  onImportBundle?: () => void
  onExportBundle?: () => void
}

export function ChartMountDrawer({
  mode = 'overlay',
  isOpen = true,
  closable = true,
  charts,
  airports,
  expandedAirportCode,
  isAirportLoading = false,
  isLoadingAirports = false,
  searchValue,
  mountedChartIds = [],
  selectedChartId = null,
  showPinButton = true,
  onClose,
  onSelect,
  onPin,
  onEdit,
  onImport,
  onSearchValueChange,
  onExpandedAirportChange,
  importUrlValue = '',
  importUrlPending = false,
  onImportUrlValueChange,
  onImportFromUrl,
  onImportBundle,
  onExportBundle
}: ChartMountDrawerProps) {
  const { t } = useTranslation()
  const [internalSearch, setInternalSearch] = useState('')
  const [showUrlImport, setShowUrlImport] = useState(false)
  const [internalExpandedAirport, setInternalExpandedAirport] = useState<string | null>(null)
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(() => new Set())
  const bodyRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT)

  const search = searchValue ?? internalSearch
  const currentExpandedAirport = expandedAirportCode === undefined
    ? internalExpandedAirport
    : expandedAirportCode
  const chartTypeLabel: Record<ChartType, string> = {
    airport: t('chartType.airport'),
    sid: t('chartType.sid'),
    star: t('chartType.star'),
    approach: t('chartType.approach'),
    general: t('chartType.general')
  }

  const resolvedAirports = useMemo(
    () => airports ?? summarizeChartAirports(charts),
    [airports, charts]
  )
  const visibleAirports = useMemo(() => {
    if (airports) return resolvedAirports
    const query = search.trim().toLowerCase()
    if (!query) return resolvedAirports
    return resolvedAirports.filter((airport) =>
      airport.airportCode.toLowerCase().includes(query) ||
      charts.some((chart) =>
        normalizeAirportCode(chart.airportCode) === airport.airportCode &&
        chartMatchesSearch(chart, query)
      )
    )
  }, [airports, charts, resolvedAirports, search])
  const expandedCharts = useMemo(() => {
    if (!currentExpandedAirport) return []
    const query = search.trim().toLowerCase()
    return charts.filter((chart) =>
      normalizeAirportCode(chart.airportCode) === currentExpandedAirport &&
      (!query || chartMatchesSearch(chart, query))
    )
  }, [charts, currentExpandedAirport, search])
  const rows = useMemo(
    () => buildRows(
      visibleAirports,
      currentExpandedAirport,
      expandedCharts,
      collapsedTypes,
      isAirportLoading
    ),
    [collapsedTypes, currentExpandedAirport, expandedCharts, isAirportLoading, visibleAirports]
  )
  const measuredRows = useMemo(() => measureRows(rows), [rows])
  const finalRow = measuredRows.at(-1)
  const totalHeight = finalRow ? finalRow.top + finalRow.height : 0
  const visibleRows = useMemo(
    () => measuredRows.filter(({ top, height }) =>
      top + height >= scrollTop - VIRTUAL_OVERSCAN_PX &&
      top <= scrollTop + viewportHeight + VIRTUAL_OVERSCAN_PX
    ),
    [measuredRows, scrollTop, viewportHeight]
  )

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = () => setViewportHeight(body.clientHeight || DEFAULT_VIEWPORT_HEIGHT)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const maximum = Math.max(0, totalHeight - viewportHeight)
    if (body.scrollTop > maximum) {
      body.scrollTop = maximum
      setScrollTop(maximum)
    }
  }, [totalHeight, viewportHeight])

  useEffect(() => {
    if (
      airports === undefined &&
      currentExpandedAirport &&
      !visibleAirports.some((airport) => airport.airportCode === currentExpandedAirport)
    ) {
      setInternalExpandedAirport(null)
    }
  }, [airports, currentExpandedAirport, visibleAirports])

  if (mode === 'overlay' && !isOpen) return null

  const updateSearch = (value: string) => {
    if (searchValue === undefined) setInternalSearch(value)
    onSearchValueChange?.(value)
  }
  const toggleAirport = (airportCode: string) => {
    const next = currentExpandedAirport === airportCode ? null : airportCode
    if (expandedAirportCode === undefined) setInternalExpandedAirport(next)
    setCollapsedTypes(new Set())
    onExpandedAirportChange?.(next)
  }
  const toggleType = (airportCode: string, type: ChartType) => {
    const key = `${airportCode}-${type}`
    setCollapsedTypes((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const content = (
    <>
      <LibraryImportToolbar
        namespace="charts"
        searchValue={search}
        onSearchValueChange={updateSearch}
        showImportPanel={showUrlImport}
        onShowImportPanelChange={setShowUrlImport}
        closable={closable}
        onClose={onClose}
        onImportFile={onImport}
        importUrlValue={importUrlValue}
        importUrlPending={importUrlPending}
        onImportUrlValueChange={onImportUrlValueChange}
        onImportFromUrl={onImportFromUrl}
        onImportBundle={onImportBundle}
        onExportBundle={onExportBundle}
      />
      <div className="chart-picker-section-head">
        <strong>{t('charts.airportListTitle')}</strong>
        <span>{t('charts.airportCount', { count: visibleAirports.length })}</span>
      </div>
      <div
        ref={bodyRef}
        className={`chart-picker-body ${rows.length === 0 ? 'is-empty' : ''}`}
        aria-live="polite"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {isLoadingAirports && visibleAirports.length === 0 ? (
          <LoadingState label={t('common.loading', { defaultValue: 'Loading...' })} />
        ) : rows.length > 0 ? (
          <div className="chart-picker-virtual-spacer" style={{ height: totalHeight }}>
            {visibleRows.map(({ row, top, height }) => (
              <div
                key={row.key}
                className={`chart-picker-virtual-row is-${row.kind}`}
                style={{
                  '--virtual-row-top': `${top}px`,
                  '--virtual-row-height': `${height}px`
                } as CSSProperties}
              >
                {row.kind === 'airport' ? (
                  <section className={`chart-airport-group ${currentExpandedAirport === row.airport.airportCode ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="chart-airport-head"
                      aria-expanded={currentExpandedAirport === row.airport.airportCode}
                      onClick={() => toggleAirport(row.airport.airportCode)}
                    >
                      <span className="collapse-chevron" aria-hidden="true"><ChevronDown /></span>
                      <span
                        className={`chart-airport-code ${row.airport.airportCode === 'UNSPEC' ? 'is-unassigned' : ''}`}
                        title={row.airport.airportCode === 'UNSPEC'
                          ? t('charts.unassignedAirport')
                          : row.airport.airportCode}
                      >
                        {row.airport.airportCode === 'UNSPEC'
                          ? t('charts.unassignedAirport')
                          : row.airport.airportCode}
                      </span>
                      <Badge variant="outline" className="chart-group-count">{row.airport.chartCount}</Badge>
                    </button>
                  </section>
                ) : row.kind === 'type' ? (
                  <section className={`chart-type-group ${collapsedTypes.has(`${row.airportCode}-${row.type}`) ? '' : 'is-open'}`}>
                    <button
                      type="button"
                      className="chart-type-head"
                      aria-expanded={!collapsedTypes.has(`${row.airportCode}-${row.type}`)}
                      onClick={() => toggleType(row.airportCode, row.type)}
                    >
                      <span className="collapse-chevron" aria-hidden="true"><ChevronDown /></span>
                      <span>{chartTypeLabel[row.type]}</span>
                      <span className="chart-type-count">{row.chartCount}</span>
                    </button>
                  </section>
                ) : row.kind === 'chart' ? (
                  <ChartRow
                    chart={row.chart}
                    selected={selectedChartId === row.chart.id}
                    mounted={mountedChartIds.includes(row.chart.id)}
                    showPinButton={showPinButton}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onPin={onPin}
                  />
                ) : (
                  <div className="chart-virtual-status" role="status">
                    {row.status === 'loading'
                      ? <LoaderCircle className="animate-spin" aria-hidden="true" />
                      : <SearchX aria-hidden="true" />}
                    <span>{row.status === 'loading'
                      ? t('common.loading', { defaultValue: 'Loading...' })
                      : t('charts.searchEmpty')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="chart-picker-empty" role="status">
            {resolvedAirports.length === 0 && !search.trim()
              ? <FileText aria-hidden="true" />
              : <SearchX aria-hidden="true" />}
            <strong>{resolvedAirports.length === 0 && !search.trim()
              ? t('charts.emptyTitle')
              : t('charts.searchEmpty')}</strong>
            {resolvedAirports.length === 0 && !search.trim()
              ? <span>{t('charts.emptyDescription')}</span>
              : null}
          </div>
        )}
      </div>
    </>
  )

  if (mode === 'docked') {
    return <section className="chart-picker-drawer chart-picker-drawer-docked">{content}</section>
  }
  return (
    <aside className="chart-picker-drawer-layer">
      <section
        className="chart-picker-drawer chart-picker-drawer-overlay"
        role="dialog"
        aria-modal="false"
        aria-label={t('charts.add')}
      >
        {content}
      </section>
    </aside>
  )
}

function ChartRow({
  chart,
  selected,
  mounted,
  showPinButton,
  onSelect,
  onEdit,
  onPin
}: {
  chart: ChartRecord
  selected: boolean
  mounted: boolean
  showPinButton: boolean
  onSelect?: (chartId: string) => void
  onEdit?: (chartId: string) => void
  onPin?: (chartId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <article className={`chart-candidate-item ${selected ? 'selected' : ''}`}>
      <Button type="button" variant="ghost" className="chart-candidate-main" onClick={() => onSelect?.(chart.id)}>
        <strong title={chart.title}>{chart.title}</strong>
        <span className={`chart-candidate-status ${chart.isGeoreferenced ? 'is-georeferenced' : ''}`}>
          <span className="chart-candidate-status-dot" aria-hidden="true" />
          {chart.isGeoreferenced ? t('charts.georeferenced') : t('charts.notGeoreferenced')}
        </span>
      </Button>
      <div className="chart-candidate-actions">
        {onEdit ? (
          <Button type="button" variant="ghost" size="icon" className="chart-action-button" onClick={() => onEdit(chart.id)} aria-label={t('charts.editAria', { title: chart.title })}>
            <Pencil className="size-4" />
          </Button>
        ) : null}
        {showPinButton ? (
          <Button type="button" variant="ghost" size="icon" className={`chart-pin-button ${mounted ? 'mounted' : ''}`} disabled={!chart.isGeoreferenced} onClick={() => onPin?.(chart.id)} aria-label={t('charts.pinAria', { title: chart.title })}>
            <Pin className="size-4" />
          </Button>
        ) : null}
      </div>
    </article>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="chart-picker-empty" role="status">
      <LoaderCircle className="animate-spin" aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  )
}

function summarizeChartAirports(charts: ChartRecord[]): ChartAirportSummary[] {
  const counts = new Map<string, number>()
  charts.forEach((chart) => {
    const airportCode = normalizeAirportCode(chart.airportCode)
    counts.set(airportCode, (counts.get(airportCode) ?? 0) + 1)
  })
  return Array.from(counts, ([airportCode, chartCount]) => ({ airportCode, chartCount }))
    .sort((left, right) => left.airportCode.localeCompare(right.airportCode))
}

function buildRows(
  airports: ChartAirportSummary[],
  expandedAirportCode: string | null,
  charts: ChartRecord[],
  collapsedTypes: Set<string>,
  isAirportLoading: boolean
): VirtualRow[] {
  const rows: VirtualRow[] = []
  airports.forEach((airport) => {
    rows.push({ key: `airport-${airport.airportCode}`, kind: 'airport', airport })
    if (airport.airportCode !== expandedAirportCode) return
    if (isAirportLoading) {
      rows.push({ key: `status-${airport.airportCode}-loading`, kind: 'status', status: 'loading' })
      return
    }
    const groups = groupChartsByType(charts)
    if (groups.length === 0) {
      rows.push({ key: `status-${airport.airportCode}-empty`, kind: 'status', status: 'empty' })
      return
    }
    groups.forEach(({ type, charts: typeCharts }) => {
      rows.push({
        key: `type-${airport.airportCode}-${type}`,
        kind: 'type',
        airportCode: airport.airportCode,
        type,
        chartCount: typeCharts.length
      })
      if (collapsedTypes.has(`${airport.airportCode}-${type}`)) return
      typeCharts.forEach((chart) => rows.push({ key: `chart-${chart.id}`, kind: 'chart', chart }))
    })
  })
  return rows
}

function groupChartsByType(charts: ChartRecord[]) {
  const byType = new Map<ChartType, ChartRecord[]>()
  charts.forEach((chart) => {
    const group = byType.get(chart.chartType) ?? []
    group.push(chart)
    byType.set(chart.chartType, group)
  })
  return CHART_TYPE_ORDER
    .filter((type) => byType.has(type))
    .map((type) => ({
      type,
      charts: (byType.get(type) ?? []).sort((left, right) => left.title.localeCompare(right.title))
    }))
}

function measureRows(rows: VirtualRow[]): MeasuredRow[] {
  let top = 0
  return rows.map((row) => {
    const height = ROW_HEIGHT[row.kind]
    const measured = { row, top, height }
    top += height
    return measured
  })
}

function chartMatchesSearch(chart: ChartRecord, query: string): boolean {
  return [chart.title, chart.airportCode ?? '', chart.chartType]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function normalizeAirportCode(value: string | null): string {
  return value?.trim().toUpperCase() || 'UNSPEC'
}
