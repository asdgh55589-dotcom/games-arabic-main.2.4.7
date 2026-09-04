import type { NextRequest } from 'next/server'
import { ok, rateLimited } from '@/lib/api-response'
import { clamp, parseIntParam, serialize } from '@/lib/api-utils'
import { PLATFORM_KEYS } from '@/lib/constants'
import { db } from '@/lib/db'
import { meili, meiliHealth } from '@/lib/meilisearch/client'
import { rateLimit } from '@/lib/rate-limit'

// GET /api/search?q=...&platform=PC,PS3&limit=...&type=all|mod|game|team|user
// يبحث في 4 كيانات (تعريبات/ألعاب/فرق/مستخدمين).
// يستخدم Meilisearch عند توفره، وإلا Prisma fallback (case-insensitive).
// العقد القديم محفوظ: mods + games موجودان دائمًا (teams/users مضافة).
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'search' })
  if (!rl.success) {
    return rateLimited()
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const platforms = (searchParams.get('platform') || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => PLATFORM_KEYS.includes(p))
  const minTier = clamp(parseIntParam(searchParams.get('minTier'), 0), 0, 5)
  const limit = clamp(parseIntParam(searchParams.get('limit'), 8), 1, 50)
  const type = (searchParams.get('type') || 'all').toLowerCase()
  const want = (t: string) => type === 'all' || type === t

  if (!q && platforms.length === 0 && !minTier) {
    return ok({ mods: [], games: [], teams: [], users: [] })
  }

  // Meilisearch path (typo-tolerant) with Prisma fallback on any failure
  if (q && meili && (await meiliHealth())) {
    try {
      return ok(await searchViaMeili({ q, platforms, minTier, limit, want }))
    } catch {
      // fall through to Prisma
    }
  }

  return ok(await searchViaPrisma({ q, platforms, minTier, limit, want }))
}

interface SearchArgs {
  q: string
  platforms: string[]
  minTier: number
  limit: number
  want: (t: string) => boolean
}

async function searchViaMeili({ q, platforms, minTier, limit, want }: SearchArgs) {
  const mods: unknown[] = []
  let games: unknown[] = []
  let teams: unknown[] = []
  let users: unknown[] = []

  if (want('mod')) {
    const filters: string[] = ["workflowStatus = 'PUBLISHED'"]
    if (platforms.length) filters.push(`platform IN [${platforms.map((p) => `'${p}'`).join(', ')}]`)
    if (minTier) filters.push(`tier >= ${minTier}`)
    const res = await meili!.index('mods').search(q, {
      limit,
      filter: filters,
      sort: ['downloads:desc'],
    })
    const ids = res.hits.map((h) => (h as { id: string }).id)
    if (ids.length) {
      const rows = await db.mod.findMany({
        where: { id: { in: ids }, workflowStatus: 'PUBLISHED' },
        include: {
          author: true,
          game: { select: { name: true, slug: true, platform: true } },
          category: { select: { name: true, slug: true } },
        },
      })
      const order = new Map(ids.map((id, i) => [id, i]))
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      mods.push(...serialize(rows))
    }
  }

  if (want('game')) {
    const res = await meili!.index('games').search(q, { limit })
    games = res.hits.map((h) => {
      const { id, name, tagline, platform } = h as Record<string, unknown>
      return { id, name, tagline, platform }
    })
  }

  if (want('team')) {
    const res = await meili!.index('teams').search(q, { limit })
    teams = res.hits.map((h) => {
      const { id, name, modCount, isOfficial } = h as Record<string, unknown>
      return { id, name, modCount, isOfficial }
    })
  }

  if (want('user')) {
    const res = await meili!.index('users').search(q, { limit })
    users = res.hits.map((h) => {
      const { id, username, displayName } = h as Record<string, unknown>
      return { id, username, displayName }
    })
  }

  return { mods, games, teams, users }
}

async function searchViaPrisma({ q, platforms, minTier, limit, want }: SearchArgs) {
  const mods = want('mod')
    ? await db.mod.findMany({
        where: {
          workflowStatus: 'PUBLISHED',
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { arabicTitle: { contains: q, mode: 'insensitive' } },
                  { summary: { contains: q, mode: 'insensitive' } },
                  { tags: { contains: q, mode: 'insensitive' } },
                  { series: { contains: q, mode: 'insensitive' } },
                  { translationTeam: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(platforms.length > 0 ? { game: { platform: { in: platforms } } } : {}),
          ...(minTier ? { author: { tier: { gte: minTier } } } : {}),
        },
        take: limit,
        orderBy: { downloads: 'desc' },
        include: {
          author: true,
          game: { select: { name: true, slug: true, platform: true } },
          category: { select: { name: true, slug: true } },
        },
      })
    : []

  const games = want('game')
    ? await db.game.findMany({
        where: {
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { tagline: { contains: q, mode: 'insensitive' } },
                  { description: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
        },
        take: limit,
        orderBy: { totalDownloads: 'desc' },
      })
    : []

  const teams = want('team')
    ? await db.team.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        take: limit,
        orderBy: { modCount: 'desc' },
        select: { id: true, name: true, slug: true, modCount: true, isOfficial: true },
      })
    : []

  const users = want('user')
    ? await db.user.findMany({
        where: q
          ? {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        take: limit,
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
    : []

  return { mods: serialize(mods), games: serialize(games), teams, users }
}
