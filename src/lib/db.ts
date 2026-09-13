import { PrismaClient } from '@prisma/client'

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
 * - connect_timeout=10 if missing
 * - connection_limit=5 if missing (Aiven pool size 5)
 * - pool_timeout=10 if missing
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

  // Pool tuning — inject defaults only if missing, do not override existing values
  if (!params.has('connect_timeout')) {
    params.set('connect_timeout', '10')
  }
  if (!params.has('connection_limit')) {
    params.set('connection_limit', '5')
  }
  if (!params.has('pool_timeout')) {
    params.set('pool_timeout', '10')
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
 * Generic retry with exponential backoff (1s, 2s, 4s, max 3 attempts).
 * Used for Aiven cold-start resilience. Wraps any async fn, including Prisma $connect.
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
      if (attempt >= maxAttempts) break
      const delay = delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 1000
      await sleepFn(delay)
    }
  }
  throw lastError
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

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
