import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { upgradeUser } from '@/lib/tier-engine'
import { ok, internalError, notFound, validationFail } from '@/lib/api-response'
import { getMaxTierForRole } from '@/lib/tiers'
import type { UserRole } from '@/lib/roles'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const { tier, notes } = body

    if (typeof tier !== 'number' || tier < 0 || tier > 5) {
      return validationFail({ message: 'مستوى غير صالح' })
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }

    await upgradeUser(id, tier, 'admin', admin.id, notes)

    return ok({ message: `تم ترقية ${user.username} إلى المستوى ${tier}` })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const user = await db.user.findUnique({ where: { id } })
    if (!user) return notFound('المستخدم غير موجود')

    const body = await request.json()
    const { tier, reason } = body as { tier?: number; reason?: string }
    const maxTier = getMaxTierForRole(user.role as UserRole)

    if (typeof tier !== 'number' || tier < 0 || tier > maxTier) {
      return validationFail(`المستوى يجب أن يكون بين 0 و ${maxTier} لهذا الدور (${user.role})`)
    }

    const oldTier = user.tier

    await db.$transaction([
      db.user.update({
        where: { id },
        data: {
          tier,
          lastTierUpgradeAt: new Date(),
          tierUpgradeCount: { increment: tier > oldTier ? 1 : 0 },
        },
      }),
      db.tierHistory.create({
        data: {
          userId: id,
          fromTier: oldTier,
          toTier: tier,
          reason: 'manual',
          triggeredBy: admin.id,
          notes: reason || null,
        },
      }),
    ])

    // سجل تدقيق (اختياري)
    try {
      const { logUserAction } = await import('@/lib/audit')
      await logUserAction({
        userId: id,
        actorId: admin.id,
        action: 'TIER_MANUAL_SET',
        details: JSON.stringify({ oldTier, newTier: tier, reason }),
      } as unknown as Parameters<typeof logUserAction>[0])
    } catch {}

    // إشعار المستخدم
    try {
      await db.notification.create({
        data: {
          userId: id,
          actorId: admin.id,
          type: 'tier_upgrade',
          title: tier > oldTier ? '🎉 تم ترقيتك!' : 'ℹ️ تحديث مستواك',
          message: `قامت الإدارة بتحديث مستواك من ${oldTier} إلى ${tier}. ${reason ? `السبب: ${reason}` : ''}`,
          data: { oldTier, newTier: tier, reason: reason || null },
        },
      })
    } catch (e) {
      console.error('[tier PATCH notify] failed:', e)
    }

    return ok({ success: true, oldTier, newTier: tier })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) return internalError('غير مصرح')
    console.error('[tier PATCH] failed:', err)
    return internalError('خطأ في الخادم')
  }
}
