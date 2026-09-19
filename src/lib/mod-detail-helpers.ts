/**
 * Mod detail display helpers (feat/mod-detail-page-completion).
 * Pure functions — tested in src/__tests__/mod-detail-completion.test.ts.
 */

/** 3a — summary with fallback to first 150 chars of description. */
export function getDisplaySummary(mod: {
  summary?: string | null
  description?: string | null
}): string {
  const s = (mod.summary || '').trim()
  if (s !== '') return s
  const d = (mod.description || '').trim()
  if (d === '') return ''
  return d.substring(0, 150)
}

/** 3g — data condition for the scheduled banner (permission checked in component). */
export function shouldShowScheduledBanner(mod: {
  scheduledAt?: string | Date | null
  workflowStatus?: string | null
}): boolean {
  if (!mod.scheduledAt) return false
  const d = typeof mod.scheduledAt === 'string' ? new Date(mod.scheduledAt) : mod.scheduledAt
  if (isNaN(d.getTime())) return false
  if (d.getTime() > Date.now()) return true
  // Non-published workflow with a schedule set → still pending publish.
  if (mod.workflowStatus && mod.workflowStatus !== 'PUBLISHED') return true
  return false
}

/** 3e — prefer Series relation, fallback to legacy string. */
export function getSeriesDisplay(mod: {
  series?: string | null
  seriesRelation?: { name: string; slug: string } | null
}): { name: string; href: string } | null {
  if (mod.seriesRelation?.name) {
    return { name: mod.seriesRelation.name, href: `/series/${mod.seriesRelation.slug}` }
  }
  const s = (mod.series || '').trim()
  if (s === '') return null
  return { name: s, href: `/series/${encodeURIComponent(s)}` }
}

/** 3e/relations — prefer Team relation, fallback to legacy string. */
export function getTeamDisplay(mod: {
  translationTeam?: string | null
  teamRelation?: { name: string; slug: string } | null
}): { name: string; href: string } | null {
  if (mod.teamRelation?.name) {
    return { name: mod.teamRelation.name, href: `/teams/${mod.teamRelation.slug}` }
  }
  const t = (mod.translationTeam || '').trim()
  if (t === '') return null
  return { name: t, href: `/teams/${encodeURIComponent(t)}` }
}

/** 3k — rating text or null when unrated. */
export function formatRatingText(rating: number | null | undefined, count?: number | null): string | null {
  if (!rating || rating <= 0) return null
  const c = count && count > 0 ? ` (${count})` : ''
  return `${rating}/5${c}`
}
