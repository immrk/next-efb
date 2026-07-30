import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  FileText,
  PlaneTakeoff
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  SimBriefFlightDetails,
  SimBriefImportResult
} from '@shared/flight-plan-types'
import { FlightPlanCommands } from '../components/FlightPlanCommands'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle
} from '../components/ui/card'
import { toast } from '../components/ui/use-toast'

interface FlightPageProps {
  simBriefPlan: SimBriefImportResult | null
  isImporting: boolean
  navDataReady: boolean
  onImport: () => Promise<void> | void
  onClear: () => void
}

interface FlightMetric {
  label: string
  value: ReactNode
}

type WeightUnit = 'kg' | 'lb'

export function FlightPage({
  simBriefPlan,
  isImporting,
  navDataReady,
  onImport,
  onClear
}: FlightPageProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const details = simBriefPlan?.details ?? null
  const importedWeightUnit = normalizeWeightUnit(details?.units ?? null) ?? 'kg'
  const [loadSheetUnit, setLoadSheetUnit] =
    useState<WeightUnit>(importedWeightUnit)
  const completeRoute = useMemo(
    () => (simBriefPlan ? buildCompleteRoute(simBriefPlan) : ''),
    [simBriefPlan]
  )

  useEffect(() => {
    setLoadSheetUnit(importedWeightUnit)
  }, [importedWeightUnit, simBriefPlan])

  return (
    <section className="flight-page" aria-label={t('flight.pageTitle')}>
      <header className="flight-page-toolbar">
        <div className="flight-page-heading">
          <div className="flight-page-title-row">
            <h1>{t('flight.pageTitle')}</h1>
            {simBriefPlan ? (
              <Badge variant="secondary" className="flight-source-badge">
                <Check className="size-3" />
                SimBrief
              </Badge>
            ) : null}
          </div>
        </div>
        <FlightPlanCommands
          isImporting={isImporting}
          importDisabled={!navDataReady}
          onImport={onImport}
          onClear={onClear}
        />
      </header>

      <div className="flight-page-content">
        {!simBriefPlan || !details ? (
          <Card className="flight-empty-card">
            <PlaneTakeoff aria-hidden="true" />
            <strong>{t('flight.emptyTitle')}</strong>
            <p>{t('flight.emptyDescription')}</p>
          </Card>
        ) : (
          <>
            <SnapshotCard title={t('flight.infoTitle')} collapsible={false}>
              <MetricGrid
                items={[
                  metric(t('flight.flightNumber'), details.flightNumber),
                  metric(t('flight.callsign'), details.callsign ?? details.flightNumber),
                  metric(
                    t('flight.departure'),
                    formatAirport(
                      simBriefPlan.departureAirport,
                      details.departureIata,
                      simBriefPlan.departureRunway
                    )
                  ),
                  metric(
                    t('flight.arrival'),
                    formatAirport(
                      simBriefPlan.destinationAirport,
                      details.destinationIata,
                      simBriefPlan.arrivalRunway
                    )
                  ),
                  metric(
                    t('flight.alternate'),
                    formatAirport(
                      simBriefPlan.alternateAirport,
                      details.alternateIata,
                      null
                    )
                  ),
                  metric(
                    t('flight.aircraft'),
                    joinValues(details.aircraftType, details.aircraftName)
                  ),
                  metric(
                    t('flight.departureDate'),
                    formatTimestamp(details.scheduledOut, locale, 'date')
                  ),
                  metric(
                    t('flight.departureTime'),
                    formatTimestamp(details.scheduledOff ?? details.scheduledOut, locale, 'time')
                  ),
                  metric(
                    t('flight.arrivalTime'),
                    formatTimestamp(details.scheduledOn ?? details.scheduledIn, locale, 'time')
                  ),
                  metric(t('flight.airTime'), formatDuration(details.airTimeSeconds)),
                  metric(t('flight.blockTime'), formatDuration(details.blockTimeSeconds)),
                  metric(t('flight.airframe'), details.registration)
                ]}
              />
            </SnapshotCard>

            <SnapshotCard title={t('flight.summaryTitle')} collapsible={false}>
              <MetricGrid
                items={[
                  metric(
                    t('flight.initialAltitude'),
                    formatNumberWithUnit(details.initialAltitude, 'ft')
                  ),
                  metric(
                    t('flight.cruiseProfile'),
                    formatCruiseProfile(details.cruiseProfile, details.costIndex)
                  ),
                  metric(
                    t('flight.routeDistance'),
                    formatNumberWithUnit(details.routeDistance, 'nm')
                  ),
                  metric(
                    t('flight.averageWind'),
                    formatWind(details.averageWindDirection, details.averageWindSpeed)
                  ),
                  metric(t('flight.windComponent'), formatSignedCode(details.windComponent)),
                  metric(t('flight.isaDeviation'), formatSignedCode(details.isaDeviation, true)),
                  metric(t('flight.releaseNumber'), details.releaseNumber),
                  metric(t('flight.airacCycle'), details.airacCycle),
                  metric(t('flight.ofpLayout'), details.ofpLayout),
                  metric(t('flight.units'), normalizeUnits(details.units)),
                  metric(t('flight.navlog'), formatBoolean(details.navlog, t)),
                  metric(t('flight.etops'), formatBoolean(details.etops, t))
                ]}
              />
            </SnapshotCard>

            {hasLoadSheetData(details) ? (
              <SnapshotCard
                title={t('flight.loadSheetTitle')}
                titleAccessory={
                  <div className="flight-load-sheet-units">
                    <span>{t('flight.allWeightsIn')}</span>
                    <div
                      className="flight-weight-unit-switch"
                      role="group"
                      aria-label={t('flight.weightUnitSwitch')}
                    >
                      {(['kg', 'lb'] as const).map((unit) => (
                        <button
                          type="button"
                          className="flight-weight-unit-button"
                          data-active={loadSheetUnit === unit}
                          aria-pressed={loadSheetUnit === unit}
                          aria-label={
                            unit === 'kg'
                              ? t('flight.showWeightsInKg')
                              : t('flight.showWeightsInLb')
                          }
                          onClick={() => setLoadSheetUnit(unit)}
                          key={unit}
                        >
                          {unit.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              >
                <MetricGrid
                  items={[
                    metric(
                      t('flight.enrouteBurn'),
                      formatWeight(details.enrouteBurn, details.units, loadSheetUnit)
                    ),
                    metric(t('flight.passengerCount'), details.passengerCount),
                    metric(
                      t('flight.emptyWeight'),
                      formatWeight(details.emptyWeight, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.estimatedZfw'),
                      formatWeight(details.estimatedZfw, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.estimatedTow'),
                      formatWeight(details.estimatedTow, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.estimatedLandingWeight'),
                      formatWeight(
                        details.estimatedLandingWeight,
                        details.units,
                        loadSheetUnit
                      )
                    ),
                    metric(
                      t('flight.blockFuel'),
                      formatWeight(details.blockFuel, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.baggageWeight'),
                      formatWeight(details.baggageWeight, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.payloadWeight'),
                      formatWeight(details.payloadWeight, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.maxZfw'),
                      formatWeight(details.maxZfw, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.maxTow'),
                      formatWeight(details.maxTow, details.units, loadSheetUnit)
                    ),
                    metric(
                      t('flight.maxLandingWeight'),
                      formatWeight(details.maxLandingWeight, details.units, loadSheetUnit)
                    )
                  ]}
                />
              </SnapshotCard>
            ) : null}

            <TextSnapshotCard title={t('flight.routeTitle')} content={completeRoute} />

            {details.atcFlightPlan ? (
              <TextSnapshotCard
                title={t('flight.atcTitle')}
                content={details.atcFlightPlan}
              />
            ) : null}

            <TextSnapshotCard
              title={t('flight.briefingTitle')}
              titleAccessory={
                <a
                  className="flight-briefing-help"
                  href={buildBriefingGuideUrl(details.ofpLayout)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('flight.briefingHelp')}
                </a>
              }
              content={
                details.briefingText?.trim()
                  ? details.briefingText
                  : t('flight.briefingUnavailable')
              }
              large
            />
          </>
        )}
      </div>
    </section>
  )
}

function SnapshotCard({
  title,
  titleAccessory,
  collapsible = true,
  children
}: {
  title: string
  titleAccessory?: ReactNode
  collapsible?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  return (
    <Card className="flight-snapshot-card">
      <CardHeader className="flight-snapshot-card-header">
        <CardTitle className="flight-card-title">
          <span>{title}</span>
          {titleAccessory}
        </CardTitle>
        {collapsible ? (
          <CardAction>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="flight-card-toggle"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
            >
              {open ? t('flight.hideDetails') : t('flight.showDetails')}
              {open ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      {open ? <CardContent className="flight-snapshot-card-content">{children}</CardContent> : null}
    </Card>
  )
}

function TextSnapshotCard({
  title,
  titleAccessory,
  content,
  large = false
}: {
  title: string
  titleAccessory?: ReactNode
  content: string
  large?: boolean
}) {
  const { t } = useTranslation()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success(t('flight.copied'))
    } catch {
      toast.error(t('feedback.failed'))
    }
  }

  return (
    <SnapshotCard title={title} titleAccessory={titleAccessory}>
      <div className={`flight-text-snapshot ${large ? 'is-large is-briefing' : ''}`}>
        {!large ? <FileText aria-hidden="true" /> : null}
        <pre tabIndex={0} aria-label={large ? t('flight.briefingTitle') : title}>
          {content}
        </pre>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flight-copy-button"
          onClick={() => void copy()}
        >
          <Clipboard className="size-4" />
          {t('flight.copy')}
        </Button>
      </div>
    </SnapshotCard>
  )
}

function MetricGrid({ items }: { items: FlightMetric[] }) {
  return (
    <dl className="flight-metric-grid">
      {items.map((item) => (
        <div className="flight-metric" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function metric(label: string, value: ReactNode): FlightMetric {
  return { label, value: value || '—' }
}

function buildCompleteRoute(plan: SimBriefImportResult): string {
  return [
    formatAirportRouteToken(plan.departureAirport, plan.departureRunway),
    plan.routeText,
    formatAirportRouteToken(plan.destinationAirport, plan.arrivalRunway)
  ]
    .filter(Boolean)
    .join(' ')
}

function formatAirportRouteToken(airport: string | null, runway: string | null): string {
  if (!airport) return ''
  return runway ? `${airport}/${runway}` : airport
}

function formatAirport(
  icao: string | null,
  iata: string | null,
  runway: string | null
): string | null {
  if (!icao) return null
  const codes = iata ? `${icao} / ${iata}` : icao
  return runway ? `${codes} · ${runway}` : codes
}

function formatTimestamp(
  value: string | null,
  locale: string,
  kind: 'date' | 'time'
): string | null {
  if (!value) return null
  const numeric = Number(value)
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value

  if (kind === 'date') {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC'
    }).format(date)
  }

  return `${new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC'
  }).format(date)} UTC`
}

function formatDuration(value: string | null): string | null {
  if (!value) return null
  const seconds = Number(value)
  if (!Number.isFinite(seconds)) return value
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatNumberWithUnit(value: string | null, unit: string): string | null {
  if (!value) return null
  const numeric = Number(value)
  const formatted = Number.isFinite(numeric) ? numeric.toLocaleString('en-US') : value
  return unit ? `${formatted} ${unit}` : formatted
}

function formatWeight(
  value: string | null,
  sourceUnits: string | null,
  targetUnit: WeightUnit
): string | null {
  if (!value) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return `${value} ${targetUnit}`
  }

  const sourceUnit = normalizeWeightUnit(sourceUnits) ?? targetUnit
  const converted =
    sourceUnit === targetUnit
      ? numeric
      : sourceUnit === 'kg'
        ? numeric * 2.2046226218
        : numeric / 2.2046226218

  return `${Math.round(converted).toLocaleString('en-US')} ${targetUnit}`
}

function normalizeUnits(units: string | null): string | null {
  if (!units) return null
  const weightUnit = normalizeWeightUnit(units)
  if (weightUnit) return weightUnit
  return units.toUpperCase()
}

function normalizeWeightUnit(units: string | null): WeightUnit | null {
  if (!units) return null
  const normalized = units.trim().toLowerCase()
  if (normalized === 'kg' || normalized === 'kgs' || normalized === 'kilograms') {
    return 'kg'
  }
  if (normalized === 'lb' || normalized === 'lbs' || normalized === 'pounds') {
    return 'lb'
  }
  return null
}

function buildBriefingGuideUrl(layout: string | null): string {
  const format = layout?.trim().toLowerCase()
  const query = format ? `?ofpformat=${encodeURIComponent(format)}` : ''
  return `https://www.simbrief.com/system/guide.php${query}#ofpsample`
}

function formatWind(direction: string | null, speed: string | null): string | null {
  if (!direction && !speed) return null
  const directionText = direction
    ? `${String(direction).padStart(3, '0')}°`
    : '—'
  return `${directionText} / ${speed ?? '—'} kt`
}

function formatCruiseProfile(profile: string | null, costIndex: string | null): string | null {
  const normalizedProfile = profile?.trim() ?? ''
  const costIndexLabel = costIndex?.trim() ? `CI ${costIndex.trim()}` : ''

  if (!normalizedProfile) {
    return costIndexLabel || null
  }

  if (
    !costIndexLabel ||
    normalizedProfile.replace(/\s+/gu, '').toUpperCase().includes(
      costIndexLabel.replace(/\s+/gu, '').toUpperCase()
    )
  ) {
    return normalizedProfile
  }

  return joinValues(normalizedProfile, costIndexLabel)
}

function formatSignedCode(value: string | null, positivePrefix = false): string | null {
  if (!value) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  if (numeric < 0) return `M${String(Math.abs(numeric)).padStart(3, '0')}`
  if (positivePrefix) return `P${String(numeric).padStart(2, '0')}`
  return `P${String(numeric).padStart(3, '0')}`
}

function formatBoolean(
  value: string | null,
  t: (key: string) => string
): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return t('common.yes')
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return t('common.no')
  return value
}

function joinValues(...values: Array<string | null | undefined>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value?.trim()))
  return filtered.length ? filtered.join(' · ') : null
}

function hasLoadSheetData(details: SimBriefFlightDetails): boolean {
  return [
    details.enrouteBurn,
    details.passengerCount,
    details.emptyWeight,
    details.estimatedZfw,
    details.estimatedTow,
    details.estimatedLandingWeight,
    details.blockFuel,
    details.baggageWeight,
    details.payloadWeight,
    details.maxZfw,
    details.maxTow,
    details.maxLandingWeight
  ].some(Boolean)
}
