import { useEffect, useState } from 'react'
import type { NavMapLayerVisibility } from '@shared/nav-map-types'

const STORAGE_KEY = 'nextefb.map-display.v1'

export const DEFAULT_NAV_LAYER_VISIBILITY: NavMapLayerVisibility = {
  airports: true,
  waypoints: false,
  vors: false,
  ndbs: false,
  airways: false
}

export function usePersistentMapDisplaySettings() {
  const [navLayerVisibility, setNavLayerVisibility] = useState<NavMapLayerVisibility>(() =>
    readStoredNavLayerVisibility()
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(navLayerVisibility))
  }, [navLayerVisibility])

  const toggleNavLayer = (key: keyof NavMapLayerVisibility) => {
    setNavLayerVisibility((current) => ({
      ...current,
      [key]: !current[key]
    }))
  }

  return {
    navLayerVisibility,
    setNavLayerVisibility,
    toggleNavLayer
  }
}

function readStoredNavLayerVisibility(): NavMapLayerVisibility {
  if (typeof window === 'undefined') {
    return DEFAULT_NAV_LAYER_VISIBILITY
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_NAV_LAYER_VISIBILITY
    }

    const parsed = JSON.parse(raw) as Partial<NavMapLayerVisibility>
    return {
      airports: parsed.airports ?? DEFAULT_NAV_LAYER_VISIBILITY.airports,
      waypoints: parsed.waypoints ?? DEFAULT_NAV_LAYER_VISIBILITY.waypoints,
      vors: parsed.vors ?? DEFAULT_NAV_LAYER_VISIBILITY.vors,
      ndbs: parsed.ndbs ?? DEFAULT_NAV_LAYER_VISIBILITY.ndbs,
      airways: parsed.airways ?? DEFAULT_NAV_LAYER_VISIBILITY.airways
    }
  } catch {
    return DEFAULT_NAV_LAYER_VISIBILITY
  }
}
