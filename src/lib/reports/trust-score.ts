import { db } from '@/lib/db'

const TRUST_TIERS = {
  suspicious: { min: 0, max: 20, label: 'مُشكوك' },
  normal: { min: 21, max: 40, label: 'عادي' },
  trusted: { min: 41, max: 60, label: 'موثوق' },
  highlyTrusted: { min: 61, max: 80, label: 'موثوق جداً' },
  fullyTrusted: { min: 81, max: 100, label: 'موثوق بالكامل' },
} as const

export function getTrustTier(score: number): string {
  if (score <= 20) return TRUST_TIERS.suspicious.label
  if (score <= 40) return TRUST_TIERS.normal.label
  if (score <= 60) return TRUST_TIERS.trusted.label
  if (score <= 80) return TRUST_TIERS.highlyTrusted.label
  return TRUST_TIERS.fullyTrusted.label
}

export async function recalculateTrustScore(userId: string): Promise<void> {
  // Count reports filed by this user
  const [totalReports, confirmedReports, rejectedReports] = await Promise.all([
    db.report.count({ where: { reporterId: userId } }),
    db.report.count({ where: { reporterId: userId, status: 'confirmed' } }),
    db.report.count({ where: { reporterId: userId, status: 'rejected' } }),
  ])

  // Count reports received against this user's content
  const [reportsReceived, reportsReceivedConfirmed] = await Promise.all([
    db.report.count({ where: { targetUserId: userId } }),
    db.report.count({ where: { targetUserId: userId, status: 'confirmed' } }),
  ])

  // Calculate base score
  let score = 50

  // Filing accuracy: confirmed reports boost score, rejected reduce it
  if (totalReports > 0) {
    const accuracy = confirmedReports / totalReports
    score += Math.round((accuracy - 0.5) * 40) // -20 to +20 range
  }

  // Volume penalty: filing many reports without accuracy reduces score
  if (totalReports > 10 && confirmedReports < totalReports * 0.3) {
    score -= 10
  }

  // Receiving confirmed reports: user's content gets reported and confirmed
  if (reportsReceivedConfirmed >= 3) {
    score -= Math.min(reportsReceivedConfirmed * 3, 20) // -3 to -20
  }

  // Clamp
  score = Math.max(0, Math.min(100, score))

  const reportAccuracy = totalReports > 0 ? confirmedReports / totalReports : 0

  await db.userTrustScore.upsert({
    where: { userId },
    update: {
      score,
      reportAccuracy,
      totalReports,
      confirmedReports,
      rejectedReports,
      reportsReceived,
      reportsReceivedConfirmed,
    },
    create: {
      userId,
      score,
      reportAccuracy,
      totalReports,
      confirmedReports,
      rejectedReports,
      reportsReceived,
      reportsReceivedConfirmed,
    },
  })
}
