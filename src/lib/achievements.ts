import { db } from './db'
import { awardPoints } from './points'

export interface AchievementDefinition {
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  icon: string
  category: string
  points: number
  requirement: { type: string; value: number }
}

export const DEFAULT_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    name: 'First Mod',
    nameAr: 'أول تعريب',
    description: 'Publish your first mod',
    descriptionAr: 'نشر أول تعريب',
    icon: 'Rocket',
    category: 'milestone',
    points: 50,
    requirement: { type: 'mods_published', value: 1 },
  },
  {
    name: '10 Mods',
    nameAr: '10 تعريبات',
    description: 'Publish 10 mods',
    descriptionAr: 'نشر 10 تعريبات',
    icon: 'Package',
    category: 'milestone',
    points: 200,
    requirement: { type: 'mods_published', value: 10 },
  },
  {
    name: '50 Mods',
    nameAr: '50 تعريب',
    description: 'Publish 50 mods',
    descriptionAr: 'نشر 50 تعريباً',
    icon: 'Award',
    category: 'milestone',
    points: 500,
    requirement: { type: 'mods_published', value: 50 },
  },
  {
    name: '100 Mods',
    nameAr: '100 تعريب',
    description: 'Publish 100 mods',
    descriptionAr: 'نشر 100 تعريب',
    icon: 'Trophy',
    category: 'milestone',
    points: 1000,
    requirement: { type: 'mods_published', value: 100 },
  },
  {
    name: 'Quality Master',
    nameAr: 'سيّد الجودة',
    description: 'Average rating 4.5+',
    descriptionAr: 'متوسط تقييم 4.5 أو أعلى',
    icon: 'Star',
    category: 'quality',
    points: 300,
    requirement: { type: 'avg_rating', value: 4.5 },
  },
  {
    name: 'Community Favorite',
    nameAr: 'مفضل المجتمع',
    description: '100+ endorsements',
    descriptionAr: '100 تأييد أو أكثر',
    icon: 'Heart',
    category: 'community',
    points: 250,
    requirement: { type: 'total_endorsements', value: 100 },
  },
  {
    name: 'Speed Demon',
    nameAr: 'سريع كالبرق',
    description: 'Publish mod within 24h of game release',
    descriptionAr: 'نشر تعريب خلال 24 ساعة من إطلاق اللعبة',
    icon: 'Zap',
    category: 'production',
    points: 400,
    requirement: { type: 'speed_release', value: 24 },
  },
  {
    name: 'Consistency King',
    nameAr: 'ملك الاتساق',
    description: 'Publish mod every month for 6 months',
    descriptionAr: 'نشر تعريب شهرياً لمدة 6 أشهر',
    icon: 'Calendar',
    category: 'production',
    points: 600,
    requirement: { type: 'monthly_streak', value: 6 },
  },
  {
    name: 'Download Champion',
    nameAr: 'بطل التحميلات',
    description: '10,000+ total downloads',
    descriptionAr: '10,000 تحميل أو أكثر',
    icon: 'Download',
    category: 'milestone',
    points: 350,
    requirement: { type: 'total_downloads', value: 10000 },
  },
  {
    name: 'Team Player',
    nameAr: 'لاعب فريق',
    description: 'Collaborate with 3+ teams',
    descriptionAr: 'التعاون مع 3 فرق أو أكثر',
    icon: 'Users',
    category: 'community',
    points: 150,
    requirement: { type: 'team_collaborations', value: 3 },
  },
]

export async function ensureAchievementsExist(): Promise<void> {
  const count = await db.achievement.count()
  if (count > 0) return

  await db.achievement.createMany({
    data: DEFAULT_ACHIEVEMENTS.map((a) => ({
      ...a,
      requirement: JSON.stringify(a.requirement),
    })),
  })
}

export async function checkAndAwardAchievements(teamId: string): Promise<string[]> {
  await ensureAchievementsExist()

  const achievements = await db.achievement.findMany({ where: { isActive: true } })
  const earned = await db.teamAchievement.findMany({
    where: { teamId },
    select: { achievementId: true },
  })
  const earnedIds = new Set(earned.map((e) => e.achievementId))

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  })

  if (!team) return []

  const mods = await db.mod.findMany({
    where: { teamId },
    select: {
      teamId: true,
      workflowStatus: true,
      qualityRating: true,
      endorsements: true,
      downloads: true,
      createdAt: true,
      game: { select: { createdAt: true } },
    },
  })

  const publishedCount = mods.filter((m) => m.workflowStatus === 'PUBLISHED').length
  const totalEndorsements = mods.reduce((sum, m) => sum + (m.endorsements || 0), 0)
  const totalDownloads = mods.reduce((sum, m) => sum + (m.downloads || 0), 0)
  const avgRating =
    mods.length > 0
      ? mods
          .filter((m) => m.qualityRating && m.qualityRating > 0)
          .reduce((sum, m) => sum + (m.qualityRating || 0), 0) /
        Math.max(mods.filter((m) => m.qualityRating && m.qualityRating > 0).length, 1)
      : 0

  const newlyEarned: string[] = []

  for (const achievement of achievements) {
    if (earnedIds.has(achievement.id)) continue

    const req = JSON.parse(JSON.stringify(achievement.requirement)) as {
      type: string
      value: number
    }
    let qualifies = false

    switch (req.type) {
      case 'mods_published':
        qualifies = publishedCount >= req.value
        break
      case 'avg_rating':
        qualifies = avgRating >= req.value
        break
      case 'total_endorsements':
        qualifies = totalEndorsements >= req.value
        break
      case 'total_downloads':
        qualifies = totalDownloads >= req.value
        break
      // speed_release and monthly_streak are more complex — simplified check
      case 'speed_release':
        qualifies = mods.some((m) => {
          const gameRelease = m.game?.createdAt
          const modRelease = m.createdAt
          if (!gameRelease || !modRelease) return false
          const hoursDiff = (modRelease.getTime() - gameRelease.getTime()) / (1000 * 60 * 60)
          return hoursDiff <= req.value
        })
        break
      case 'monthly_streak': {
        const months = new Set<string>()
        mods.forEach((m) => {
          const d = new Date(m.createdAt)
          months.add(`${d.getFullYear()}-${d.getMonth()}`)
        })
        qualifies = months.size >= req.value
        break
      }
      case 'team_collaborations': {
        const teamIds = new Set<string>()
        mods.forEach((m) => {
          if (m.teamId && m.teamId !== teamId) teamIds.add(m.teamId)
        })
        qualifies = teamIds.size >= req.value
        break
      }
    }

    if (qualifies) {
      await db.teamAchievement.create({
        data: { teamId, achievementId: achievement.id },
      })
      newlyEarned.push(achievement.id)

      // Award points
      await awardPoints(
        teamId,
        achievement.points,
        `إنجاز: ${achievement.nameAr}`,
        'achievement',
        achievement.id,
      )
    }
  }

  return newlyEarned
}
