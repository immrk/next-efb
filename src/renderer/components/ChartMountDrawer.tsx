import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ChevronDown, FileText, Pencil, Pin, Plus, SearchX, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChartRecord, ChartType } from '@shared/chart-types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'

const CHART_TYPE_ORDER: ChartType[] = ['airport', 'sid', 'star', 'approach', 'general']

function groupChartsByAirportAndType(charts: ChartRecord[]) {
  const airportMap = new Map<
    string,
    {
      airportCode: string
      byType: Map<ChartType, ChartRecord[]>
    }
  >()

  charts.forEach((chart) => {
    const airportCode = chart.airportCode?.trim().toUpperCase() || 'UNSPEC'
    const airportBucket = airportMap.get(airportCode) ?? {
      airportCode,
      byType: new Map()
    }

    const typeBucket = airportBucket.byType.get(chart.chartType) ?? []
    typeBucket.push(chart)
    airportBucket.byType.set(chart.chartType, typeBucket)
    airportMap.set(airportCode, airportBucket)
  })

  return Array.from(airportMap.values())
    .sort((a, b) => a.airportCode.localeCompare(b.airportCode))
    .map((airport) => ({
      airportCode: airport.airportCode,
      types: CHART_TYPE_ORDER
        .filter((type) => airport.byType.has(type))
        .map((type) => ({
          type,
          charts: (airport.byType.get(type) ?? []).sort((a, b) => a.title.localeCompare(b.title))
        }))
    }))
}

interface ChartMountDrawerProps {
  mode?: 'overlay' | 'docked'
  isOpen?: boolean
  closable?: boolean
  charts: ChartRecord[]
  mountedChartIds?: string[]
  selectedChartId?: string | null
  showPinButton?: boolean
  onClose?: () => void
  onSelect?: (chartId: string) => void
  onPin?: (chartId: string) => void
  onEdit?: (chartId: string) => void
  onImport?: () => void
  importUrlValue?: string
  importUrlPending?: boolean
  onImportUrlValueChange?: (value: string) => void
  onImportFromUrl?: () => void
}

export function ChartMountDrawer({
  mode = 'overlay',
  isOpen = true,
  closable = true,
  charts,
  mountedChartIds = [],
  selectedChartId = null,
  showPinButton = true,
  onClose,
  onSelect,
  onPin,
  onEdit,
  onImport,
  importUrlValue = '',
  importUrlPending = false,
  onImportUrlValueChange,
  onImportFromUrl
}: ChartMountDrawerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [showUrlImport, setShowUrlImport] = useState(false)
  const [collapsedAirports, setCollapsedAirports] = useState<Set<string>>(() => new Set())
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(() => new Set())

  const chartTypeLabel: Record<ChartType, string> = {
    airport: t('chartType.airport'),
    sid: t('chartType.sid'),
    star: t('chartType.star'),
    approach: t('chartType.approach'),
    general: t('chartType.general')
  }

  const filteredCharts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return charts

    return charts.filter((chart) => {
      const haystack = [chart.title, chart.airportCode ?? '', chart.chartType]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [charts, search])

  const groupedCharts = useMemo(
    () => groupChartsByAirportAndType(filteredCharts),
    [filteredCharts]
  )
  const isSearching = search.trim().length > 0
  const isLibraryEmpty = charts.length === 0

  const toggleCollapsedKey = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    key: string
  ) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (mode === 'overlay' && !isOpen) return null

  const drawerContent = (
    <>
      <header className="chart-picker-head">
        <Input
          className="chart-picker-search"
          placeholder={t('charts.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="search"
          spellCheck={false}
        />
        {onImportFromUrl ? (
          <Button
            type="button"
            variant={showUrlImport ? 'default' : 'outline'}
            size="icon"
            className="chart-picker-link-toggle"
            onClick={() => setShowUrlImport((value) => !value)}
            aria-label={t('charts.add')}
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
        {closable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="chart-picker-close"
            onClick={onClose}
            aria-label={t('charts.closePicker')}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </header>

      {showUrlImport && onImportFromUrl ? (
        <div className="chart-import-url-bar">
          {onImport ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="chart-import-file-button"
              onClick={onImport}
              aria-label={t('charts.importAction')}
              title={t('charts.importAction')}
            >
              <FileText className="size-4" />
            </Button>
          ) : null}
          <Input
            className="chart-import-url-input"
            placeholder={t('charts.importUrlPlaceholder')}
            value={importUrlValue}
            onChange={(event) => onImportUrlValueChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !importUrlPending) {
                event.preventDefault()
                onImportFromUrl()
              }
            }}
          />
          <Button
            type="button"
            variant="default"
            className="chart-import-url-submit"
            disabled={importUrlPending || !importUrlValue.trim()}
            onClick={onImportFromUrl}
          >
            {importUrlPending ? t('charts.importUrlPending') : t('charts.importUrlAction')}
          </Button>
        </div>
      ) : null}

      <div
        className={`chart-picker-body ${groupedCharts.length === 0 ? 'is-empty' : ''}`}
        aria-live="polite"
      >
        {groupedCharts.length > 0 ? (
          <div className="chart-picker-list">
            {groupedCharts.map((group) => {
              const isAirportExpanded = isSearching || !collapsedAirports.has(group.airportCode)

              return (
                <section
                  key={group.airportCode}
                  className={`chart-airport-group ${isAirportExpanded ? 'is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="chart-airport-head"
                    aria-expanded={isAirportExpanded}
                    onClick={() => toggleCollapsedKey(setCollapsedAirports, group.airportCode)}
                  >
                    <span className="collapse-chevron" aria-hidden="true">
                      <ChevronDown />
                    </span>
                    <span className="chart-airport-code">{group.airportCode}</span>
                    <Badge variant="outline" className="chart-group-count">
                      {group.types.reduce((acc, item) => acc + item.charts.length, 0)}
                    </Badge>
                  </button>

                  {isAirportExpanded
                    ? group.types.map((typeGroup) => {
                        const typeKey = `${group.airportCode}-${typeGroup.type}`
                        const isTypeExpanded = isSearching || !collapsedTypes.has(typeKey)

                        return (
                          <section
                            key={typeKey}
                            className={`chart-type-group ${isTypeExpanded ? 'is-open' : ''}`}
                          >
                            <button
                              type="button"
                              className="chart-type-head"
                              aria-expanded={isTypeExpanded}
                              onClick={() => toggleCollapsedKey(setCollapsedTypes, typeKey)}
                            >
                              <span className="collapse-chevron" aria-hidden="true">
                                <ChevronDown />
                              </span>
                              <span>{chartTypeLabel[typeGroup.type]}</span>
                              <Badge variant="outline" className="chart-group-count">
                                {typeGroup.charts.length}
                              </Badge>
                            </button>

                            {isTypeExpanded ? (
                              <div className="chart-candidate-list">
                                {typeGroup.charts.map((chart) => {
                                  const isMounted = mountedChartIds.includes(chart.id)
                                  const isSelected = selectedChartId === chart.id
                                  const editLabel = t('charts.editAria', { title: chart.title })
                                  const pinLabel = t('charts.pinAria', { title: chart.title })

                                  return (
                                    <article
                                      key={chart.id}
                                      className={`chart-candidate-item ${isSelected ? 'selected' : ''}`}
                                    >
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="chart-candidate-main"
                                        onClick={() => onSelect?.(chart.id)}
                                      >
                                        <strong>{chart.title}</strong>
                                        <span>
                                          {chart.isGeoreferenced
                                            ? t('charts.georeferenced')
                                            : t('charts.notGeoreferenced')}
                                        </span>
                                      </Button>
                                      <div className="chart-candidate-actions">
                                        {onEdit ? (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="chart-action-button"
                                            onClick={() => onEdit(chart.id)}
                                            aria-label={editLabel}
                                            title={editLabel}
                                          >
                                            <Pencil className="size-4" />
                                          </Button>
                                        ) : null}
                                        {showPinButton ? (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className={`chart-pin-button ${isMounted ? 'mounted' : ''}`}
                                            disabled={!chart.isGeoreferenced}
                                            onClick={() => onPin?.(chart.id)}
                                            aria-label={pinLabel}
                                            title={pinLabel}
                                          >
                                            <Pin className="size-4" />
                                          </Button>
                                        ) : null}
                                      </div>
                                    </article>
                                  )
                                })}
                              </div>
                            ) : null}
                          </section>
                        )
                      })
                    : null}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="chart-picker-empty" role="status">
            {isLibraryEmpty ? <FileText aria-hidden="true" /> : <SearchX aria-hidden="true" />}
            <strong>
              {isLibraryEmpty ? t('charts.emptyTitle') : t('charts.searchEmpty')}
            </strong>
            {isLibraryEmpty ? <span>{t('charts.emptyDescription')}</span> : null}
          </div>
        )}
      </div>
    </>
  )

  if (mode === 'docked') {
    return (
      <section className="chart-picker-drawer chart-picker-drawer-docked">
        {drawerContent}
      </section>
    )
  }

  return (
    <aside className="chart-picker-drawer-layer">
      <section
        className="chart-picker-drawer chart-picker-drawer-overlay"
        role="dialog"
        aria-modal="false"
        aria-label={t('charts.add')}
      >
        {drawerContent}
      </section>
    </aside>
  )
}
