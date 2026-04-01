import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { Badge } from './ui/badge'

export function ConnectionBadge() {
  const { t } = useTranslation()
  const connection = useAppStore((state) => state.connection)
  const connected = connection?.connected ?? false

  return (
    <Badge variant={connected ? 'default' : 'destructive'} className="connection-badge">
      <span className="connection-dot" />
      <span>{connected ? t('status.connected') : t('status.disconnected')}</span>
    </Badge>
  )
}
