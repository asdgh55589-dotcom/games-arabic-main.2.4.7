import { db } from '@/lib/db'
import { normalizeArabic } from '@/lib/duplicate-detection'
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
  const teams = await db.team.findMany()
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
