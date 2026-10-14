import { createHash } from 'node:crypto'
import { redisGet, redisIncr, redisSet } from '@/lib/redis'

/**
 * lib/game-mods-cache.ts — server-side result cache for
 * GET /api/games/[slug]/mods (the public PUBLISHED listing per game).
 *
 * Why this exists: the route already sends browser caching
 * (`max-age=30, swr=120` + ETag/304), but every request still ran the
 * full DB query. This caches the *query result* server-side.
 *
 * Design:
 * - Version-key invalidation (no SCAN): the cache key embeds a per-game
 *   generation counter (`mods:game:{gameId}:v`). Writes bump the counter,
 *   so entries written before a mutation are never served afterwards.
 * - Fail-open everywhere: any Redis error falls through to the DB path
 *   (same posture as auth/me + rate-limit). Cache helpers never throw.
 * - No PII in keys: the free-text `search` param is SHA-256 hashed.
 */

export const GAME_MODS_CACHE_TTL_S = 60
const VERSION_TTL_S = 24 * 60 * 60

export interface GameModsListPayload {
  data: unknown
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function gameModsVersionKey(gameId: string): string {
  return `mods:game:${gameId}:v`
}

/**
 * Current cache generation for a game. Returns 0 when no generation was
 * ever written. Returns null only when the version itself is unreadable —
 * callers must bypass the cache entirely in that case (never serve a
 * potentially stale generation).
 */
export async function getGameModsCacheVersion(gameId: string): Promise<number | null> {
  try {
    const v = await redisGet<number>(gameModsVersionKey(gameId))
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v))
    if (v === null) return 0
    return 0
  } catch {
    return null
  }
}

export interface GameModsCacheKeyParams {
  gameId: string
  version: number
  page: number
  limit: number
  sort: string
  category: string | null
  search: string | null
  featured: string | null
}

export function buildGameModsCacheKey(p: GameModsCacheKeyParams): string {
  const searchHash = p.search
    ? createHash('sha256').update(p.search).digest('hex').slice(0, 16)
    : '-'
  const category = p.category || '-'
  const featured = p.featured ?? '-'
  return (
    `mods:game:${p.gameId}:v${p.version}` +
    `:p${p.page}:l${p.limit}:s${p.sort}:c${category}:q${searchHash}:f${featured}`
  )
}

/** Read a cached listing payload. Null = miss (or Redis down). Never throws. */
export async function getGameModsCache(key: string): Promise<GameModsListPayload | null> {
  try {
    const cached = await redisGet<GameModsListPayload>(key)
    if (cached && typeof cached === 'object' && 'data' in cached && 'pagination' in cached) {
      return cached
    }
    return null
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: cache miss → DB below
    return null
  }
}

/** Store a listing payload. Best-effort — never throws. */
export async function setGameModsCache(key: string, payload: GameModsListPayload): Promise<void> {
  try {
    await redisSet(key, payload, GAME_MODS_CACHE_TTL_S)
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: caching is advisory — the response is already built
  }
}

/**
 * Invalidate all cached listings of one or more games (call after any
 * mutation that changes PUBLISHED listing state: publish/unpublish,
 * edit of a listed mod, flag changes, delete). Best-effort, never throws.
 */
export async function invalidateGameModsCache(gameId: string | string[]): Promise<void> {
  try {
    const ids = [...new Set((Array.isArray(gameId) ? gameId : [gameId]).filter(Boolean))]
    if (ids.length === 0) return
    await Promise.all(ids.map((id) => redisIncr(gameModsVersionKey(id), VERSION_TTL_S)))
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: 60s TTL converges anyway
  }
}
