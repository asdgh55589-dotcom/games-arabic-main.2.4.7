export interface RouteMetrics {
  rate: number
  errors: number
  duration: { p50: number; p95: number; p99: number }
}

/**
 * RED error signal (fixed — was dead).
 *
 * Root cause: src/proxy.ts runs as Next.js middleware, i.e. BEFORE route
 * handlers. Its `res.status` is the middleware-egress status (200 for every
 * pass-through), never the route handler's final status — so `isError` was
 * always false for real 4xx/5xx responses, and nothing ever read the store.
 *
 * Fix: errors are recorded AT THE SOURCE with the REAL status —
 * api-response.ts fail() (all 268 route files funnel through it) and
 * proxyJson() (proxy-generated 401/403/503s, whose status IS real).
 * Counts live in a Redis hash (shared across Edge + Node runtimes, which
 * do NOT share in-memory Maps in production) with an in-memory mirror
 * for single-process dev/test. Best-effort + fail-open: observability
 * must never break a request.
 */

import { redisClient } from '@/lib/redis'

const RED_ERROR_HASH = 'red:errors:v1'
const RED_ERROR_TTL_S = 180
const RED_ERROR_WINDOW_MS = 120_000

export interface RouteErrorEntry {
  route: string
  status: number
  count: number
  lastSeen: number
}

// In-memory mirror (single-process dev/test; NOT shared Edge↔Node in prod).
const localErrorLedger = new Map<string, RouteErrorEntry>()

function sanitizeRoute(route: string): string {
  return (route || 'unknown').slice(0, 160).replace(/[^a-zA-Z0-9/_\-. ]/g, '_')
}

function minuteBucket(now: number): number {
  return Math.floor(now / 60_000)
}

/**
 * Record one error occurrence with its REAL HTTP status. Fire-and-forget —
 * returns void; Redis failures fall back to the local ledger silently.
 */
export function recordRouteError(route: string, status: number): void {
  const cleanRoute = sanitizeRoute(route)
  const safeStatus = Number.isInteger(status) ? status : 0
  const now = Date.now()
  const key = `${cleanRoute}|${safeStatus}`
  const prev = localErrorLedger.get(key)
  localErrorLedger.set(key, {
    route: cleanRoute,
    status: safeStatus,
    count: (prev?.count ?? 0) + 1,
    lastSeen: now,
  })
  // Cross-runtime ledger (best-effort, never throws).
  try {
    const field = `${minuteBucket(now)}|${cleanRoute}|${safeStatus}`
    const p =
      redisClient?.hincrby(RED_ERROR_HASH, field, 1).then(async (n) => {
        if (n === 1) await redisClient?.expire(RED_ERROR_HASH, RED_ERROR_TTL_S)
      }) ?? Promise.resolve()
    p.catch(() => {
      // intentional: Redis down → local ledger already captured it
    })
  } catch {
    // intentional: sync throw guard (misconfigured client) → local ledger stands
  }
}

/**
 * Read recent error signals (last ~2 min), Redis first, local mirror merged
 * in. Returns [] on total backend failure — never throws.
 */
export async function getRouteErrors(): Promise<RouteErrorEntry[]> {
  const now = Date.now()
  const cutoffBucket = minuteBucket(now - RED_ERROR_WINDOW_MS)
  const merged = new Map<string, RouteErrorEntry>()
  for (const [key, e] of localErrorLedger) {
    if (now - e.lastSeen <= RED_ERROR_WINDOW_MS) merged.set(key, { ...e })
  }
  try {
    const raw = (await redisClient?.hgetall(RED_ERROR_HASH)) as Record<string, number | string> | null
    if (raw) {
      for (const [field, value] of Object.entries(raw)) {
        const [bucketStr, route, statusStr] = field.split('|')
        if (Number(bucketStr) < cutoffBucket) continue
        const key = `${route}|${statusStr}`
        const count = typeof value === 'number' ? value : parseInt(String(value), 10) || 0
        const prev = merged.get(key)
        merged.set(key, {
          route,
          status: parseInt(statusStr, 10) || 0,
          count: (prev?.count ?? 0) + count,
          lastSeen: now,
        })
      }
    }
  } catch {
    // intentional: Redis unreadable → local mirror is the answer
  }
  return [...merged.values()].sort((a, b) => b.count - a.count)
}

/** Test/dev helper — clears the local mirror (Redis hash untouched). */
export function resetRouteErrors(): void {
  localErrorLedger.clear()
}

interface RouteEntry {
  timestamps: number[]
  durations: number[]
  errors: number[]
}

const WINDOW_MS = 60_000
export const routeStore = new Map<string, RouteEntry>()

function prune(entry: RouteEntry, now: number): void {
  const cutoff = now - WINDOW_MS
  let i = 0
  while (i < entry.timestamps.length && entry.timestamps[i] < cutoff) i++
  if (i > 0) {
    entry.timestamps.splice(0, i)
    entry.durations.splice(0, i)
    entry.errors.splice(0, i)
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function recordRequest(route: string, durationMs: number, isError: boolean): void {
  const now = Date.now()
  let entry = routeStore.get(route)
  if (!entry) {
    entry = { timestamps: [], durations: [], errors: [] }
    routeStore.set(route, entry)
  }
  prune(entry, now)
  entry.timestamps.push(now)
  entry.durations.push(durationMs)
  entry.errors.push(isError ? 1 : 0)
}

export function getRouteMetrics(route: string): RouteMetrics {
  const entry = routeStore.get(route)
  if (!entry) {
    return { rate: 0, errors: 0, duration: { p50: 0, p95: 0, p99: 0 } }
  }
  const now = Date.now()
  prune(entry, now)
  const sorted = [...entry.durations].sort((a, b) => a - b)
  return {
    rate: entry.timestamps.length,
    errors: entry.errors.reduce((s, v) => s + v, 0),
    duration: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    },
  }
}

export function getAllMetrics(): Map<string, RouteMetrics> {
  const result = new Map<string, RouteMetrics>()
  const now = Date.now()
  for (const [route, entry] of routeStore) {
    prune(entry, now)
    const sorted = [...entry.durations].sort((a, b) => a - b)
    result.set(route, {
      rate: entry.timestamps.length,
      errors: entry.errors.reduce((s, v) => s + v, 0),
      duration: {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      },
    })
  }
  return result
}

export function resetMetrics(): void {
  routeStore.clear()
}
