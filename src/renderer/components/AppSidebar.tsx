import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@shared/branding'
import type { AppRoute } from '@shared/types'
import { BRAND_ICON_URL } from '../branding'
import { SafeAreaTopInset } from './SafeAreaTopInset'
import { SettingsIcon } from './icons/SettingsIcon'
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
      <img src={BRAND_ICON_URL} alt="" />
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
    <SettingsIcon />
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
      <SafeAreaTopInset className="sidebar-safe-area-top" />

      <div className="sidebar-brand">
        <div className="sidebar-brand-main">
          <span className="sidebar-brand-icon">
            <SidebarIcon kind="brand" />
          </span>
          <strong className="sidebar-brand-text">{APP_NAME}</strong>
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
