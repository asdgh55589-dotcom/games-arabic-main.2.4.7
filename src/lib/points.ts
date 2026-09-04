import { db } from './db'
import { logAction } from './audit'

export async function awardPoints(
  teamId: string,
  points: number,
  reason: string,
  referenceType?: string,
  referenceId?: string,
): Promise<{ newTotal: number; newLevel: number; leveledUp: boolean }> {
  const existing = await db.teamPoints.findUnique({ where: { teamId } })

  const oldLevel = existing?.level || 1
  const newTotal = (existing?.points || 0) + points
  const newLevel = calculateLevel(newTotal)
  const leveledUp = newLevel > oldLevel

  if (existing) {
    await db.teamPoints.update({
      where: { teamId },
      data: { points: newTotal, level: newLevel, lastUpdated: new Date() },
    })
  } else {
    await db.teamPoints.create({
      data: { teamId, points: newTotal, level: newLevel },
    })
  }

  await db.pointsTransaction.create({
    data: {
      teamId,
      points,
      reason,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
    },
  })

  return { newTotal, newLevel, leveledUp }
}

export async function deductPoints(
  teamId: string,
  points: number,
  reason: string,
  referenceType?: string,
  referenceId?: string,
): Promise<{ newTotal: number; newLevel: number }> {
  const existing = await db.teamPoints.findUnique({ where: { teamId } })
  const newTotal = Math.max(0, (existing?.points || 0) - points)
  const newLevel = calculateLevel(newTotal)

  if (existing) {
    await db.teamPoints.update({
      where: { teamId },
      data: { points: newTotal, level: newLevel, lastUpdated: new Date() },
    })
  }

  await db.pointsTransaction.create({
    data: {
      teamId,
      points: -points,
      reason,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
    },
  })

  return { newTotal, newLevel }
}

export function calculateLevel(points: number): number {
  return Math.floor(Math.sqrt(points / 500)) + 1
}

export function getLevelInfo(level: number): {
  name: string
  nameAr: string
  minPoints: number
  nextPoints: number
} {
  const levels = [
    { name: 'Beginner', nameAr: 'مبتدئ', minPoints: 0 },
    { name: 'Translator', nameAr: 'مترجم', minPoints: 500 },
    { name: 'Professional', nameAr: 'محترف', minPoints: 1500 },
    { name: 'Expert', nameAr: 'خبير', minPoints: 3000 },
    { name: 'Master', nameAr: 'مشرف', minPoints: 5000 },
    { name: 'Legend', nameAr: 'أسطورة', minPoints: 8000 },
  ]

  const current = levels[Math.min(level - 1, levels.length - 1)]
  const next = levels[Math.min(level, levels.length - 1)]

  return {
    name: current.name,
    nameAr: current.nameAr,
    minPoints: current.minPoints,
    nextPoints: next.minPoints,
  }
}

export async function getTeamPoints(teamId: string) {
  const points = await db.teamPoints.findUnique({ where: { teamId } })
  if (!points) {
    return {
      points: 0,
      level: 1,
      ...getLevelInfo(1),
      progress: 0,
      transactions: [],
    }
  }

  const levelInfo = getLevelInfo(points.level)
  const progress =
    levelInfo.nextPoints > levelInfo.minPoints
      ? ((points.points - levelInfo.minPoints) / (levelInfo.nextPoints - levelInfo.minPoints)) * 100
      : 100

  const transactions = await db.pointsTransaction.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return {
    ...points,
    ...levelInfo,
    progress: Math.min(progress, 100),
    transactions,
  }
}
