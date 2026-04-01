import { useMemo, useState } from 'react'
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
  onImport
}: ChartMountDrawerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

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

  if (mode === 'overlay' && !isOpen) return null

  const drawerContent = (
    <>
      <header className="chart-picker-head">
        <Input
          className="chart-picker-search"
          placeholder={t('charts.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {closable ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="chart-picker-close"
            onClick={onClose}
            aria-label={t('charts.closePicker')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6L18 18M18 6L6 18" />
            </svg>
          </Button>
        ) : null}
      </header>

      <div className="chart-picker-body">
        {groupedCharts.length > 0 ? (
          groupedCharts.map((group) => (
            <details key={group.airportCode} className="chart-airport-group" open>
              <summary className="chart-airport-head">
                <span className="collapse-chevron" aria-hidden="true">
                  <svg viewBox="0 0 20 20">
                    <path d="M6 8L10 12L14 8" />
                  </svg>
                </span>
                <span className="chart-airport-code">{group.airportCode}</span>
                <Badge variant="outline" className="chart-group-count">
                  {group.types.reduce((acc, item) => acc + item.charts.length, 0)}
                </Badge>
              </summary>

              {group.types.map((typeGroup) => (
                <details key={`${group.airportCode}-${typeGroup.type}`} className="chart-type-group" open>
                  <summary className="chart-type-head">
                    <span className="collapse-chevron" aria-hidden="true">
                      <svg viewBox="0 0 20 20">
                        <path d="M6 8L10 12L14 8" />
                      </svg>
                    </span>
                    <span>{chartTypeLabel[typeGroup.type]}</span>
                    <Badge variant="outline" className="chart-group-count">
                      {typeGroup.charts.length}
                    </Badge>
                  </summary>

                  <div className="chart-candidate-list">
                    {typeGroup.charts.map((chart) => {
                      const isMounted = mountedChartIds.includes(chart.id)
                      const isSelected = selectedChartId === chart.id
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
                                variant="outline"
                                size="icon"
                                className="chart-action-button"
                                onClick={() => onEdit(chart.id)}
                                aria-label={t('charts.editAria', { title: chart.title })}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 16.5V20H7.5L17.81 9.69L14.31 6.19L4 16.5Z" />
                                  <path d="M13.5 7L17 10.5" />
                                </svg>
                              </Button>
                            ) : null}
                            {showPinButton ? (
                              <Button
                                type="button"
                                variant={isMounted ? 'default' : 'outline'}
                                size="icon"
                                className={`chart-pin-button ${isMounted ? 'mounted' : ''}`}
                                disabled={!chart.isGeoreferenced}
                                onClick={() => onPin?.(chart.id)}
                                aria-label={t('charts.pinAria', { title: chart.title })}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M14 4L20 10L17 11L14 8L11 11L13 18L11 20L8 14L4 18L3 17L7 13L1 10L3 8L10 10L13 7L10 4L11 3L14 4Z" />
                                </svg>
                              </Button>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </details>
              ))}
            </details>
          ))
        ) : (
          <div className="chart-picker-empty">{t('charts.searchEmpty')}</div>
        )}
      </div>
    </>
  )

  if (mode === 'docked') {
    return (
      <section className="chart-picker-drawer chart-picker-drawer-docked">
        {drawerContent}
        {onImport ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="chart-drawer-import-fab"
            onClick={onImport}
            aria-label={t('charts.importAction')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5V19M5 12H19" />
            </svg>
          </Button>
        ) : null}
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
