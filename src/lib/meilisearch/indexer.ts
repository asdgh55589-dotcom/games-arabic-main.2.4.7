import { db } from '@/lib/db'
import { normalizeArabic } from '@/lib/duplicate-detection'
import { logger } from '@/lib/logger'
import { meili } from './client'

// Bulk index (for initial seeding) — PUBLISHED mods only
export async function seedModsIndex() {
  if (!meili) return
  const mods = await db.mod.findMany({
    where: { workflowStatus: 'PUBLISHED' },
    include: {
      author: { select: { username: true, displayName: true, tier: true } },
      game: { select: { platform: true } },
    },
  })
  const docs = mods.map((m) => ({
    id: m.id,
    name: m.name,
    arabicTitle: m.arabicTitle || normalizeArabic(m.name),
    summary: m.summary,
    tags: m.tags,
    series: m.series,
    platform: m.game?.platform ?? null,
    gameId: m.gameId,
    authorId: m.authorId,
    authorName: m.author?.displayName || m.author?.username || '',
    tier: m.author?.tier ?? 0,
    downloads: m.downloads,
    workflowStatus: m.workflowStatus,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }))
  if (docs.length) await meili.index('mods').addDocuments(docs)
  return docs.length
}

export async function seedGamesIndex() {
  if (!meili) return
  const games = await db.game.findMany()
  const docs = games.map((g) => ({
    id: g.id,
    name: g.name,
    tagline: g.tagline,
    category: g.category,
    platform: g.platform,
    featured: g.featured,
    modCount: g.modCount,
    totalDownloads: g.totalDownloads,
    createdAt: g.createdAt.toISOString(),
  }))
  if (docs.length) await meili.index('games').addDocuments(docs)
  return docs.length
}

export async function seedTeamsIndex() {
  if (!meili) return
  const teams = await db.team.findMany({ where: { archivedAt: null } })
  const docs = teams.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isOfficial: t.isOfficial,
    isFeatured: t.isFeatured,
    modCount: t.modCount,
    createdAt: t.createdAt.toISOString(),
  }))
  if (docs.length) await meili.index('teams').addDocuments(docs)
  return docs.length
}

export async function seedUsersIndex() {
  if (!meili) return
  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      tier: true,
      createdAt: true,
    },
  })
  const docs = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    role: u.role,
    tier: u.tier,
    createdAt: u.createdAt.toISOString(),
  }))
  if (docs.length) await meili.index('users').addDocuments(docs)
  return docs.length
}

// Incremental update (called from lifecycle hooks) — PUBLISHED only
export async function indexMod(modId: string) {
  if (!meili) return
  const m = await db.mod.findUnique({
    where: { id: modId },
    include: {
      author: { select: { username: true, displayName: true, tier: true } },
      game: { select: { platform: true } },
    },
  })
  if (!m) return
  if (m.workflowStatus !== 'PUBLISHED') {
    await deleteModFromIndex(modId)
    return
  }
  await meili.index('mods').addDocuments([
    {
      id: m.id,
      name: m.name,
      arabicTitle: m.arabicTitle || normalizeArabic(m.name),
      summary: m.summary,
      tags: m.tags,
      series: m.series,
      platform: m.game?.platform ?? null,
      gameId: m.gameId,
      authorId: m.authorId,
      authorName: m.author?.displayName || m.author?.username || '',
      tier: m.author?.tier ?? 0,
      downloads: m.downloads,
      workflowStatus: m.workflowStatus,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    },
  ])
}

export async function deleteModFromIndex(modId: string) {
  if (!meili) return
  await meili
    .index('mods')
    .deleteDocument(modId)
    .catch(() => {})
}

/**
 * Throttle window for `reindexModById` (milliseconds).
 *
 * Why a throttle: the search index carries `downloads` and `/api/search` SORTS
 * by it, so the counter has to be pushed to Meilisearch after a counted
 * download. Writing to Meilisearch on EVERY download is not acceptable —
 * a popular mod can be downloaded hundreds of times per minute, and each
 * write is an HTTP round-trip plus an index task. With a 30s window the
 * index lags the live counter by at most 30s, which is invisible in the UI
 * (the card shows the LIVE value; only the sort order uses the indexed one).
 *
 * Override with `MEILI_REINDEX_THROTTLE_MS` (0 disables the throttle).
 */
export const MEILI_REINDEX_THROTTLE_MS = Number(process.env.MEILI_REINDEX_THROTTLE_MS ?? 30_000)

/** modId → last re-index timestamp (process-local; the throttle is best-effort). */
const reindexThrottle = new Map<string, number>()

/** True when the mod was re-indexed too recently (caller should skip). */
function isReindexThrottled(modId: string, now: number): boolean {
  if (MEILI_REINDEX_THROTTLE_MS <= 0) return false
  const last = reindexThrottle.get(modId)
  if (last !== undefined && now - last < MEILI_REINDEX_THROTTLE_MS) return true
  reindexThrottle.set(modId, now)
  // Opportunistic cleanup so the map cannot grow without bound.
  if (reindexThrottle.size > 5000) {
    for (const [id, at] of reindexThrottle) {
      if (now - at > MEILI_REINDEX_THROTTLE_MS) reindexThrottle.delete(id)
    }
  }
  return false
}

/**
 * Re-sync a SINGLE mod document in the search index (best-effort).
 *
 * Used after a counted download so `/api/search` sorting by `downloads` stays
 * close to the live counter. It reuses `indexMod()` — therefore the pushed
 * document has exactly the same shape as the bulk indexer.
 *
 * Never throws and never blocks the caller: if Meilisearch is not configured
 * it is a quiet no-op, and any error is logged and swallowed.
 */
export async function reindexModById(modId: string): Promise<void> {
  if (!meili) return
  try {
    if (isReindexThrottled(modId, Date.now())) return
    await indexMod(modId)
  } catch (err) {
    // intentional: expected+handled (search index sync is best-effort — never breaks the download path)
    logger.warn(
      { event: 'meili_reindex_mod_failed', action: 'reindex_mod_by_id', modId, err },
      'meilisearch reindex failed',
    )
  }
}
