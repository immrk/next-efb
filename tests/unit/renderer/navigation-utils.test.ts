import { describe, expect, it } from 'vitest'
import { cn } from '../../../src/renderer/lib/utils'
import {
  filterProceduresByRunway,
  parseApproachProcedureId,
  runwayMatches
} from '../../../src/renderer/utils/navProcedures'
import {
  getMapTileConfig,
  MAP_TILE_CONFIGS
} from '../../../src/renderer/utils/mapTileProviders'

describe('navigation and UI utilities', () => {
  it('matches runways case-insensitively and treats unbound procedures as universal', () => {
    expect(runwayMatches(' 36r ', '36R')).toBe(true)
    expect(runwayMatches(null, '36R')).toBe(true)
    expect(runwayMatches('', '36R')).toBe(true)
    expect(runwayMatches('18L', '')).toBe(true)
    expect(runwayMatches('18L', '36R')).toBe(false)

    expect(
      filterProceduresByRunway(
        [{ id: 1, runwayName: '36R' }, { id: 2, runwayName: null }],
        '36r'
      ).map((item) => item.id)
    ).toEqual([1, 2])
  })

  it('parses only finite, non-empty approach identifiers', () => {
    expect(parseApproachProcedureId('approach:42')).toBe(42)
    expect(parseApproachProcedureId('departure:42')).toBeNull()
    expect(parseApproachProcedureId('approach:abc')).toBeNull()
    expect(parseApproachProcedureId('approach:')).toBeNull()
  })

  it('returns tile provider configuration with correct subdomains and fallback', () => {
    expect(getMapTileConfig('osm')).toEqual({
      ...MAP_TILE_CONFIGS.osm,
      subdomains: undefined
    })
    expect(getMapTileConfig('osmHot').subdomains).toEqual(['a', 'b', 'c'])
    expect(getMapTileConfig('missing' as never).name).toBe('OpenStreetMap Standard')
    expect(getMapTileConfig(undefined).url).toBe(MAP_TILE_CONFIGS.osm.url)
  })

  it('merges conditional and conflicting Tailwind classes', () => {
    expect(cn('px-2', false && 'hidden', ['text-sm', 'px-4'])).toBe('text-sm px-4')
  })
})
