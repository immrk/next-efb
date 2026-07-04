import { getAppClient } from './client'

export function installRendererRuntime(): void {
  installExternalLinkInterceptor()
  installViewportMetrics()
}

function installExternalLinkInterceptor(): void {
  const openExternal = (url: string) => {
    void getAppClient().openExternal(url)
  }

  const intercept = (event: MouseEvent) => {
    if (event.defaultPrevented || (event.button !== 0 && event.button !== 1)) return
    const anchor = (event.target as Element | null)?.closest('a[href]')
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return
    if (!isExternalLink(anchor.href)) return
    event.preventDefault()
    openExternal(anchor.href)
  }

  document.addEventListener('click', intercept, true)
  document.addEventListener('auxclick', intercept, true)
}

function installViewportMetrics(): void {
  const root = document.documentElement
  const syncViewportMetrics = () => {
    const viewport = window.visualViewport
    const viewportHeight = viewport?.height ?? window.innerHeight
    const viewportTopOffset = viewport?.offsetTop ?? 0
    const viewportBottomOffset = Math.max(0, window.innerHeight - viewportHeight - viewportTopOffset)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      ('standalone' in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))

    root.style.setProperty('--app-viewport-height', `${viewportHeight}px`)
    root.style.setProperty('--app-viewport-offset-top', `${viewportTopOffset}px`)
    root.style.setProperty('--app-viewport-offset-bottom', `${viewportBottomOffset}px`)
    root.style.setProperty('--app-webapp-safe-area-top', standalone ? `${viewportTopOffset}px` : '0px')
    root.dataset.webappMode = standalone ? 'standalone' : 'browser'
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
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(target.protocol)) return false
    return window.location.protocol === 'file:'
      ? target.protocol !== 'file:'
      : target.origin !== window.location.origin
  } catch {
    return false
  }
}
