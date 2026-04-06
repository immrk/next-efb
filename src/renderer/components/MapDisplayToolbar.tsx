import type { NavMapLayerVisibility } from '@shared/nav-map-types'
import type { MapTileProvider } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { getAppClient } from '../client'
import { useAppStore } from '../store/useAppStore'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select'

export function MapDisplayToolbar({
  className = 'map-floating-toolbar',
  navLayerVisibility,
  onToggleLayer
}: {
  className?: string
  navLayerVisibility: NavMapLayerVisibility
  onToggleLayer: (key: keyof NavMapLayerVisibility) => void
}) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)

  const updateMapTileProvider = async (mapTileProvider: MapTileProvider): Promise<void> => {
    const nextSettings = await appClient.updateSettings({ mapTileProvider })
    setSettings(nextSettings)
  }

  return (
    <div className={className}>
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
