import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { canReadOwnReports } from '@/lib/permissions'
import { rateLimitMiddleware } from '@/lib/rate-limit'

// B1 — POST /api/creator/reports/[id]/appeal
// Creator follow-up on outcome-only reports targeting their own mods:
// appeal a terminal report (resolved / rejected / confirmed) back to
// `reopened` with a written reason. Read-only fields stay read-only —
// the reporter identity, evidence, IPs and fraud signals are never
// selected, and the appeal reason is stored as the history resolution.
const AppealSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, 'سبب الطعن مطلوب (10 أحرف على الأقل)')
      .max(1000, 'سبب الطعن طويل جداً (الحد الأقصى 1000 حرف)'),
  })
  .strict()

const APPEALABLE = ['resolved', 'rejected', 'confirmed'] as const

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return validationFail('يجب تسجيل الدخول')
  if (!canReadOwnReports(user.role)) {
    return forbidden('لا تملك صلاحية متابعة البلاغات')
  }

  // Flood guard: 5 appeals/hour per creator.
  const limited = await rateLimitMiddleware(req, {
    limit: 5,
    window: 3600,
    keyPrefix: `creator:report-appeal:${user.id}`,
  })
  if (limited) return limited

  const { id } = await params

  const body: unknown = await req.json().catch(() => null)
  const parsed = AppealSchema.safeParse(body)
  if (!parsed.success) {
    return validationFail(parsed.error.flatten())
  }

  try {
    // Scope FIRST: the report must target the caller's own mods
    // (directly, or via a comment on them) — same scope as the GET.
    const report = await db.report.findFirst({
      where: {
        id,
        OR: [{ targetMod: { authorId: user.id } }, { targetComment: { mod: { authorId: user.id } } }],
      },
      select: { id: true, status: true },
    })
    if (!report) return notFound('البلاغ غير موجود')

    if (!(APPEALABLE as readonly string[]).includes(report.status as string)) {
      return validationFail('يمكن الطعن في البلاغات المنتهية فقط (محسوم / مرفوض / مؤكد)')
    }

    const fromStatus = report.status as (typeof APPEALABLE)[number]
    await db.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: report.id },
        data: { status: 'reopened' },
      })
      await tx.reportStatusHistory.create({
        data: {
          reportId: report.id,
          fromStatus,
          toStatus: 'reopened',
          resolution: parsed.data.reason,
          actorId: user.id,
        },
      })
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'REPORT_APPEALED',
        entity: 'Report',
        entityId: report.id,
        details: JSON.stringify({ fromStatus }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/reports appeal] audit log failed')
    }

    return ok({ appeal: { reportId: report.id, status: 'reopened' }, message: 'تم إرسال الطعن — أُعيد فتح البلاغ للمراجعة' }, { status: 201 })
  } catch (err) {
    logger.error({ err }, '[creator/reports appeal POST] failed')
    const { internalError } = await import('@/lib/api-response')
    return internalError('فشل إرسال الطعن')
  }
}
