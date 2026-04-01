import { create } from 'zustand'
import type { AircraftState, AppLanguage, AppSettings, ConnectionState } from '@shared/types'

interface AppStoreState {
  aircraft: AircraftState | null
  connection: ConnectionState | null
  settings: AppSettings | null
  language: AppLanguage
  setAircraft: (aircraft: AircraftState) => void
  setConnection: (connection: ConnectionState) => void
  setSettings: (settings: AppSettings) => void
  setLanguage: (language: AppLanguage) => void
}

export const useAppStore = create<AppStoreState>((set) => ({
  aircraft: null,
  connection: null,
  settings: null,
  language: resolveSystemLanguage(),
  setAircraft: (aircraft) => set({ aircraft }),
  setConnection: (connection) => set({ connection }),
  setSettings: (settings) => set({ settings, language: settings.language }),
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

  return navigator.language.trim().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}
