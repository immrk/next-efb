import type {
  BuildFlightPlanInput,
  NavAirportProcedures,
  NavProcedureOption,
  NavRunwayOption,
  NavTransitionOption,
  SimBriefImportInput,
  SimBriefImportResult
} from '@shared/flight-plan-types'
import type { AppClient } from '../client/AppClient'
import { filterProceduresByRunway, parseApproachProcedureId, runwayMatches } from './navProcedures'

export const EMPTY_FLIGHT_PLAN_DRAFT: BuildFlightPlanInput = {
  departureAirport: '',
  destinationAirport: '',
  enrouteText: '',
  departureRunway: null,
  departureProcedureId: null,
  arrivalRunway: null,
  arrivalProcedureId: null,
  approachProcedureId: null,
  arrivalTransitionId: null
}

const EMPTY_PROCEDURES: NavAirportProcedures = {
  airport: null,
  runways: [],
  departures: [],
  arrivals: [],
  transitions: [],
  approaches: []
}

export interface ImportedSimBriefFlightPlan {
  draft: BuildFlightPlanInput
  source: SimBriefImportResult
}

export async function importSimBriefFlightPlan(
  appClient: AppClient,
  input: SimBriefImportInput
): Promise<ImportedSimBriefFlightPlan> {
  const result = await appClient.importSimBrief(input)
  const [departureProcedures, destinationProcedures] = await Promise.all([
    result.departureAirport
      ? appClient.getNavAirportProcedures(result.departureAirport)
      : Promise.resolve(EMPTY_PROCEDURES),
    result.destinationAirport
      ? appClient.getNavAirportProcedures(result.destinationAirport)
      : Promise.resolve(EMPTY_PROCEDURES)
  ])

  const departureRunway =
    matchRunwayOption(departureProcedures.runways, result.departureRunway)?.name ?? null
  const arrivalRunway =
    matchRunwayOption(destinationProcedures.runways, result.arrivalRunway)?.name ?? null
  const departureProcedure =
    matchProcedureOption(
      filterProceduresByRunway(departureProcedures.departures, departureRunway ?? ''),
      result.departureProcedureName,
      getRouteProcedureFallback(result.routeText, 'departure')
    ) ?? null
  const arrivalProcedure =
    matchProcedureOption(
      filterProceduresByRunway(destinationProcedures.arrivals, arrivalRunway ?? ''),
      result.arrivalProcedureName,
      getRouteProcedureFallback(result.routeText, 'arrival')
    ) ?? null
  const approachProcedureId =
    matchProcedureOption(
      filterProceduresByRunway(destinationProcedures.approaches, arrivalRunway ?? ''),
      result.approachProcedureName
    )?.id ?? null
  const arrivalTransitionId =
    matchTransitionOption(
      destinationProcedures.transitions,
      result.arrivalTransitionName,
      approachProcedureId,
      arrivalRunway
    )?.id ?? null

  return {
    source: result,
    draft: {
      departureAirport: result.departureAirport,
      destinationAirport: result.destinationAirport,
      enrouteText: stripMatchedProceduresFromRouteText(
        result.routeText,
        departureProcedure,
        arrivalProcedure
      ),
      departureRunway,
      departureProcedureId: departureProcedure?.id ?? null,
      arrivalRunway,
      arrivalProcedureId: arrivalProcedure?.id ?? null,
      approachProcedureId,
      arrivalTransitionId
    }
  }
}

export function buildFlightPlanDraftSignature(draft: BuildFlightPlanInput): string {
  return [
    draft.departureAirport.trim().toUpperCase(),
    draft.destinationAirport.trim().toUpperCase(),
    draft.enrouteText.trim().toUpperCase(),
    draft.departureRunway ?? '',
    draft.departureProcedureId ?? '',
    draft.arrivalRunway ?? '',
    draft.arrivalProcedureId ?? '',
    draft.approachProcedureId ?? '',
    draft.arrivalTransitionId ?? ''
  ].join('|')
}

function matchRunwayOption(
  runways: NavRunwayOption[],
  importedRunway: string | null
): NavRunwayOption | null {
  const normalizedImported = normalizeRunwayToken(importedRunway)
  if (!normalizedImported) {
    return null
  }

  return (
    runways.find(
      (runway) =>
        normalizeRunwayToken(runway.name) === normalizedImported ||
        normalizeRunwayToken(runway.displayName) === normalizedImported
    ) ?? null
  )
}

function matchProcedureOption(
  procedures: NavProcedureOption[],
  importedName: string | null,
  fallbackName?: string | null
): NavProcedureOption | null {
  const candidates = [importedName, fallbackName]
    .map(normalizeProcedureToken)
    .filter(Boolean) as string[]
  if (!candidates.length) {
    return null
  }

  for (const candidate of candidates) {
    const exact = procedures.find((procedure) => procedureOptionMatches(procedure, candidate))
    if (exact) {
      return exact
    }
  }

  for (const candidate of candidates) {
    const fuzzy = procedures.find((procedure) => procedureOptionFuzzyMatches(procedure, candidate))
    if (fuzzy) {
      return fuzzy
    }
  }

  return null
}

function stripMatchedProceduresFromRouteText(
  routeText: string,
  departureProcedure: NavProcedureOption | null,
  arrivalProcedure: NavProcedureOption | null
): string {
  const tokens = routeText
    .split(/\s+/u)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)

  if (!tokens.length) {
    return ''
  }

  const cleanedTokens = [...tokens]
  const firstToken = cleanedTokens[0]

  if (
    departureProcedure &&
    firstToken &&
    (procedureOptionMatches(departureProcedure, normalizeProcedureToken(firstToken)) ||
      procedureOptionFuzzyMatches(departureProcedure, normalizeProcedureToken(firstToken)))
  ) {
    cleanedTokens.shift()
  }

  const lastToken = cleanedTokens[cleanedTokens.length - 1]
  if (
    arrivalProcedure &&
    lastToken &&
    (procedureOptionMatches(arrivalProcedure, normalizeProcedureToken(lastToken)) ||
      procedureOptionFuzzyMatches(arrivalProcedure, normalizeProcedureToken(lastToken)))
  ) {
    cleanedTokens.pop()
  }

  return cleanedTokens.join(' ')
}

function matchTransitionOption(
  transitions: NavTransitionOption[],
  importedName: string | null,
  approachProcedureId: string | null,
  arrivalRunway: string | null
): NavTransitionOption | null {
  const normalizedImported = normalizeProcedureToken(importedName)
  if (!normalizedImported || !approachProcedureId) {
    return null
  }

  const parsedApproachId = parseApproachProcedureId(approachProcedureId)
  if (!parsedApproachId) {
    return null
  }

  const filtered = transitions.filter(
    (transition) =>
      transition.approachId === parsedApproachId &&
      runwayMatches(transition.runwayName, arrivalRunway ?? '')
  )

  return (
    filtered.find((transition) => procedureNameMatches(transition.name, normalizedImported)) ??
    filtered.find((transition) => procedureNameFuzzyMatches(transition.name, normalizedImported)) ??
    null
  )
}

function getRouteProcedureFallback(
  routeText: string,
  phase: 'departure' | 'arrival'
): string | null {
  const candidates = routeText
    .split(/\s+/u)
    .map((token) => normalizeProcedureToken(token))
    .filter((token): token is string => Boolean(token))
    .filter((token) => token !== 'DCT' && token !== 'DIRECT')
    .filter(isProcedureLikeToken)

  if (!candidates.length) {
    return null
  }

  return phase === 'departure'
    ? candidates[0] ?? null
    : candidates[candidates.length - 1] ?? null
}

function normalizeRunwayToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^RUNWAY\s*/u, '')
    .replace(/^RWY\s*/u, '')
    .replace(/\s+/gu, '')
}

function normalizeProcedureToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/gu, '')
    .replace(/[-/.]/gu, '')
}

function procedureNameMatches(procedureName: string, candidate: string): boolean {
  return normalizeProcedureToken(procedureName) === candidate
}

function procedureNameFuzzyMatches(procedureName: string, candidate: string): boolean {
  const normalizedProcedure = normalizeProcedureToken(procedureName)
  return normalizedProcedure.includes(candidate) || candidate.includes(normalizedProcedure)
}

function procedureOptionMatches(procedure: NavProcedureOption, candidate: string): boolean {
  return getProcedureMatchTokens(procedure).some((token) => token === candidate)
}

function procedureOptionFuzzyMatches(procedure: NavProcedureOption, candidate: string): boolean {
  return getProcedureMatchTokens(procedure).some(
    (token) => token.includes(candidate) || candidate.includes(token)
  )
}

function getProcedureMatchTokens(procedure: NavProcedureOption): string[] {
  const normalizedName = normalizeProcedureToken(procedure.name)
  const candidates = new Set<string>()

  if (normalizedName) {
    candidates.add(normalizedName)
  }

  if (procedure.procedureType === 'arrival' || procedure.procedureType === 'departure') {
    const suffix = procedure.procedureType === 'arrival' ? 'A' : 'D'
    if (normalizedName && !normalizedName.endsWith(suffix)) {
      candidates.add(`${normalizedName}${suffix}`)
    }

    const truncatedAlias = buildTruncatedProcedureAlias(normalizedName, suffix)
    if (truncatedAlias) {
      candidates.add(truncatedAlias)
    }
  }

  return Array.from(candidates)
}

function buildTruncatedProcedureAlias(
  procedureName: string,
  suffix: 'A' | 'D'
): string | null {
  if (!procedureName) {
    return null
  }

  const withoutSuffix = procedureName.endsWith(suffix)
    ? procedureName.slice(0, -1)
    : procedureName
  const match = withoutSuffix.match(/^([A-Z]{5})(\d{1,2})$/u)
  if (!match) {
    return null
  }

  const [, fixPrefix, variant] = match
  return `${fixPrefix.slice(0, 4)}${variant}${suffix}`
}

function isProcedureLikeToken(token: string): boolean {
  if (token.length < 4) return false
  if (!/[0-9]/u.test(token)) return false
  if (
    /^(?:[A-Z]{1,3}\d+[A-Z]?|N\d+|Q\d+|T\d+|V\d+|J\d+|Y\d+|UL\d+|UM\d+|UY\d+|UT\d+)$/u.test(
      token
    )
  ) {
    return false
  }
  if (/^\d{4}[NS]\d{5}[EW]$/u.test(token)) {
    return false
  }
  if (/^[A-Z]{1,2}\d{1,3}$/u.test(token)) {
    return false
  }
  return /^[A-Z0-9]+$/u.test(token)
}
