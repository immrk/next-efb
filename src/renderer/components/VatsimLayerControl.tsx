import { useEffect, useRef, useState } from 'react'
import { Layers3, Plane, Radio, RefreshCw, Tags, TowerControl } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { VatsimMapLayerVisibility, VatsimStatus } from '@shared/vatsim-types'
import { getAppClient } from '../client'
import { Button } from './ui/button'
import { Switch } from './ui/switch'

const LAYERS: Array<{
  key: keyof VatsimMapLayerVisibility
  labelKey: string
  icon: typeof Plane
}> = [
  { key: 'pilots', labelKey: 'vatsim.layers.pilots', icon: Plane },
  { key: 'controllers', labelKey: 'vatsim.layers.controllers', icon: TowerControl },
  { key: 'controllerCoverage', labelKey: 'vatsim.layers.coverage', icon: Layers3 },
  { key: 'atis', labelKey: 'vatsim.layers.atis', icon: Radio },
  { key: 'labels', labelKey: 'vatsim.layers.labels', icon: Tags }
]

export function VatsimLayerControl({
  layerVisibility,
  status,
  onToggleLayer,
  onStatusChange
}: {
  layerVisibility: VatsimMapLayerVisibility
  status: VatsimStatus
  onToggleLayer: (key: keyof VatsimMapLayerVisibility) => void
  onStatusChange: (status: VatsimStatus) => void
}) {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const enabled = layerVisibility.pilots
    || layerVisibility.controllers
    || layerVisibility.controllerCoverage
    || layerVisibility.atis

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      onStatusChange(await appClient.refreshVatsim())
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="vatsim-layer-control" ref={rootRef}>
      <Button
        type="button"
        variant={enabled ? 'default' : 'outline'}
        className="vatsim-live-button"
        aria-expanded={open}
        aria-label={t('vatsim.openLayers')}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`vatsim-status-dot is-${status.phase}`} aria-hidden="true" />
        <span>LIVE</span>
        {status.counts.connectedClients > 0 ? (
          <span className="vatsim-live-count">{status.counts.connectedClients.toLocaleString()}</span>
        ) : null}
      </Button>

      {open ? (
        <div className="vatsim-layer-popover">
          <div className="vatsim-layer-header">
            <div>
              <strong>{t('vatsim.title')}</strong>
              <span>{t(`vatsim.phase.${status.phase}`)}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="vatsim-refresh-button"
              aria-label={t('vatsim.refresh')}
              title={t('vatsim.refresh')}
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw className={refreshing ? 'is-spinning' : ''} />
            </Button>
          </div>
          <div className="vatsim-network-counts">
            <span>{t('vatsim.counts.pilots', { count: status.counts.pilots })}</span>
            <span>{t('vatsim.counts.controllers', { count: status.counts.controllers })}</span>
          </div>
          <div className="vatsim-layer-list">
            {LAYERS.map(({ key, labelKey, icon: Icon }) => (
              <label key={key} className="vatsim-layer-row">
                <span><Icon aria-hidden="true" />{t(labelKey)}</span>
                <Switch
                  checked={layerVisibility[key]}
                  onCheckedChange={() => onToggleLayer(key)}
                  aria-label={t(labelKey)}
                />
              </label>
            ))}
          </div>
          {status.lastError ? <p className="vatsim-layer-error">{status.lastError}</p> : null}
          <p className="vatsim-layer-footnote">{t('vatsim.zoomHint')}</p>
        </div>
      ) : null}
    </div>
  )
}
