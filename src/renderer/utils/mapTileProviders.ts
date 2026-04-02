import type { MapTileProvider } from '@shared/types'

export interface MapTileConfig {
  name: string
  url: string
  attribution: string
  subdomains?: string[]
}

export const MAP_TILE_CONFIGS: Record<MapTileProvider, MapTileConfig> = {
  osm: {
    name: 'OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  osmfr: {
    name: 'OpenStreetMap France',
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles style by OpenStreetMap France',
    subdomains: ['a', 'b', 'c']
  },
  cartoLight: {
    name: 'Carto Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: ['a', 'b', 'c', 'd']
  }
}

export function getMapTileConfig(provider: MapTileProvider | undefined): MapTileConfig {
  const config = provider ? (MAP_TILE_CONFIGS[provider] ?? MAP_TILE_CONFIGS.osm) : MAP_TILE_CONFIGS.osm
  const usesSubdomains = config.url.includes('{s}')

  if (!usesSubdomains) {
    return {
      ...config,
      subdomains: undefined
    }
  }

  return {
    ...config,
    subdomains: config.subdomains ?? ['a', 'b', 'c']
  }
}
