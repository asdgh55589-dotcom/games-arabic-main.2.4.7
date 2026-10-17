import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getActiveSocialPlatforms } from '@/lib/social/platforms'
import { resolvePlatformRoutes } from '@/lib/social/route-resolve'
import {
  activateScheduleProject,
  createScheduleProject,
  SCHEDULE_MODES,
  ScheduleProjectError,
  updateScheduleProject,
} from '@/lib/schedule-projects'

const CreatorUpsertSchema = z.object({
  modId: z.string().min(1),
  mode: z.enum(SCHEDULE_MODES),
  sitePublishAt: z.string().datetime().nullable().optional(),
  socialPublishAt: z.string().datetime().nullable().optional(),
})

function knownErrorResponse(err: ScheduleProjectError, path: string) {
  if (err.code === 'NOT_FOUND') {
    return fail(err.code, err.message, 404, err.details, undefined, path)
  }
  const status = err.code === 'CONFLICT' ? 409 : 422
  return fail(err.code, err.message, status, err.details, undefined, path)
}

/**
 * POST /api/creator/schedule-projects — حفظ جدولة مود يملكه المنادِي.
 *
 * جلسة استوديو + ملكية صارمة (authorId). الأهداف دائماً مستنتجة من
 * قواعد المنصة (التجاوز اليدوي للمديرين فقط عبر مسار admin) — أي
 * manualTargets مرسلة تُتجاهل بصمت وأمان. التفعيل فوري (مجدولة)
 * كما كان سلوك scheduledAt سابقاً.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return unauthorized('سجّل الدخول أولاً')

    const raw = await req.json().catch(() => ({}))
    const parsed = CreatorUpsertSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات غير صالحة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }
    const data = parsed.data

    const mod = await db.mod.findUnique({
      where: { id: data.modId },
      select: { id: true, authorId: true, game: { select: { platform: true } } },
    })
    if (!mod) {
      return fail('VALIDATION_ERROR', 'التعريب غير موجود', 404, undefined, undefined, req.nextUrl.pathname)
    }
    if (mod.authorId !== user.id) {
      return forbidden('لا تملك صلاحية جدولة هذا التعريب')
    }

    // الأهداف المستنتجة لازمة لأي وضع اجتماعي.
    let snapshots: Array<{ destinationId: string; threadId: number | null; botId: string | null }> = []
    if (data.mode !== 'site_only') {
      const gamePlatform = mod.game?.platform ?? null
      if (!gamePlatform) {
        const msg = 'تعذّر تحديد منصة هذا التعريب — تواصل مع الإدارة'
        return fail('VALIDATION_ERROR', msg, 422, { targets: msg }, undefined, req.nextUrl.pathname)
      }
      const resolved = await resolvePlatformRoutes(gamePlatform, new Date())
      snapshots = resolved.targets.map((t) => ({
        destinationId: t.destinationId,
        threadId: t.threadId,
        botId: t.botId,
      }))
      if (snapshots.length === 0) {
        const msg = 'لا أهداف نشر مستنتجة لمنصة هذا التعريب — تواصل مع الإدارة لإضافة قاعدة توجيه'
        return fail('VALIDATION_ERROR', msg, 422, { targets: msg }, undefined, req.nextUrl.pathname)
      }
    }

    try {
      // إعادة استخدام مهمة قابلة للتحرير للمود نفسه، وإلا مهمة جديدة.
      const reusable = await db.socialScheduleProject.findFirst({
        where: { modId: data.modId, status: { in: ['draft', 'scheduled'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true },
      })

      let projectId: string
      if (reusable) {
        await updateScheduleProject(reusable.id, {
          mode: data.mode,
          sitePublishAt: data.sitePublishAt,
          socialPublishAt: data.socialPublishAt,
          targets: snapshots,
        })
        projectId = reusable.id
      } else {
        const created = await createScheduleProject({
          modId: data.modId,
          mode: data.mode,
          sitePublishAt: data.sitePublishAt,
          socialPublishAt: data.socialPublishAt,
          targets: snapshots,
          createdById: user.id,
          status: 'draft',
        })
        projectId = created?.id as string
      }

      const project = await activateScheduleProject(projectId, user.id)

      await logAction({
        userId: user.id,
        username: user.username,
        action: 'SCHEDULE_PROJECT_CREATED',
        entity: 'social_schedule_project',
        entityId: projectId,
        details: JSON.stringify({ modId: data.modId, mode: data.mode, via: 'creator' }),
        request: req,
      })

      return ok({ project })
    } catch (err) {
      if (err instanceof ScheduleProjectError) {
        return knownErrorResponse(err, req.nextUrl.pathname)
      }
      throw err
    }
  } catch (err) {
    logger.error('[creator/schedule-projects POST] failed:', err)
    return internalError('تعذّرت جدولة النشر')
  }
}
