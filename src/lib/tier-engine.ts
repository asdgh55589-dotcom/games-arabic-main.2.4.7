import { db } from '@/lib/db'
import { Mod } from '@prisma/client'
import { getUseCases } from '@/application/use-cases/factory'
import { getRequirementsForRole, type TierRequirement } from '@/lib/tier-requirements'
import { getMaxTierForRole } from '@/lib/tiers'
import type { UserRole } from '@/lib/roles'

function calculateQualityScore(mods: Mod[]): number {
  if (mods.length === 0) return 0
  const avgRating = mods.reduce((s, m) => s + m.rating, 0) / mods.length
  const avgDownloads = mods.reduce((s, m) => s + m.downloads, 0) / mods.length
  const avgEndorsements = mods.reduce((s, m) => s + m.endorsements, 0) / mods.length
  return avgRating * 20 + Math.log10(avgDownloads + 1) * 10 + avgEndorsements * 0.5
}

export interface TierCalculationResult {
  currentTier: number
  suggestedTier: number
  shouldUpgrade: boolean
  requiresAdminApproval: boolean
  progress: {
    publishedCount: number
    averageRating: number
    reviewsCount: number
    monthsActive: number
  }
  nextTierRequirements: TierRequirement | null
}

export async function calculateUserTier(userId: string): Promise<TierCalculationResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      mods: {
        where: { workflowStatus: 'PUBLISHED' },
        select: { id: true, rating: true, ratingCount: true, downloads: true, endorsements: true } as unknown as { id: true; rating: true; ratingCount: true; downloads: true; endorsements: true },
      },
    },
  })

  if (!user) {
    return {
      currentTier: 0,
      suggestedTier: 0,
      shouldUpgrade: false,
      requiresAdminApproval: false,
      progress: { publishedCount: 0, averageRating: 0, reviewsCount: 0, monthsActive: 0 },
      nextTierRequirements: null,
    }
  }

  const role = user.role as UserRole
  const maxTier = getMaxTierForRole(role)
  const requirements = getRequirementsForRole(role)

  // For member/owner (fixed tier) — no progression
  if (role === 'member' || role === 'owner') {
    return {
      currentTier: user.tier,
      suggestedTier: user.tier,
      shouldUpgrade: false,
      requiresAdminApproval: false,
      progress: { publishedCount: 0, averageRating: 0, reviewsCount: 0, monthsActive: 0 },
      nextTierRequirements: null,
    }
  }

  // Calculate stats
  const publishedMods = (user as unknown as { mods: Array<{ rating: number; ratingCount: number }> }).mods
  const publishedCount = publishedMods.length
  const ratedMods = publishedMods.filter((m) => m.ratingCount > 0)
  const averageRating = ratedMods.length > 0 ? ratedMods.reduce((sum, m) => sum + (m.rating || 0), 0) / ratedMods.length : 0

  // reviewsCount for moderator: count workflow changes (reviews)
  let reviewsCount = 0
  try {
    reviewsCount = await db.workflowEntry.count({ where: { changedBy: userId } })
  } catch {
    reviewsCount = 0
  }

  const monthsActive = Math.floor((Date.now() - new Date((user as unknown as { joinedAt: Date }).joinedAt || (user as unknown as { createdAt: Date }).createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))

  // Determine highest tier they qualify for
  let suggestedTier = user.tier
  // If user is at 0, start at 1 for progressive roles
  if (suggestedTier === 0 && requirements.some((r) => r.level === 1)) {
    suggestedTier = 1
  }
  let requiresAdminApproval = false

  for (const req of requirements) {
    if (req.level <= user.tier) continue
    let qualifies = true

    if (req.minPublishedCount !== undefined && publishedCount < req.minPublishedCount) {
      qualifies = false
    }
    if (req.minAverageRating !== undefined && averageRating + 1e-9 < req.minAverageRating) {
      qualifies = false
    }
    if (req.minReviewsCount !== undefined && reviewsCount < req.minReviewsCount) {
      qualifies = false
    }
    if (req.minMonthsActive !== undefined && monthsActive < req.minMonthsActive) {
      qualifies = false
    }

    if (qualifies) {
      if (!req.requiresAdminApproval) {
        if (req.level > suggestedTier) suggestedTier = req.level
      } else {
        requiresAdminApproval = true
      }
    }
  }

  suggestedTier = Math.min(suggestedTier, maxTier)

  // If no auto-qualifying tier beyond current, check if next tier requires approval (to show progress)
  const nextTier = requirements.find((r) => r.level === suggestedTier + 1) || requirements.find((r) => r.level > user.tier) || null

  return {
    currentTier: user.tier,
    suggestedTier,
    shouldUpgrade: suggestedTier > user.tier,
    requiresAdminApproval,
    progress: {
      publishedCount,
      averageRating,
      reviewsCount,
      monthsActive,
    },
    nextTierRequirements: nextTier,
  }
}

export async function checkAndUpgradeTier(userId: string) {
  // Legacy wrapper — now role-aware via calculateUserTier
  // For creator/publisher/moderator: use new logic
  // For others: fallback to TierRule generic (for backward compat)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, tier: true },
  })
  if (!user) return { upgraded: false }

  // Use role-aware for progressive roles
  if (['creator', 'publisher', 'moderator'].includes(user.role)) {
    const result = await calculateUserTier(userId)
    if (result.shouldUpgrade && !result.requiresAdminApproval) {
      await upgradeUser(userId, result.suggestedTier, 'auto')
      return { upgraded: true, newTier: result.suggestedTier }
    }
    return { upgraded: false }
  }

  // Fallback to generic TierRule for other roles (legacy)
  const fullUser = await db.user.findUnique({
    where: { id: userId },
    include: { mods: true },
  })
  if (!fullUser) return { upgraded: false }

  const stats = {
    modCount: fullUser.mods.length,
    totalDownloads: fullUser.mods.reduce((s, m) => s + m.downloads, 0),
    avgRating: fullUser.mods.filter((m) => m.ratingCount > 0).length > 0
      ? fullUser.mods.filter((m) => m.ratingCount > 0).reduce((s, m) => s + m.rating, 0) /
        fullUser.mods.filter((m) => m.ratingCount > 0).length
      : 0,
    qualityScore: calculateQualityScore(fullUser.mods),
  }

  const rules = await db.tierRule.findMany({
    orderBy: { tier: 'desc' },
  })

  for (const rule of rules) {
    if (
      stats.modCount >= rule.requiredMods &&
      stats.totalDownloads >= rule.requiredDownloads &&
      stats.avgRating >= rule.requiredRating &&
      stats.qualityScore >= rule.requiredQualityScore
    ) {
      if (fullUser.tier < rule.tier) {
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
        tierUpgradeCount: { increment: 1 },
      },
    }),
    db.tierHistory.create({
      data: {
        userId,
        fromTier,
        toTier: newTier,
        reason,
        triggeredBy,
        notes,
      },
    }),
  ])

  const tierNames: Record<number, string> = {
    0: 'مبتدئ',
    1: 'مترجم',
    2: 'محترف',
    3: 'خبير',
    4: 'مشرف',
    5: 'مدير',
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
      data: { tier: 0 },
    }),
    db.tierHistory.create({
      data: {
        userId,
        fromTier,
        toTier: 0,
        reason: 'admin',
        triggeredBy: revokedBy,
        notes: reason || 'تم سحب الترقية',
      },
    }),
  ])
}
