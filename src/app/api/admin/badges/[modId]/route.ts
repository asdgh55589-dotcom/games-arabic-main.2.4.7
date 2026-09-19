import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { logBadgeChange, parseHiddenBadges } from '@/lib/badges'
import { db } from '@/lib/db'

type BadgeName = 'featured' | 'trending' | 'popular'
type Op = 'grant' | 'revoke' | 'hide' | 'show' | 'reset-counter'

interface BadgeOpBody {
  op?: Op
  badge?: BadgeName
  level?: number
  durationDays?: number
  durationHours?: number
}

const HOUR_MS = 60 * 60 * 1000

// PUT /api/admin/badges/[modId] — تحكم كامل بالأدمن في شارات الأداء فقط.
// شارات الوقت نظامية ولا يمكن التحكم بها من هنا.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ modId: string }> },
) {
  try {
    const user = await requireModerator()
    const { modId } = await params
    const body = (await req.json().catch(() => ({}))) as BadgeOpBody
    const { op } = body

    const mod = await db.mod.findUnique({
      where: { id: modId },
      select: {
        id: true,
        name: true,
        featuredLevel: true,
        featuredUntil: true,
        trendingUntil: true,
        popularUntil: true,
        hiddenBadges: true,
        downloads: true,
      },
    })
    if (!mod) return notFound('Mod not found')

    const now = new Date()
    const audit = (action: string, oldValue?: string | null, newValue?: string | null) =>
      logBadgeChange(db, { modId, action, oldValue, newValue, changedById: user.id })

    // ---- Reset download counter ----
    if (op === 'reset-counter') {
      const old = String(mod.downloads)
      await db.mod.update({
        where: { id: modId },
        data: { downloads: 0, dailyDownloads: 0, lastDownloadDate: now },
      })
      await audit('RESET_COUNTER', old, '0')
      return ok({ ok: true })
    }

    const badge = body.badge
    if (!badge || !['featured', 'trending', 'popular'].includes(badge)) {
      return validationFail('badge must be featured|trending|popular')
    }

    // ---- Hide / show performance badge ----
    if (op === 'hide' || op === 'show') {
      const hidden = parseHiddenBadges(mod.hiddenBadges)
      const before = mod.hiddenBadges || ''
      if (op === 'hide') hidden.add(badge)
      else hidden.delete(badge)
      const after = [...hidden].join(',')
      await db.mod.update({ where: { id: modId }, data: { hiddenBadges: after } })
      await audit(op === 'hide' ? 'HIDE' : 'SHOW', before, after)
      return ok({ ok: true, hiddenBadges: after })
    }

    // ---- Revoke ----
    if (op === 'revoke') {
      if (badge === 'featured') {
        await db.mod.update({
          where: { id: modId },
          data: { featuredLevel: null, featuredUntil: null, isFeatured: false },
        })
        await audit(
          'REVOKE_FEATURED',
          `level=${mod.featuredLevel ?? '-'} until=${mod.featuredUntil?.toISOString() ?? '-'}`,
          'none',
        )
      } else if (badge === 'trending') {
        await db.mod.update({
          where: { id: modId },
          data: { trendingUntil: null, isTrending: false },
        })
        await audit(
          'REVOKE_TRENDING',
          `until=${mod.trendingUntil?.toISOString() ?? '-'}`,
          'none',
        )
      } else {
        await db.mod.update({ where: { id: modId }, data: { popularUntil: null } })
        await audit(
          'REVOKE_POPULAR',
          `until=${mod.popularUntil?.toISOString() ?? '-'}`,
          'none',
        )
      }
      return ok({ ok: true })
    }

    // ---- Grant ----
    if (op === 'grant') {
      if (badge === 'featured') {
        const level = Math.floor(Number(body.level))
        const durationDays = Number(body.durationDays)
        if (!(level >= 1 && level <= 5) || !(durationDays > 0 && durationDays <= 30)) {
          return validationFail('level must be 1-5 and durationDays 1-30')
        }
        const until = new Date(now.getTime() + durationDays * 24 * HOUR_MS)
        await db.mod.update({
          where: { id: modId },
          data: { featuredLevel: level, featuredUntil: until, isFeatured: true },
        })
        await audit(
          'GRANT_FEATURED',
          `level=${mod.featuredLevel ?? '-'} until=${mod.featuredUntil?.toISOString() ?? '-'}`,
          `level=${level} until=${until.toISOString()}`,
        )
        return ok({ ok: true, featuredLevel: level, featuredUntil: until.toISOString() })
      }
      // trending / popular
      const durationHours = Number(body.durationHours)
      if (!(durationHours > 0 && durationHours <= 24 * 30)) {
        return validationFail('durationHours must be 1-720')
      }
      const until = new Date(now.getTime() + durationHours * HOUR_MS)
      if (badge === 'trending') {
        await db.mod.update({
          where: { id: modId },
          data: { trendingUntil: until, isTrending: true },
        })
        await audit(
          'GRANT_TRENDING',
          `until=${mod.trendingUntil?.toISOString() ?? '-'}`,
          `until=${until.toISOString()}`,
        )
      } else {
        await db.mod.update({ where: { id: modId }, data: { popularUntil: until } })
        await audit(
          'GRANT_POPULAR',
          `until=${mod.popularUntil?.toISOString() ?? '-'}`,
          `until=${until.toISOString()}`,
        )
      }
      return ok({ ok: true, until: until.toISOString() })
    }

    return validationFail('op must be grant|revoke|hide|show|reset-counter')
  } catch (err) {
    console.error('[admin badges PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to update badges')
  }
}
