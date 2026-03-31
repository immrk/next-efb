import { useTranslation } from 'react-i18next'
import type { AppRoute } from '@shared/types'

interface AppSidebarProps {
  route: AppRoute
  collapsed: boolean
  onToggleCollapse: () => void
  onNavigate: (route: AppRoute) => void
}

function SidebarIcon({ kind }: { kind: 'map' | 'charts' | 'settings' | 'brand' | 'collapse' }) {
  if (kind === 'brand') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3L20 8V16L12 21L4 16V8L12 3Z" />
        <path d="M12 7V17M8 9L16 13M16 9L8 13" />
      </svg>
    )
  }

  if (kind === 'collapse') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6L9 12L15 18" />
      </svg>
    )
  }

  if (kind === 'map') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z" />
        <path d="M9 3V18M15 6V21" />
      </svg>
    )
  }

  if (kind === 'charts') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 8H16M8 12H16M8 16H12" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15A1 1 0 0 0 19.6 16.1L19.7 16.2A1 1 0 1 1 18.3 17.6L18.2 17.5A1 1 0 0 0 17.1 17.3A1 1 0 0 0 16.5 18.2V18.5A1 1 0 1 1 14.5 18.5V18.3A1 1 0 0 0 13.8 17.4A1 1 0 0 0 12.7 17.7L12.6 17.8A1 1 0 1 1 11.2 16.4L11.3 16.3A1 1 0 0 0 11.5 15.2A1 1 0 0 0 10.6 14.6H10.3A1 1 0 1 1 10.3 12.6H10.5A1 1 0 0 0 11.4 11.9A1 1 0 0 0 11.1 10.8L11 10.7A1 1 0 1 1 12.4 9.3L12.5 9.4A1 1 0 0 0 13.6 9.6A1 1 0 0 0 14.2 8.7V8.4A1 1 0 1 1 16.2 8.4V8.6A1 1 0 0 0 16.9 9.5A1 1 0 0 0 18 9.2L18.1 9.1A1 1 0 0 1 19.5 10.5L19.4 10.6A1 1 0 0 0 19.2 11.7A1 1 0 0 0 20.1 12.3H20.4A1 1 0 1 1 20.4 14.3H20.2A1 1 0 0 0 19.4 15Z" />
    </svg>
  )
}

export function AppSidebar({ route, collapsed, onToggleCollapse, onNavigate }: AppSidebarProps) {
  const { t } = useTranslation()

  const items: Array<{ key: AppRoute; label: string; icon: 'map' | 'charts' | 'settings' }> = [
    { key: 'map', label: t('nav.map'), icon: 'map' },
    { key: 'charts', label: t('nav.charts'), icon: 'charts' },
    { key: 'settings', label: t('nav.settings'), icon: 'settings' }
  ]

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-main">
          <span className="sidebar-brand-icon">
            <SidebarIcon kind="brand" />
          </span>
          <strong className="sidebar-brand-text">NextEFB</strong>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-link ${route === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-link-icon">
              <SidebarIcon kind={item.icon} />
            </span>
            <span className="sidebar-link-text">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          <span className={`sidebar-collapse-icon ${collapsed ? 'collapsed' : ''}`}>
            <SidebarIcon kind="collapse" />
          </span>
          <span className="sidebar-link-text">{collapsed ? '' : t('sidebar.collapse')}</span>
        </button>
      </div>
    </aside>
  )
}
