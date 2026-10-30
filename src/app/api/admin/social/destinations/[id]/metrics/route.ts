/**
 * GET /api/admin/social/destinations/[id]/metrics — مقاييس أداء وجهة (مرحلة 4).
 */
import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse } from '@/lib/template-lifecycle'

const PERIODS = { '7d': 7, '30d': 30, '90d': 90 } as const
type PeriodKey = keyof typeof PERIODS

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params

    const sp = req.nextUrl.searchParams
    const periodParam = (sp.get('period') ?? '7d') as string
    if (!(periodParam in PERIODS)) {
      return validationFail(
        { period: [`فترة غير صالحة: ${periodParam} — استخدم 7d أو 30d أو 90d`] },
        req.nextUrl.pathname,
      )
    }
    const period = periodParam as PeriodKey
    const days = PERIODS[period]
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    let deliveries: Array<{
      status: string
      attempts: number
      error: string | null
      createdAt: Date
      sentAt: Date | null
    }> = []

    try {
      const rows = await db.socialPostDelivery.findMany({
        where: { destinationId: id, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { status: true, attempts: true, error: true, createdAt: true, sentAt: true },
      })
      if (Array.isArray(rows)) deliveries = rows as typeof deliveries
    } catch {
      deliveries = []
    }

    const totalAttempts = deliveries.length
    const successful = deliveries.filter((d) => d.status === 'sent').length
    const failed = deliveries.filter((d) => d.status === 'failed').length
    const successRate =
      totalAttempts > 0 ? Number(((successful / totalAttempts) * 100).toFixed(2)) : 0

    const latencies = deliveries
      .filter((d) => d.status === 'sent' && d.sentAt && d.createdAt)
      .map((d) =>
        Math.max(0, new Date(d.sentAt as Date).getTime() - new Date(d.createdAt).getTime()),
      )
    const avgLatencyMs =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

    const retryCount = deliveries.reduce((sum, d) => sum + Math.max(0, (d.attempts ?? 1) - 1), 0)

    const throughputPerHour = Number((successful / Math.max(1, days * 24)).toFixed(4))

    const failureBreakdown: Record<string, number> = {}
    for (const d of deliveries) {
      if (d.status !== 'failed') continue
      const key = d.error?.trim() ? d.error.trim() : 'unknown'
      failureBreakdown[key] = (failureBreakdown[key] ?? 0) + 1
    }

    const lastSuccessAt = deliveries
      .filter((d) => d.status === 'sent')
      .map((d) => (d.sentAt ? new Date(d.sentAt) : new Date(d.createdAt)))
      .sort((a, b) => b.getTime() - a.getTime())[0]

    let consecutiveFailures = 0
    for (let i = deliveries.length - 1; i >= 0; i -= 1) {
      if (deliveries[i].status === 'failed') consecutiveFailures += 1
      else break
    }

    return ok({
      destinationId: id,
      period,
      metrics: {
        totalAttempts,
        successful,
        failed,
        successRate,
        avgLatencyMs,
        retryCount,
        throughputPerHour,
        failureBreakdown,
        lastSuccessAt: lastSuccessAt ? lastSuccessAt.toISOString() : null,
        consecutiveFailures,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — مقاييس الوجهة للإدارة')
    if (auth) return auth
    logger.error('[admin/social/destinations/[id]/metrics GET] failed:', err)
    return internalError('تعذّر حساب مقاييس الوجهة', undefined, req.nextUrl.pathname)
  }
}

export const dynamic = 'force-dynamic'
