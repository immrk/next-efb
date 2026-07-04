import type {
  NavMapLayerVisibility,
  NavMapSearchResult,
  NavMapSearchType
} from '@shared/nav-map-types'
import type { MapTileProvider } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select'

export function MapDisplayToolbar({
  className = 'map-floating-toolbar',
  navLayerVisibility,
  onToggleLayer,
  onSearchSelect
}: {
  className?: string
  navLayerVisibility: NavMapLayerVisibility
  onToggleLayer: (key: keyof NavMapLayerVisibility) => void
  onSearchSelect?: (result: NavMapSearchResult) => void
}) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<NavMapSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const activeSearchTypes = useMemo<NavMapSearchType[]>(() => {
    const types: NavMapSearchType[] = []
    if (navLayerVisibility.airports) types.push('airports')
    if (navLayerVisibility.vors) types.push('vors')
    if (navLayerVisibility.ndbs) types.push('ndbs')
    if (navLayerVisibility.waypoints) types.push('waypoints')
    return types
  }, [navLayerVisibility])

  const updateMapTileProvider = async (mapTileProvider: MapTileProvider): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ mapTileProvider })
    setSettings(nextSettings)
  }

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    const query = search.trim()
    if (!query || activeSearchTypes.length === 0) {
      setResults([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      void appClient
        .searchNavMapPoints({
          query,
          types: activeSearchTypes
        })
        .then((nextResults) => {
          if (!active) return
          setResults(nextResults)
        })
        .catch(() => {
          if (!active) return
          setResults([])
        })
        .finally(() => {
          if (active) {
            setLoading(false)
          }
        })
    }, 180)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeSearchTypes, appClient, search])

  const placeholder =
    activeSearchTypes.length > 0
      ? t('map.searchPlaceholder', { defaultValue: 'Search active points' })
      : t('map.searchDisabledPlaceholder', { defaultValue: 'Enable APT/VOR/NDB/WPT' })

  return (
    <div className={className}>
      <div className="map-search-shell" ref={rootRef}>
        <Input
          className="map-search-input"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={activeSearchTypes.length === 0}
        />
        {isOpen && search.trim() && activeSearchTypes.length > 0 ? (
          <div className="map-search-panel">
            {loading ? (
              <div className="map-search-empty">
                {t('map.searchLoading', { defaultValue: 'Searching...' })}
              </div>
            ) : results.length > 0 ? (
              results.map((result) => (
                <Button
                  key={result.id}
                  type="button"
                  variant="ghost"
                  className="map-search-item"
                  onClick={() => {
                    setSearch(result.ident)
                    setIsOpen(false)
                    onSearchSelect?.(result)
                  }}
                >
                  <span className="map-search-item-main">
                    <strong>{result.ident}</strong>
                    {result.name ? <span>{result.name}</span> : null}
                  </span>
                  <span className="map-search-item-type">{getTypeLabel(result.type)}</span>
                </Button>
              ))
            ) : (
              <div className="map-search-empty">
                {t('map.searchNoResults', { defaultValue: 'No matching points' })}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <div className="map-nav-layer-group" role="group" aria-label="Navigation layers">
        <ToolbarLayerButton label="APT" active={navLayerVisibility.airports} onClick={() => onToggleLayer('airports')} />
        <ToolbarLayerButton label="AWY" active={navLayerVisibility.airways} onClick={() => onToggleLayer('airways')} />
        <ToolbarLayerButton label="VOR" active={navLayerVisibility.vors} onClick={() => onToggleLayer('vors')} />
        <ToolbarLayerButton label="NDB" active={navLayerVisibility.ndbs} onClick={() => onToggleLayer('ndbs')} />
        <ToolbarLayerButton label="WPT" active={navLayerVisibility.waypoints} onClick={() => onToggleLayer('waypoints')} />
      </div>
      <Select
        value={settings?.mapTileProvider ?? 'osm'}
        onValueChange={(value) => {
          void updateMapTileProvider(value as MapTileProvider)
        }}
      >
        <SelectTrigger
          className="map-provider-trigger map-provider-trigger-icon"
          aria-label={t('settings.mapTileProvider')}
          title={t('settings.mapTileProvider')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="map-provider-icon">
            <path d="M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z" />
            <path d="M9 3V18M15 6V21" />
          </svg>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="esriWorldStreet">{t('settings.mapTileProviderEsriWorldStreet')}</SelectItem>
          <SelectItem value="osm">{t('settings.mapTileProviderOsm')}</SelectItem>
          <SelectItem value="osmHot">{t('settings.mapTileProviderOsmHot')}</SelectItem>
          <SelectItem value="cartoLight">{t('settings.mapTileProviderCartoLight')}</SelectItem>
          <SelectItem value="cartoVoyager">{t('settings.mapTileProviderCartoVoyager')}</SelectItem>
          <SelectItem value="osmfr">{t('settings.mapTileProviderOsmFr')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  function getTypeLabel(type: NavMapSearchType): string {
    switch (type) {
      case 'airports':
        return 'APT'
      case 'vors':
        return 'VOR'
      case 'ndbs':
        return 'NDB'
      case 'waypoints':
      default:
        return 'WPT'
    }
  }
}

function ToolbarLayerButton({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      className="map-nav-layer-button"
      onClick={onClick}
    >
      {label}
    </Button>
  )
}
