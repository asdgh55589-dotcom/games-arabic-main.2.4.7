import { type NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import type { UserRole } from '@/lib/roles'
import { calculateUserTier } from '@/lib/tier-engine'
import { getTierLabel } from '@/lib/tiers'

export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  const eligibleRoles: UserRole[] = ['creator', 'publisher', 'moderator']

  const users = await db.user.findMany({
    where: { role: { in: eligibleRoles } },
    select: { id: true, role: true, tier: true },
  })

  let promoted = 0
  let notified = 0

  for (const user of users) {
    try {
      const result = await calculateUserTier(user.id)

      if (result.shouldUpgrade && !result.requiresAdminApproval) {
        const oldTier = user.tier
        const newTier = result.suggestedTier

        await db.$transaction([
          db.user.update({
            where: { id: user.id },
            data: {
              tier: newTier,
              lastTierUpgradeAt: new Date(),
              tierUpgradeCount: { increment: 1 },
            },
          }),
          db.tierHistory.create({
            data: {
              userId: user.id,
              fromTier: oldTier,
              toTier: newTier,
              reason: 'auto',
            },
          }),
        ])

        // Create notification
        const tierLabel = getTierLabel(user.role, newTier)
        try {
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'tier_upgrade',
              title: '🎉 ترقية مستوى!',
              message: `تهانينا! تم ترقيتك إلى "${tierLabel}". استمتع بالمزايا الجديدة!`,
              data: { fromTier: oldTier, toTier: newTier, tierLabel },
            },
          })
          notified++
        } catch (e) {
          console.error(`[TierPromotion] notify failed for ${user.id}:`, e)
        }

        promoted++
      }
    } catch (error) {
      console.error(`[TierPromotion] Failed for user ${user.id}:`, error)
    }
  }

  return NextResponse.json({
    processed: users.length,
    promoted,
    notified,
  })
}
