import { useTranslation } from 'react-i18next'
import type { AppRoute } from '@shared/types'

interface AppSidebarProps {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
}

export function AppSidebar({ route, onNavigate }: AppSidebarProps) {
  const { t } = useTranslation()

  const items: Array<{ key: AppRoute; label: string }> = [
    { key: 'map', label: t('nav.map') },
    { key: 'charts', label: t('nav.charts') },
    { key: 'settings', label: t('nav.settings') }
  ]

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <p className="eyebrow">{t('app.eyebrow')}</p>
        <strong>{t('app.title')}</strong>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-link ${route === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
