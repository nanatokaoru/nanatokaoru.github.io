import type { Router } from 'vue-router'

declare global {
  interface Window {
    umami?: {
      track: (payload?: string | ((props: Record<string, unknown>) => Record<string, unknown>)) => void
    }
  }
}

function loadScript(src: string, attrs: Record<string, string>) {
  if (document.querySelector(`script[src="${src}"]`)) return
  const el = document.createElement('script')
  el.src = src
  el.defer = true
  el.async = true
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value)
  }
  document.head.appendChild(el)
}

/**
 * Optional visit counting for a static host.
 * Set VITE_UMAMI_WEBSITE_ID + VITE_UMAMI_SCRIPT_URL, and/or VITE_CF_BEACON_TOKEN.
 * Without those env values this is a no-op.
 */
export function installAnalytics(router: Router) {
  const umamiId = String(import.meta.env.VITE_UMAMI_WEBSITE_ID ?? '').trim()
  const umamiSrc = String(import.meta.env.VITE_UMAMI_SCRIPT_URL ?? '').trim()
  const cfToken = String(import.meta.env.VITE_CF_BEACON_TOKEN ?? '').trim()

  // Local preview and dev should not count toward the public stats.
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

  if (umamiId && umamiSrc && !local) {
    loadScript(umamiSrc, {
      'data-website-id': umamiId,
      'data-auto-track': 'false',
    })
    router.afterEach((to) => {
      // Wait one frame so useDocumentTitle can update the tab name first.
      requestAnimationFrame(() => {
        window.umami?.track((props) => ({
          ...props,
          url: to.fullPath,
          title: document.title,
        }))
      })
    })
  }

  if (cfToken) {
    loadScript('https://static.cloudflareinsights.com/beacon.min.js', {
      'data-cf-beacon': JSON.stringify({ token: cfToken }),
    })
  }
}
