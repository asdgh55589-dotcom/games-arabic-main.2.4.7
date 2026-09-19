import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/admin/scheduled-publish/check
 * Cron-callable endpoint: finds mods where scheduledAt <= now
 * and workflowStatus !== 'PUBLISHED', then publishes them.
 *
 * Auth: This endpoint is designed to be called by an external cron job.
 * In production, protect with a secret header or API key.
 */
export async function GET() {
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
      await db.auditLog.create({
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
      }).catch(() => {})

      published.push({ id: mod.id, name: mod.name })
    } catch (err) {
      console.error(`[scheduled-publish] Failed to publish mod ${mod.id}:`, err)
    }
  }

  return NextResponse.json({
    data: {
      published: published.length,
      mods: published,
    },
  })
}
