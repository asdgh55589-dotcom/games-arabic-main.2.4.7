'use client'

import { useEffect } from 'react'
import { useSettings } from '@/contexts/settings-context'

/**
 * Handles global dynamic meta that generateMetadata can't cover:
 * - Google Analytics injection
 * - theme-color meta tag
 * - twitter:site handle
 *
 * Route-level title/description/OG are handled by generateMetadata in each page.
 */
export function SeoUpdater() {
  const { settings, loading } = useSettings()

  useEffect(() => {
    if (loading) return

    if (settings.theme_color) setMeta('theme-color', settings.theme_color)
    if (settings.twitter) setMeta('twitter:site', settings.twitter, true)
    if (settings.google_analytics_id) injectGA(settings.google_analytics_id)
  }, [settings, loading])

  return null
}

function setMeta(name: string, content: string, isProperty = false) {
  if (!content) return
  const attr = isProperty ? 'property' : 'name'
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function injectGA(id: string) {
  if (document.querySelector(`script[src*="googletagmanager"]`)) return
  const s1 = document.createElement('script')
  s1.async = true
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(s1)
  const s2 = document.createElement('script')
  s2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`
  document.head.appendChild(s2)
}
