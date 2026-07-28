export function filterProceduresByRunway<T extends { runwayName: string | null }>(
  items: T[],
  selectedRunway: string
): T[] {
  return items.filter((item) => runwayMatches(item.runwayName, selectedRunway))
}

export function runwayMatches(optionRunway: string | null, selectedRunway: string): boolean {
  if (!selectedRunway) return true
  if (!optionRunway?.trim()) return true
  return optionRunway.trim().toUpperCase() === selectedRunway.trim().toUpperCase()
}

export function parseApproachProcedureId(value: string): number | null {
  if (!value.startsWith('approach:')) return null
  const rawId = value.slice('approach:'.length).trim()
  if (!rawId) return null
  const parsed = Number(rawId)
  return Number.isFinite(parsed) ? parsed : null
}
