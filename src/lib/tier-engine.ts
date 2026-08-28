import { db } from '@/lib/db'
import { Mod } from '@prisma/client'
import { getUseCases } from '@/application/use-cases/factory'

function calculateQualityScore(mods: Mod[]): number {
  if (mods.length === 0) return 0
  const avgRating = mods.reduce((s, m) => s + m.rating, 0) / mods.length
  const avgDownloads = mods.reduce((s, m) => s + m.downloads, 0) / mods.length
  const avgEndorsements = mods.reduce((s, m) => s + m.endorsements, 0) / mods.length
  return (avgRating * 20) + (Math.log10(avgDownloads + 1) * 10) + (avgEndorsements * 0.5)
}

export async function checkAndUpgradeTier(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { mods: true }
  })

  if (!user) return { upgraded: false }

  const stats = {
    modCount: user.mods.length,
    totalDownloads: user.mods.reduce((s, m) => s + m.downloads, 0),
    avgRating: user.mods.filter(m => m.ratingCount > 0).length > 0
      ? user.mods.filter(m => m.ratingCount > 0).reduce((s, m) => s + m.rating, 0) /
        user.mods.filter(m => m.ratingCount > 0).length
      : 0,
    qualityScore: calculateQualityScore(user.mods)
  }

  const rules = await db.tierRule.findMany({
    orderBy: { tier: 'desc' }
  })

  for (const rule of rules) {
    if (stats.modCount >= rule.requiredMods &&
        stats.totalDownloads >= rule.requiredDownloads &&
        stats.avgRating >= rule.requiredRating &&
        stats.qualityScore >= rule.requiredQualityScore) {
      if (user.tier < rule.tier) {
        await upgradeUser(userId, rule.tier, 'auto')
        return { upgraded: true, newTier: rule.tier }
      }
      break
    }
  }

  return { upgraded: false }
}

export async function upgradeUser(userId: string, newTier: number, reason: 'auto' | 'manual' | 'admin', triggeredBy?: string, notes?: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return

  const fromTier = user.tier

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        tier: newTier,
        lastTierUpgradeAt: new Date(),
        tierUpgradeCount: { increment: 1 }
      }
    }),
    db.tierHistory.create({
      data: {
        userId,
        fromTier,
        toTier: newTier,
        reason,
        triggeredBy,
        notes
      }
    })
  ])

  const tierNames: Record<number, string> = {
    0: 'مبتدئ', 1: 'مترجم', 2: 'محترف', 3: 'خبير', 4: 'مشرف', 5: 'مدير'
  }

  try {
    const useCases = getUseCases()
    await useCases.sendTierUpgrade.execute({
      userId,
      fromTier,
      fromTierName: tierNames[fromTier] || `المستوى ${fromTier}`,
      toTier: newTier,
      toTierName: tierNames[newTier] || `المستوى ${newTier}`,
      reason,
    })
  } catch {}
}

export async function revokeTier(userId: string, revokedBy: string, reason?: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return

  const fromTier = user.tier

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { tier: 0 }
    }),
    db.tierHistory.create({
      data: {
        userId,
        fromTier,
        toTier: 0,
        reason: 'admin',
        triggeredBy: revokedBy,
        notes: reason || 'تم سحب الترقية'
      }
    })
  ])
}
