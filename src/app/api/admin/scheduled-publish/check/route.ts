import { type NextRequest, NextResponse } from 'next/server'
import { rateLimited } from '@/lib/api-response'
import { requireCronAuth } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

/**
 * GET /api/admin/scheduled-publish/check
 * Cron-callable endpoint: finds mods where scheduledAt <= now
 * and workflowStatus !== 'PUBLISHED', then publishes them.
 *
 * Auth: requireCronAuth — Bearer <CRON_SECRET> (timing-safe), same pattern as
 * every other cron route in src/app/api/cron/*. The route lives under
 * /api/admin/* so proxy.ts also applies its role-cookie gate; cron callers
 * carry the shared secret instead of a staff session.
 */
export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  // Publishing is mutating — keep accidental double-firing cheap to absorb.
  const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'cron:scheduled-publish' })
  if (!rl.success) {
    const res = rateLimited('تشغيل متكرر — حاول بعد قليل')
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v)
    return res
  }

  try {
    const now = new Date()

    // Find mods that are scheduled and due
    const dueMods = await db.mod.findMany({
      where: {
        scheduledAt: { lte: now },
        workflowStatus: { not: 'PUBLISHED' },
        scheduledSent: false,
      },
      select: {
        id: true,
        name: true,
        scheduledAt: true,
        authorId: true,
      },
    })

    if (dueMods.length === 0) {
      return NextResponse.json({ data: { published: 0, mods: [] } })
    }

    const published: { id: string; name: string }[] = []

    for (const mod of dueMods) {
      try {
        await db.mod.update({
          where: { id: mod.id },
          data: {
            workflowStatus: 'PUBLISHED',
            publishedAt: now,
            scheduledSent: true,
            scheduledSentAt: now,
          },
        })

        // Create audit log entry
        await db.auditLog
          .create({
            data: {
              userId: mod.authorId,
              action: 'MOD_SCHEDULED_PUBLISH',
              entity: 'mod',
              entityId: mod.id,
              details: JSON.stringify({
                modName: mod.name,
                scheduledAt: mod.scheduledAt,
                publishedAt: now,
              }),
            },
          })
          .catch(() => {})

        published.push({ id: mod.id, name: mod.name })
      } catch (err) {
        logger.error(`[scheduled-publish] Failed to publish mod ${mod.id}:`, err)
      }
    }

    return NextResponse.json({
      data: {
        published: published.length,
        mods: published,
      },
    })
  } catch (err) {
    logger.error('[scheduled-publish/check] failed:', err)
    return NextResponse.json({ error: 'فشل النشر المجدول' }, { status: 500 })
  }
}
