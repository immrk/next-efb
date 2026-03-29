import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'

export function ConnectionBadge() {
  const { t } = useTranslation()
  const connection = useAppStore((state) => state.connection)
  const connected = connection?.connected ?? false

  return (
    <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
      <span className="connection-dot" />
      <span>{connected ? t('status.connected') : t('status.disconnected')}</span>
    </div>
  )
}
