import { useTranslation } from 'react-i18next'
import type { AppRoute } from '@shared/types'
import { Button } from './ui/button'

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
      <path d="M19 12a7 7 0 0 0-.05-.82l2.02-1.57-1.99-3.45-2.42.82a7 7 0 0 0-1.42-.82L14.7 4h-3.4l-.44 2.16a7 7 0 0 0-1.42.82l-2.42-.82-1.99 3.45 2.02 1.57A7 7 0 0 0 7 12a7 7 0 0 0 .05.82l-2.02 1.57 1.99 3.45 2.42-.82a7 7 0 0 0 1.42.82L11.3 20h3.4l.44-2.16a7 7 0 0 0 1.42-.82l2.42.82 1.99-3.45-2.02-1.57c.03-.27.05-.54.05-.82Z" />
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
          <Button
            key={item.key}
            type="button"
            variant={route === item.key ? 'default' : 'ghost'}
            className={`sidebar-link ${route === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-link-icon">
              <SidebarIcon kind={item.icon} />
            </span>
            <span className="sidebar-link-text">{item.label}</span>
          </Button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Button
          type="button"
          variant="secondary"
          className="sidebar-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          <span className={`sidebar-collapse-icon ${collapsed ? 'collapsed' : ''}`}>
            <SidebarIcon kind="collapse" />
          </span>
          <span className="sidebar-link-text">{collapsed ? '' : t('sidebar.collapse')}</span>
        </Button>
      </div>
    </aside>
  )
}
