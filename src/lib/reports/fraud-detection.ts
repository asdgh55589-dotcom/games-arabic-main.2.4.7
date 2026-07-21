import { db } from '@/lib/db'

interface FraudSignal {
  signalType: string
  score: number
  description: string
}

async function checkLowTrustReporter(reporterId: string): Promise<FraudSignal | null> {
  const trustScore = await db.userTrustScore.findUnique({
    where: { userId: reporterId },
    select: { score: true },
  })

  if (!trustScore || trustScore.score >= 20) return null

  return {
    signalType: 'low_trust_reporter',
    score: 0.8,
    description: `نقاط ثقة المبلّغ منخفضة (${trustScore.score}/100)`,
  }
}

async function checkDuplicatePattern(reporterId: string, targetType: string, targetModId: string | null, targetCommentId: string | null, targetUserId: string | null): Promise<FraudSignal | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    reporterId,
    createdAt: { gte: thirtyDaysAgo },
  }

  if (targetType === 'mod' && targetModId) where.targetModId = targetModId
  else if (targetType === 'comment' && targetCommentId) where.targetCommentId = targetCommentId
  else if (targetType === 'user' && targetUserId) where.targetUserId = targetUserId

  const count = await db.report.count({ where })

  if (count < 2) return null

  return {
    signalType: 'duplicate_pattern',
    score: 0.9,
    description: `المبلّغ قدّم ${count} بلاغات ضدّ نفس الهدف في آخر 30 يوم`,
  }
}

async function checkTargetHarassment(targetModId: string | null, targetCommentId: string | null, targetUserId: string | null): Promise<FraudSignal | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    status: 'rejected',
    createdAt: { gte: thirtyDaysAgo },
  }

  if (targetModId) where.targetModId = targetModId
  else if (targetCommentId) where.targetCommentId = targetCommentId
  else if (targetUserId) where.targetUserId = targetUserId
  else return null

  const count = await db.report.count({ where })

  if (count < 3) return null

  return {
    signalType: 'target_harassment',
    score: 0.85,
    description: `تلقّى الهدف ${count} بلاغات مرفوضة في آخر 30 يوم — احتمال مضايقة`,
  }
}

async function checkTimingAnomaly(ipAddress: string | null): Promise<FraudSignal | null> {
  if (!ipAddress) return null

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

  const count = await db.report.count({
    where: {
      ipAddress,
      createdAt: { gte: tenMinutesAgo },
    },
  })

  if (count < 5) return null

  return {
    signalType: 'timing_anomaly',
    score: 0.7,
    description: `تم إرسال ${count} بلاغات من نفس الـ IP في آخر 10 دقائق`,
  }
}

async function checkSameTargetSwarm(targetModId: string | null, targetCommentId: string | null, targetUserId: string | null): Promise<FraudSignal | null> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    createdAt: { gte: twentyFourHoursAgo },
  }

  if (targetModId) where.targetModId = targetModId
  else if (targetCommentId) where.targetCommentId = targetCommentId
  else if (targetUserId) where.targetUserId = targetUserId
  else return null

  const distinctReporters = await db.report.findMany({
    where,
    select: { reporterId: true },
    distinct: ['reporterId'],
  })

  if (distinctReporters.length < 3) return null

  return {
    signalType: 'same_target_swarm',
    score: 0.6,
    description: `${distinctReporters.length} مبلّغين مختلفين بلّغوا نفس الهدف في آخر 24 ساعة`,
  }
}

export async function analyzeReportFraud(reportId: string): Promise<void> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      reporterId: true,
      targetType: true,
      targetModId: true,
      targetCommentId: true,
      targetUserId: true,
      ipAddress: true,
    },
  })

  if (!report || !report.reporterId) return

  const signals: FraudSignal[] = []

  const [
    lowTrust,
    duplicate,
    harassment,
    timing,
    swarm,
  ] = await Promise.all([
    checkLowTrustReporter(report.reporterId),
    checkDuplicatePattern(report.reporterId, report.targetType, report.targetModId, report.targetCommentId, report.targetUserId),
    checkTargetHarassment(report.targetModId, report.targetCommentId, report.targetUserId),
    checkTimingAnomaly(report.ipAddress),
    checkSameTargetSwarm(report.targetModId, report.targetCommentId, report.targetUserId),
  ])

  if (lowTrust) signals.push(lowTrust)
  if (duplicate) signals.push(duplicate)
  if (harassment) signals.push(harassment)
  if (timing) signals.push(timing)
  if (swarm) signals.push(swarm)

  // Save signals to DB
  for (const signal of signals) {
    await db.reportFraudSignal.create({
      data: {
        reportId,
        signalType: signal.signalType,
        score: signal.score,
        description: signal.description,
      },
    })
  }

  // Calculate average fraud score
  const fraudScore = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.score, 0) / signals.length
    : 0

  await db.report.update({
    where: { id: reportId },
    data: { fraudScore },
  })
}
