import type { NextRequest } from 'next/server'
import { forbidden, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { canReadOwnReports } from '@/lib/permissions'

const STATUSES = ['new', 'under_review', 'confirmed', 'rejected', 'pending', 'resolved', 'reopened'] as const

// GET /api/creator/reports?status=&page=&limit= — OUTCOME-ONLY follow-up.
// Scope: reports targeting the creator's mods (directly, or via comments on
// them). The response is an explicit allowlist — reporter identity,
// evidence, IPs, fraud signals, and assignees can NEVER leak (they are not
// even selected). History actors are anonymized (only the outcome shown).
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return validationFail('يجب تسجيل الدخول')
  if (!canReadOwnReports(user.role)) {
    return forbidden('لا تملك صلاحية قراءة البلاغات')
  }

  const params = new URL(req.url).searchParams
  const status = params.get('status') || 'all'
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1))
  const limit = Math.min(50, Math.max(1, Math.floor(Number(params.get('limit')) || 20)))

  if (status !== 'all' && !(STATUSES as readonly string[]).includes(status)) {
    return validationFail('الحالة غير صالحة')
  }

  const scope = {
    OR: [{ targetMod: { authorId: user.id } }, { targetComment: { mod: { authorId: user.id } } }],
  }
  const where: Record<string, unknown> = { ...scope }
  if (status !== 'all') where.status = status

  const [total, rows] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        targetType: true,
        reason: true,
        status: true,
        actionTaken: true,
        actionAt: true,
        resolution: true,
        resolvedAt: true,
        targetMod: { select: { id: true, name: true, slug: true } },
        targetComment: { select: { id: true, text: true, createdAt: true } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { toStatus: true, action: true, resolution: true, createdAt: true },
        },
      },
    }),
  ])

  // Explicit allowlist mapping — never spread DB rows.
  const reports = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    targetType: r.targetType,
    reason: r.reason,
    status: r.status,
    actionTaken: r.actionTaken,
    actionAt: r.actionAt,
    resolution: r.resolution,
    resolvedAt: r.resolvedAt,
    mod: r.targetMod
      ? { id: r.targetMod.id, name: r.targetMod.name, slug: r.targetMod.slug }
      : null,
    commentExcerpt:
      r.targetComment && typeof r.targetComment.text === 'string'
        ? r.targetComment.text.slice(0, 50)
        : null,
    latest: r.statusHistory[0]
      ? {
          toStatus: r.statusHistory[0].toStatus,
          action: r.statusHistory[0].action,
          resolution: r.statusHistory[0].resolution,
          createdAt: r.statusHistory[0].createdAt,
        }
      : null,
  }))

  return ok({
    reports,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  })
}
