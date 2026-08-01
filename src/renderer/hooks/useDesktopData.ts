import { useEffect } from 'react'
import { getAppClient } from '../client'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'

export function useDesktopData(): void {
  const appClient = getAppClient()
  const setAircraft = useAppStore((state) => state.setAircraft)
  const setConnection = useAppStore((state) => state.setConnection)
  const setSettings = useAppStore((state) => state.setSettings)
  const setAppUpdate = useAppStore((state) => state.setAppUpdate)

  useEffect(() => {
    const refreshSettings = () => {
      void appClient.getSettings().then((settings) => {
        setSettings(settings)
        localStorage.setItem('locale', settings.language)
        void i18n.changeLanguage(settings.language)
      })
    }

    void appClient.getSnapshot().then((snapshot) => {
      setAircraft(snapshot.aircraft)
      setConnection(snapshot.connection)
    })

    refreshSettings()
    void appClient.getAppUpdateState().then(setAppUpdate)

    const offAircraft = appClient.onAircraftUpdate(setAircraft)
    const offConnection = appClient.onConnectionUpdate(setConnection)
    const offSettings = appClient.onSettingsChanged(refreshSettings)
    const offAppUpdate = appClient.onAppUpdateStateChange(setAppUpdate)

    return () => {
      offAircraft()
      offConnection()
      offSettings()
      offAppUpdate()
    }
  }, [appClient, setAircraft, setAppUpdate, setConnection, setSettings])
}
