import type { ChartRecord, ChartType } from '@shared/chart-types'
import type { FlightPlanSelection, NavAirportProcedures, NavProcedureOption } from '@shared/flight-plan-types'

export type ProcedureKind = 'departure' | 'arrival' | 'approach'
export type ProcedureCardState = 'active' | 'missing-chart' | 'missing-georef'

export interface ProcedureMountCard {
  id: string
  kind: 'procedure'
  procedureKind: ProcedureKind
  airportCode: string
  procedureId: string
  procedureName: string
  chartType: ChartType
  chartId: string | null
  chartTitle: string | null
  state: ProcedureCardState
}

export interface ManualMountCard {
  id: string
  kind: 'manual'
  chart: ChartRecord
}

export type DockCard = ProcedureMountCard | ManualMountCard

export interface ProcedureNavContext {
  departure: NavAirportProcedures | null
  destination: NavAirportProcedures | null
}

export function buildProcedureMountCards(
  charts: ChartRecord[],
  selection: FlightPlanSelection | null,
  navContext: ProcedureNavContext
): ProcedureMountCard[] {
  if (!selection) return []

  const procedureSpecs: Array<{
    kind: ProcedureKind
    airportCode: string
    procedure: NavProcedureOption | null
  }> = [
    {
      kind: 'departure',
      airportCode: selection.departureAirport,
      procedure: resolveProcedure(navContext.departure, 'departures', selection.departureProcedureId)
    },
    {
      kind: 'arrival',
      airportCode: selection.destinationAirport,
      procedure: resolveProcedure(navContext.destination, 'arrivals', selection.arrivalProcedureId)
    },
    {
      kind: 'approach',
      airportCode: selection.destinationAirport,
      procedure: resolveProcedure(navContext.destination, 'approaches', selection.approachProcedureId)
    }
  ]

  const cards: ProcedureMountCard[] = []

  for (const { kind, airportCode, procedure } of procedureSpecs) {
    if (!airportCode || !procedure) continue

    const chartType = getChartTypeByProcedureKind(kind)
    const exactMatches = charts.filter((chart) => {
      if (!sameAirport(chart.airportCode, airportCode) || chart.chartType !== chartType) {
        return false
      }

      if (chart.boundApproachProcedureIds.includes(procedure.id)) {
        return true
      }

      return normalize(chart.title) === normalize(procedure.name)
    })

    const bestMatch = pickBestChart(exactMatches)

    cards.push(
      bestMatch
        ? {
            id: `procedure:${kind}:${procedure.id}`,
            kind: 'procedure',
            procedureKind: kind,
            airportCode,
            procedureId: procedure.id,
            procedureName: procedure.name,
            chartType,
            chartId: bestMatch.id,
            chartTitle: bestMatch.title,
            state: bestMatch.isGeoreferenced ? 'active' : 'missing-georef'
          }
        : {
            id: `procedure:${kind}:${procedure.id}`,
            kind: 'procedure',
            procedureKind: kind,
            airportCode,
            procedureId: procedure.id,
            procedureName: procedure.name,
            chartType,
            chartId: null,
            chartTitle: null,
            state: 'missing-chart'
          }
    )
  }

  return cards
}

export function buildManualMountCards(charts: ChartRecord[], excludedChartIds: Set<string>): ManualMountCard[] {
  return charts
    .filter((chart) => chart.isGeoreferenced && !excludedChartIds.has(chart.id))
    .map((chart) => ({
      id: `manual:${chart.id}`,
      kind: 'manual' as const,
      chart
    }))
}

function resolveProcedure(
  procedures: NavAirportProcedures | null,
  key: 'departures' | 'arrivals' | 'approaches',
  selectedProcedureId: string | null
): NavProcedureOption | null {
  if (!procedures || !selectedProcedureId) return null
  return procedures[key].find((procedure) => procedure.id === selectedProcedureId) ?? null
}

function getChartTypeByProcedureKind(kind: ProcedureKind): ChartType {
  if (kind === 'departure') return 'sid'
  if (kind === 'arrival') return 'star'
  return 'approach'
}

function pickBestChart(charts: ChartRecord[]): ChartRecord | null {
  if (charts.length === 0) return null
  const georeferenced = charts.find((chart) => chart.isGeoreferenced)
  if (georeferenced) return georeferenced
  return [...charts].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
}

function sameAirport(left: string | null, right: string): boolean {
  if (!left?.trim()) return false
  return normalize(left) === normalize(right)
}

function normalize(value: string): string {
  return value.trim().toUpperCase()
}
