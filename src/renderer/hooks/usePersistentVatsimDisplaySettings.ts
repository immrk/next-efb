import { useEffect, useState } from 'react'
import type { VatsimMapLayerVisibility } from '@shared/vatsim-types'

const STORAGE_KEY = 'nextefb.vatsim-display.v1'

export const DEFAULT_VATSIM_LAYER_VISIBILITY: VatsimMapLayerVisibility = {
  pilots: true,
  controllers: true,
  controllerCoverage: false,
  atis: true,
  weather: true,
  labels: true
}

export function usePersistentVatsimDisplaySettings() {
  const [vatsimLayerVisibility, setVatsimLayerVisibility] = useState<VatsimMapLayerVisibility>(
    readStoredVisibility
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vatsimLayerVisibility))
  }, [vatsimLayerVisibility])

  const toggleVatsimLayer = (key: keyof VatsimMapLayerVisibility) => {
    setVatsimLayerVisibility((current) => ({
      ...current,
      [key]: !current[key]
    }))
  }

  return { vatsimLayerVisibility, setVatsimLayerVisibility, toggleVatsimLayer }
}

function readStoredVisibility(): VatsimMapLayerVisibility {
  if (typeof window === 'undefined') return DEFAULT_VATSIM_LAYER_VISIBILITY

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_VATSIM_LAYER_VISIBILITY
    const parsed = JSON.parse(raw) as Partial<VatsimMapLayerVisibility>
    return {
      pilots: parsed.pilots ?? DEFAULT_VATSIM_LAYER_VISIBILITY.pilots,
      controllers: parsed.controllers ?? DEFAULT_VATSIM_LAYER_VISIBILITY.controllers,
      controllerCoverage:
        parsed.controllerCoverage ?? DEFAULT_VATSIM_LAYER_VISIBILITY.controllerCoverage,
      atis: parsed.atis ?? DEFAULT_VATSIM_LAYER_VISIBILITY.atis,
      weather: parsed.weather ?? DEFAULT_VATSIM_LAYER_VISIBILITY.weather,
      labels: parsed.labels ?? DEFAULT_VATSIM_LAYER_VISIBILITY.labels
    }
  } catch {
    return DEFAULT_VATSIM_LAYER_VISIBILITY
  }
}
