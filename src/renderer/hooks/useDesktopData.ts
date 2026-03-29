import { useEffect } from 'react'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'

export function useDesktopData(): void {
  const setAircraft = useAppStore((state) => state.setAircraft)
  const setConnection = useAppStore((state) => state.setConnection)
  const setSettings = useAppStore((state) => state.setSettings)

  useEffect(() => {
    void window.msfsApi.getSnapshot().then((snapshot) => {
      setAircraft(snapshot.aircraft)
      setConnection(snapshot.connection)
    })

    void window.msfsApi.getSettings().then((settings) => {
      setSettings(settings)
      void i18n.changeLanguage(settings.language)
    })

    const offAircraft = window.msfsApi.onAircraftUpdate(setAircraft)
    const offConnection = window.msfsApi.onConnectionUpdate(setConnection)

    return () => {
      offAircraft()
      offConnection()
    }
  }, [setAircraft, setConnection, setSettings])
}
