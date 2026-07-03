import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'
import router from './router'
import i18n from '../../i18n'
import { getAppClient } from '../../client'
import '../../styles.css'

installExternalLinkInterceptor()

createApp(App).use(ElementPlus).use(router).use(i18n).mount('#app')

function installExternalLinkInterceptor(): void {
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return
      const anchor = (event.target as Element | null)?.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return

      try {
        const target = new URL(anchor.href, window.location.href)
        const external =
          ['http:', 'https:', 'mailto:', 'tel:'].includes(target.protocol) &&
          (window.location.protocol === 'file:' || target.origin !== window.location.origin)
        if (!external) return
        event.preventDefault()
        void getAppClient().openExternal(target.toString())
      } catch {
        // Browser navigation remains untouched for malformed or relative URLs.
      }
    },
    true
  )
}
