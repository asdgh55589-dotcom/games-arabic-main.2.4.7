import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, unauthorized, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { canManageTeam, getTeamRole } from '@/lib/team-permissions'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { z } from 'zod'

const RangeSchema = z
  .object({
    range: z.enum(['7d', '30d', '90d', '1y', 'custom']).optional().default('30d'),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .strict()

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  // Formula-safe: prefix with apostrophe if starts with =,+,-,@
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-stats-export:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'view_stats')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const parsed = RangeSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()))
    if (!parsed.success) return validationFail(parsed.error.flatten())

    const { range, dateFrom, dateTo } = parsed.data
    const now = new Date()
    let from: Date
    let to: Date
    if (range === 'custom' && dateFrom && dateTo) {
      from = new Date(dateFrom)
      to = new Date(dateTo)
    } else {
      to = now
      const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30
      from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    }

    const mods = await db.mod.findMany({
      where: { teamId: owned.id },
      select: {
        id: true, name: true, slug: true, workflowStatus: true, downloads: true,
        endorsements: true, rating: true, qualityScore: true, createdAt: true,
      },
      orderBy: { downloads: 'desc' },
    })

    const header = ['ID', 'Name', 'Slug', 'Status', 'Downloads', 'Endorsements', 'Rating', 'Quality', 'CreatedAt']
    const rows = mods.map((m) => [
      m.id, m.name, m.slug, m.workflowStatus, m.downloads, m.endorsements,
      m.rating, m.qualityScore, m.createdAt.toISOString(),
    ])

    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="team-stats-${range}.csv"`,
      },
    })
  } catch (err) {
    logger.error({ err }, '[creator/team/stats/export GET] failed')
    return internalError('فشل تصدير الإحصائيات')
  }
}
