import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import {
  DEFAULT_FEATURED_TIERS,
  DEFAULT_POPULAR_THRESHOLD,
  DEFAULT_TRENDING_THRESHOLD,
  logBadgeChange,
  normalizeTiers,
  resolveBadgeSettings,
  type FeaturedTier,
} from '@/lib/badges'
import { db } from '@/lib/db'

// GET /api/admin/badges/settings — الإعدادات الحالية مدمجة مع الافتراضي
export async function GET() {
  try {
    await requireModerator()
    const row = await db.badgeSettings.findUnique({ where: { id: 'default' } })
    const resolved = resolveBadgeSettings(row)
    return ok({
      settings: {
        trendingThreshold: resolved.trendingThreshold,
        popularThreshold: resolved.popularThreshold,
        featuredTiers: resolved.featuredTiers,
        badgesEnabled: resolved.badgesEnabled,
        // للعرض فقط — نظامية ولا تُعدَّل
        newDurationHours: row?.newDurationHours ?? 48,
        updatedDurationHours: row?.updatedDurationHours ?? 24,
      },
      defaults: {
        trendingThreshold: DEFAULT_TRENDING_THRESHOLD,
        popularThreshold: DEFAULT_POPULAR_THRESHOLD,
        featuredTiers: DEFAULT_FEATURED_TIERS,
        newDurationHours: 48,
        updatedDurationHours: 24,
      },
    })
  } catch (err) {
    console.error('[admin badges settings GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to fetch badge settings')
  }
}

interface SettingsBody {
  trendingThreshold?: number
  popularThreshold?: number
  featuredTiers?: FeaturedTier[]
  badgesEnabled?: boolean
}

// PUT /api/admin/badges/settings — تحديث العتبات والمستويات.
// newDurationHours / updatedDurationHours نظامية — أي قيم مرسلة تُتجاهل.
export async function PUT(req: NextRequest) {
  try {
    const user = await requireModerator()
    const body = (await req.json().catch(() => ({}))) as SettingsBody

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (body.trendingThreshold !== undefined) {
      const v = Math.floor(Number(body.trendingThreshold))
      if (!(v >= 1 && v <= 100000)) return validationFail('trendingThreshold must be 1-100000')
      data.trendingThreshold = v
    }
    if (body.popularThreshold !== undefined) {
      const v = Math.floor(Number(body.popularThreshold))
      if (!(v >= 1 && v <= 100000)) return validationFail('popularThreshold must be 1-100000')
      data.popularThreshold = v
    }
    if (body.featuredTiers !== undefined) {
      if (!Array.isArray(body.featuredTiers) || body.featuredTiers.length > 10) {
        return validationFail('featuredTiers must be an array of max 10 tiers')
      }
      const tiers = (body.featuredTiers as unknown[]).map((t) => {
        const tier = t as Record<string, unknown>
        return {
          downloads: Math.floor(Number(tier.downloads)),
          durationDays: Math.floor(Number(tier.durationDays)),
        }
      })
      if (
        tiers.some(
          (t) =>
            !(t.downloads >= 1 && t.downloads <= 1000000) ||
            !(t.durationDays >= 1 && t.durationDays <= 30),
        )
      ) {
        return validationFail('each tier needs downloads 1-1000000 and durationDays 1-30')
      }
      // normalizeTiers يرتب ويسقط غير الصالح؛ نرفض إن لم يتبقَّ شيء
      const normalized = normalizeTiers(tiers)
      const looksValid = tiers.every(
        (t) => t.downloads >= 1 && t.durationDays >= 1,
      )
      if (!looksValid || normalized.length === 0) return validationFail('invalid tiers')
      data.featuredTiers = normalized
    }
    if (body.badgesEnabled !== undefined) {
      data.badgesEnabled = Boolean(body.badgesEnabled)
    }
    if (Object.keys(data).length === 0) return validationFail('nothing to update')

    const before = await db.badgeSettings.findUnique({ where: { id: 'default' } })
    const updated = await db.badgeSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })
    await logBadgeChange(db, {
      modId: 'settings',
      action: 'SETTINGS_UPDATE',
      oldValue: before ? JSON.stringify(before) : null,
      newValue: JSON.stringify(updated),
      changedById: user.id,
    })
    return ok({ ok: true })
  } catch (err) {
    console.error('[admin badges settings PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to update badge settings')
  }
}
