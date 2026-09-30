import { PrismaClient } from '@prisma/client'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

/**
 * Resolve the active DATABASE_URL.
 * Prefers AIVEN_DATABASE_URL when set (SA-4 coordination), falls back to DATABASE_URL.
 * Throws if neither is set — callers that need a safe fallback (Prisma singleton)
 * should use resolveDatabaseUrl() instead.
 */
export function getDatabaseUrl(): string {
  const aiven = process.env.AIVEN_DATABASE_URL
  const fallback = process.env.DATABASE_URL
  const raw = aiven && aiven.trim() !== '' ? aiven : fallback
  if (!raw || raw.trim() === '') {
    throw new Error('DATABASE_URL must be set (or AIVEN_DATABASE_URL for Aiven)')
  }
  return raw
}

/**
 * Ensure Aiven-required URL params:
 * - sslmode=require (inject if missing, throw if explicitly disable/allow or non-require)
 * - connection_limit=5 if missing (MUST match Aiven server pool size — never oversubscribe)
 * - pool_timeout=10 if missing (fail fast instead of hanging)
 * - connect_timeout=10 if missing
 * - statement_timeout=15000 (15s) if missing (kill runaway queries, free the connection)
 * Preserves all other params/values.
 */
export function ensureSslmode(url: string): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('DATABASE_URL must include sslmode=require for Aiven')
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('DATABASE_URL must include sslmode=require for Aiven')
  }
  const params = parsed.searchParams
  const existing = params.get('sslmode')
  if (existing !== null) {
    const lower = existing.toLowerCase()
    if (lower === 'disable' || lower === 'allow') {
      throw new Error('DATABASE_URL must include sslmode=require for Aiven')
    }
    if (lower !== 'require') {
      throw new Error('DATABASE_URL must include sslmode=require for Aiven')
    }
    // already require — keep as-is
  } else {
    params.set('sslmode', 'require')
  }

  // Pool tuning — inject defaults only if missing, do not override existing values.
  // Values match Aiven's server pool size (5): the app must never open more
  // connections than the server pool holds, or requests queue into P2024.
  if (!params.has('connect_timeout')) {
    params.set('connect_timeout', '10')
  }
  if (!params.has('connection_limit')) {
    params.set('connection_limit', '5')
  }
  if (!params.has('pool_timeout')) {
    params.set('pool_timeout', '10')
  }
  if (!params.has('statement_timeout')) {
    params.set('statement_timeout', '15000')
  }

  return parsed.toString()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  maxAttempts?: number
  delaysMs?: number[]
  sleepFn?: (ms: number) => Promise<void>
}

/**
 * Prisma error codes that will NEVER succeed on retry (constraint / lookup /
 * parse failures). Retrying them wastes pool connections and delays the
 * caller's error handling — rethrow immediately.
 */
export const DETERMINISTIC_ERROR_CODES = ['P2002', 'P2003', 'P2025', 'P2008']

export function isDeterministicError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' && DETERMINISTIC_ERROR_CODES.includes(code)
}

/**
 * Generic retry with exponential backoff (1s, 2s, 4s, max 3 attempts).
 * Used for Aiven cold-start resilience. Wraps any async fn, including Prisma $connect.
 * Pool exhaustion (P2024) is reported to Sentry — it means the pool sizing or
 * query fan-out regressed and needs attention, not just a retry.
 * Deterministic errors (P2002/P2003/P2025/P2008) are rethrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3
  const delaysMs = opts.delaysMs ?? [1000, 2000, 4000]
  const sleepFn = opts.sleepFn ?? sleep
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (isDeterministicError(err)) throw err
      if (isPoolExhaustedError(err)) {
        logger.error(
          { event: 'db_pool_exhausted', attempt, maxAttempts, err },
          'DB pool exhausted (P2024) — pool sizing or query fan-out regressed',
        )
        reportError(err, { route: 'db-pool', action: `pool-exhausted attempt ${attempt}/${maxAttempts}` })
      }
      if (attempt >= maxAttempts) break
      const delay = delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 1000
      await sleepFn(delay)
    }
  }
  throw lastError
}

/** P2024 = timed out fetching a connection from the pool. */
export function isPoolExhaustedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: unknown }).code
  if (code === 'P2024') return true
  const msg = err instanceof Error ? err.message : String(err)
  return /P2024|timed out fetching a new connection from the connection pool/i.test(msg)
}

// Aliases for spec flexibility — both names wrap the same exponential backoff
export const withDatabaseRetry = withRetry
export const connectWithRetry = withRetry

function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    return ensureSslmode(raw)
  } catch (err) {
    if (process.env.NODE_ENV === 'production') throw err
    console.warn(`[db] ${(err as Error).message}`)
    return raw
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = resolveDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

// Singleton in ALL envs (including production): without this, standalone
// production creates a new PrismaClient per importing module instance and
// exhausts the connection pool under concurrent requests.
globalForPrisma.prisma = db

// Warm up the connection pool at boot (Aiven cold-start resilience).
// Fail-open: a cold DB must never crash the app — requests will retry via
// withRetry at call time. Skipped in tests (Prisma is mocked there).
if (process.env.NODE_ENV !== 'test' && databaseUrl) {
  void withDatabaseRetry(() => db.$connect(), {
    maxAttempts: 3,
    delaysMs: [1000, 2000, 4000],
  }).then(
    () => console.log('[db] connection pool warmed up successfully'),
    (err) => console.error('[db] failed to warm up connection pool:', err),
  )
}

// Connection health flag + auto-reconnect on client errors (ECONNRESET, etc.).
// Fail-open with backoff: a dead pool recovers without a redeploy.
// Guarded: skipped in tests (mocked client has no $on) and when no URL resolved.
let connectionHealthy = true

export function isConnectionHealthy(): boolean {
  return connectionHealthy
}

if (
  process.env.NODE_ENV !== 'test' &&
  databaseUrl &&
  typeof (db as unknown as { $on?: unknown }).$on === 'function'
) {
  ;(db as unknown as { $on: (event: string, cb: (err: unknown) => void) => void }).$on(
    'error',
    (err: unknown) => {
      connectionHealthy = false
      logger.error({ event: 'db_client_error', err }, 'Prisma client error — reconnecting in 5s')
      setTimeout(() => {
        void withDatabaseRetry(() => db.$connect(), {
          maxAttempts: 4,
          delaysMs: [1000, 2000, 4000, 8000],
        }).then(
          () => {
            connectionHealthy = true
            logger.info({ event: 'db_reconnected' }, 'DB reconnected successfully')
          },
          (reconnectErr: unknown) =>
            logger.error({ event: 'db_reconnect_failed', err: reconnectErr }, 'DB reconnection failed'),
        )
      }, 5000)
    },
  )
}
