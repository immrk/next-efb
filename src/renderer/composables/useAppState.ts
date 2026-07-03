import { readonly, ref } from 'vue'
import type { AircraftState, AppSettings, ConnectionState } from '@shared/types'
import { getAppClient } from '../client'

const aircraft = ref<AircraftState | null>(null)
const connection = ref<ConnectionState | null>(null)
const settings = ref<AppSettings | null>(null)
const loading = ref(false)
const initialized = ref(false)
let cleanup: (() => void) | null = null

export function useAppState() {
  async function initialize(): Promise<void> {
    if (initialized.value || loading.value) return
    loading.value = true
    const client = getAppClient()
    try {
      const [snapshot, appSettings] = await Promise.all([client.getSnapshot(), client.getSettings()])
      aircraft.value = snapshot.aircraft
      connection.value = snapshot.connection
      settings.value = appSettings
      const offAircraft = client.onAircraftUpdate((value) => (aircraft.value = value))
      const offConnection = client.onConnectionUpdate((value) => (connection.value = value))
      const offSettings = client.onSettingsChanged(() => {
        void client.getSettings().then((value) => (settings.value = value))
      })
      cleanup = () => {
        offAircraft()
        offConnection()
        offSettings()
      }
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  function setSettings(value: AppSettings): void {
    settings.value = value
  }

  return {
    aircraft: readonly(aircraft),
    connection: readonly(connection),
    settings: readonly(settings),
    loading: readonly(loading),
    initialize,
    setSettings,
    dispose: () => cleanup?.()
  }
}
