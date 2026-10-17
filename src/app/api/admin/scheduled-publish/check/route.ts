import { type NextRequest, NextResponse } from 'next/server'
import { rateLimited } from '@/lib/api-response'
import { requireCronAuth } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { invalidateGameModsCache } from '@/lib/game-mods-cache'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { completeProjectSide } from '@/lib/schedule-projects'

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

    // Find mods that are scheduled and due.
    // المرحلة 4: المودات المرتبطة بمشروع جدولة نشط يشمل الموقع تُنشر عبر
    // المشروع حصراً (مصدر الحقيقة الواحد) — تُستبعد من المسار القديم.
    const dueMods = await db.mod.findMany({
      where: {
        scheduledAt: { lte: now },
        workflowStatus: { not: 'PUBLISHED' },
        scheduledSent: false,
        scheduleProjects: {
          none: {
            status: { in: ['scheduled', 'running'] },
            mode: { in: ['site_only', 'both'] },
          },
        },
      },
      select: {
        id: true,
        name: true,
        gameId: true,
        scheduledAt: true,
        authorId: true,
      },
    })

    // ===== مشاريع الجدولة المستحقة (الجانب الموقعي) =====
    const dueProjects = await db.socialScheduleProject.findMany({
      where: {
        status: { in: ['scheduled', 'running'] },
        mode: { in: ['site_only', 'both'] },
        sitePublishAt: { lte: now },
      },
      include: {
        mod: {
          select: {
            id: true,
            name: true,
            gameId: true,
            scheduledAt: true,
            authorId: true,
            workflowStatus: true,
          },
        },
      },
    })

    if (dueMods.length === 0 && dueProjects.length === 0) {
      return NextResponse.json({ data: { published: 0, mods: [], projects: [] } })
    }

    const published: { id: string; name: string }[] = []
    const publishedGameIds = new Set<string>()
    const projectsDone: string[] = []

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
        if (mod.gameId) publishedGameIds.add(mod.gameId)
      } catch (err) {
        logger.error(`[scheduled-publish] Failed to publish mod ${mod.id}:`, err)
      }
    }

    // مشاريع الجدولة: نفس خطوات النشر للمود المرتبط، ثم إكمال الجانب الموقعي.
    for (const project of dueProjects) {
      const mod = project.mod
      if (!mod || mod.workflowStatus === 'PUBLISHED') {
        await completeProjectSide(project.id, 'site')
        if (!mod) continue
        projectsDone.push(project.id)
        continue
      }
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
                projectId: project.id,
              }),
            },
          })
          .catch(() => {})

        published.push({ id: mod.id, name: mod.name })
        if (mod.gameId) publishedGameIds.add(mod.gameId)
        await completeProjectSide(project.id, 'site')
        projectsDone.push(project.id)
      } catch (err) {
        logger.error(`[scheduled-publish] Failed to publish project ${project.id}:`, err)
        await completeProjectSide(
          project.id,
          'site',
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    // Listing cache: newly PUBLISHED mods join game listings (best-effort).
    invalidateGameModsCache([...publishedGameIds]).catch(() => {})

    return NextResponse.json({
      data: {
        published: published.length,
        mods: published,
        projects: projectsDone,
      },
    })
  } catch (err) {
    logger.error('[scheduled-publish/check] failed:', err)
    return NextResponse.json({ error: 'فشل النشر المجدول' }, { status: 500 })
  }
}
