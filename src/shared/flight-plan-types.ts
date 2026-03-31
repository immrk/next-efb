export interface NavDataStatus {
  defaultPath: string
  configuredPath: string | null
  activePath: string | null
  exists: boolean
  source: 'auto' | 'manual' | 'none'
  message: string
}

export interface NavAirportOption {
  ident: string
  name: string
  city: string | null
  country: string | null
  lat: number
  lon: number
}

export interface NavRunwayOption {
  name: string
  lengthM: number | null
  widthM: number | null
  surface: string | null
  headingDeg: number | null
}

export interface NavProcedureOption {
  id: string
  name: string
  procedureType: 'departure' | 'arrival' | 'approach'
  runwayName: string | null
}

export interface NavAirportProcedures {
  airport: NavAirportOption | null
  runways: NavRunwayOption[]
  departures: NavProcedureOption[]
  arrivals: NavProcedureOption[]
  approaches: NavProcedureOption[]
}

export interface FlightPlanPoint {
  ident: string
  lat: number
  lon: number
  source: 'airport' | 'waypoint' | 'vor' | 'ndb' | 'procedure' | 'manual'
}

export interface BuildFlightPlanInput {
  departureAirport: string
  destinationAirport: string
  enrouteText: string
  departureRunway: string | null
  arrivalRunway: string | null
  departureProcedureId: string | null
  arrivalProcedureId: string | null
  approachProcedureId: string | null
}

export interface BuildFlightPlanResult {
  points: FlightPlanPoint[]
  unresolvedTokens: string[]
  summary: string
}

export interface SimBriefImportInput {
  username?: string | null
  userId?: string | null
}

export interface SimBriefImportResult {
  departureAirport: string
  destinationAirport: string
  alternateAirport: string | null
  routeText: string
  source: 'simbrief'
}
