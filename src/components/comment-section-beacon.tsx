'use client'

import { useEffect } from 'react'

/**
 * Wave B Task 5 — fires once per session per mod when the comments section
 * mounts (desktop: comments tab content mounts on activation; mobile: the
 * collapsible mounts open). Sits NEXT TO ModComments — comments-system
 * internals are untouched. Server dedups + bot-filters regardless.
 */
export function CommentSectionBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return
    const key = `csc:${slug}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      return
    }
    fetch(`/api/mods/${encodeURIComponent(slug)}/comment-click`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {
      // fire-and-forget analytics — never break the page
    })
  }, [slug])

  return null
}
