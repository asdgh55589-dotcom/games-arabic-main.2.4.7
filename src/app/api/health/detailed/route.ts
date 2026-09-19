import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, rateLimited, unauthorized } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { getCircuitStatus, isCircuitOpen } from '@/lib/redis-circuit-breaker'
import { redisGet } from '@/lib/redis'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// GET /api/health/detailed — admin-only service status (DB, Redis, Telegram,
// Brevo, IA). The public /api/health stays dependency-free on purpose
// (deploy liveness must answer even when backends are down).
// Rate-limited: 10/min per IP. Every check is time-boxed and fail-open.

const CHECK_TIMEOUT_MS = 4_000

type CheckStatus = 'ok' | 'degraded' | 'not_configured' | 'error'

interface ServiceCheck {
  status: CheckStatus
  latencyMs?: number
  detail?: string
}

async function runCheck<T>(fn: () => Promise<T>): Promise<{ ok: boolean; value?: T; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const value = (await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('check timeout')), CHECK_TIMEOUT_MS),
      ),
    ])) as T
    return { ok: true, value, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkDatabase(): Promise<ServiceCheck> {
  const r = await runCheck(() => db.$queryRaw`SELECT 1`)
  if (!r.ok) return { status: 'error', latencyMs: r.latencyMs, detail: r.error }
  return { status: 'ok', latencyMs: r.latencyMs }
}

async function checkRedis(): Promise<ServiceCheck> {
  const circuit = getCircuitStatus()
  const open = isCircuitOpen()
  const r = await runCheck(() => redisGet<string>('health:probe'))
  // Probe success proves the read path (Upstash or memory fallback).
  if (!r.ok) return { status: 'error', latencyMs: r.latencyMs, detail: r.error }
  return {
    status: open ? 'degraded' : 'ok',
    latencyMs: r.latencyMs,
    detail: open ? `circuit ${circuit} — memory fallback` : circuit,
  }
}

async function checkTelegram(): Promise<ServiceCheck> {
  const { verifyBot } = await import('@/lib/telegram-bot')
  const r = await runCheck(() => verifyBot())
  if (!r.ok) return { status: 'error', latencyMs: r.latencyMs, detail: r.error }
  if (!r.value?.configured) {
    return { status: 'not_configured', latencyMs: r.latencyMs, detail: r.value?.error }
  }
  return {
    status: 'ok',
    latencyMs: r.latencyMs,
    detail: [
      `bot @${r.value.botInfo?.username ?? 'unknown'}`,
      `webhook_secret:${process.env.TELEGRAM_WEBHOOK_SECRET ? 'set' : 'missing'}`,
    ].join(' '),
  }
}

async function checkBrevo(): Promise<ServiceCheck> {
  const { verifyBrevoSender } = await import('@/lib/email/brevo')
  const r = await runCheck(() => verifyBrevoSender())
  if (!r.ok) return { status: 'error', latencyMs: r.latencyMs, detail: r.error }
  if (!r.value?.ok) {
    return { status: 'not_configured', latencyMs: r.latencyMs, detail: r.value?.reason }
  }
  return { status: 'ok', latencyMs: r.latencyMs }
}

async function checkStorage(): Promise<ServiceCheck> {
  // Boolean-only (no network): IA live verification is a staging activity.
  const { isIaConfigured, isIaEnabled } = await import('@/lib/ia')
  const enabled = isIaEnabled()
  const configured = isIaConfigured()
  if (!enabled) return { status: 'not_configured', detail: 'IA_ENABLED=false' }
  if (!configured) return { status: 'error', detail: 'enabled but keys incomplete' }
  return { status: 'ok' }
}

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'health:detailed' })
  if (!rl.success) {
    return rateLimited('تم تجاوز الحد المسموح. حاول مرة أخرى لاحقاً.', 60)
  }

  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 401
        ? unauthorized('Unauthorized')
        : forbidden('Forbidden — admin access required')
    }
    return internalError('Failed')
  }

  try {
    const [database, redis, telegram, brevo, storage] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkTelegram(),
      checkBrevo(),
      checkStorage(),
    ])
    const checks = { database, redis, telegram, brevo, storage }
    const allOk = Object.values(checks).every((c) => c.status === 'ok')
    return ok({
      status: allOk ? 'healthy' : 'degraded',
      time: new Date().toISOString(),
      checks,
    })
  } catch (err) {
    return internalError('Failed')
  }
}
