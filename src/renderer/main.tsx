import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import { App } from './App'
import { getAppClient } from './client'
import { Toaster } from './components/ui/toaster'
import './styles.css'
import './i18n'

installExternalLinkInterceptor()
installViewportMetrics()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
)

function installExternalLinkInterceptor(): void {
  if (typeof document === 'undefined') {
    return
  }

  const openExternal = (url: string) => {
    void getAppClient().openExternal(url)
  }

  const interceptClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) {
      return
    }

    const anchor = (event.target as Element | null)?.closest('a[href]')
    if (!(anchor instanceof HTMLAnchorElement)) {
      return
    }

    if (anchor.hasAttribute('download')) {
      return
    }

    const href = anchor.href
    if (!isExternalLink(href)) {
      return
    }

    event.preventDefault()
    openExternal(href)
  }

  const interceptAuxClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 1) {
      return
    }

    const anchor = (event.target as Element | null)?.closest('a[href]')
    if (!(anchor instanceof HTMLAnchorElement)) {
      return
    }

    const href = anchor.href
    if (!isExternalLink(href)) {
      return
    }

    event.preventDefault()
    openExternal(href)
  }

  document.addEventListener('click', interceptClick, true)
  document.addEventListener('auxclick', interceptAuxClick, true)
}

function installViewportMetrics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const root = document.documentElement

  const syncViewportMetrics = () => {
    const viewport = window.visualViewport
    const viewportHeight = viewport?.height ?? window.innerHeight
    const viewportTopOffset = viewport?.offsetTop ?? 0
    const viewportBottomOffset = Math.max(
      0,
      window.innerHeight - viewportHeight - viewportTopOffset
    )
    const isStandaloneWebApp =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (typeof window.navigator !== 'undefined' && 'standalone' in window.navigator
        ? Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
        : false)

    root.style.setProperty('--app-viewport-height', `${viewportHeight}px`)
    root.style.setProperty('--app-viewport-offset-top', `${viewportTopOffset}px`)
    root.style.setProperty('--app-viewport-offset-bottom', `${viewportBottomOffset}px`)
    root.style.setProperty('--app-webapp-safe-area-top', isStandaloneWebApp ? `${viewportTopOffset}px` : '0px')
    root.dataset.webappMode = isStandaloneWebApp ? 'standalone' : 'browser'
  }

  syncViewportMetrics()
  window.addEventListener('resize', syncViewportMetrics, { passive: true })
  window.addEventListener('orientationchange', syncViewportMetrics, { passive: true })
  window.visualViewport?.addEventListener('resize', syncViewportMetrics, { passive: true })
  window.visualViewport?.addEventListener('scroll', syncViewportMetrics, { passive: true })
}

function isExternalLink(url: string): boolean {
  try {
    const target = new URL(url, window.location.href)
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(target.protocol)) {
      return false
    }

    if (window.location.protocol === 'file:') {
      return target.protocol !== 'file:'
    }

    return target.origin !== window.location.origin
  } catch {
    return false
  }
}
