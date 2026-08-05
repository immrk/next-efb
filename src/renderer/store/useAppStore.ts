import { create } from 'zustand'
import type { AircraftState, AppLanguage, AppSettings, ConnectionState } from '@shared/types'
import { resolveAppLanguage } from '@shared/i18n'
import type { AppUpdateState } from '@shared/update-types'

interface AppStoreState {
  aircraft: AircraftState | null
  connection: ConnectionState | null
  settings: AppSettings | null
  appUpdate: AppUpdateState | null
  language: AppLanguage
  setAircraft: (aircraft: AircraftState) => void
  setConnection: (connection: ConnectionState) => void
  setSettings: (settings: AppSettings) => void
  setAppUpdate: (appUpdate: AppUpdateState) => void
  setLanguage: (language: AppLanguage) => void
}

export const useAppStore = create<AppStoreState>((set) => ({
  aircraft: null,
  connection: null,
  settings: null,
  appUpdate: null,
  language: resolveSystemLanguage(),
  setAircraft: (aircraft) => set({ aircraft }),
  setConnection: (connection) => set({ connection }),
  setSettings: (settings) => set({ settings, language: settings.language }),
  setAppUpdate: (appUpdate) => set({ appUpdate }),
  setLanguage: (language) =>
    set((state) => ({
      language,
      settings: state.settings ? { ...state.settings, language } : state.settings
    }))
}))

function resolveSystemLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') {
    return 'en-US'
  }

  return resolveAppLanguage(navigator.languages?.length ? navigator.languages : navigator.language)
}
