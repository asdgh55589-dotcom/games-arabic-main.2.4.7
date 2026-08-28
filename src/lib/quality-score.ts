import { db } from './db'

export interface QualityMetrics {
  hasDescription: boolean
  hasStory: boolean
  screenshotCount: number
  hasReasonableFileSize: boolean
  averageRating: number
  ratingCount: number
  teamReputation: number
  totalScore: number
  breakdown: {
    description: number
    story: number
    screenshots: number
    fileSize: number
    rating: number
    teamReputation: number
  }
}

export async function calculateQualityScore(modId: string): Promise<number> {
  const metrics = await getQualityMetrics(modId)
  return metrics.totalScore
}

export async function getQualityMetrics(modId: string): Promise<QualityMetrics> {
  const mod = await db.mod.findUnique({
    where: { id: modId },
    select: {
      description: true,
      summary: true,
      galleryUrls: true,
      fileSize: true,
      qualityRating: true,
      qualityRatingsCount: true,
      qualityRatingsTotal: true,
      teamId: true,
      teamRelation: {
        select: {
          id: true,
          modCount: true,
        },
      },
    },
  })

  if (!mod) {
    return {
      hasDescription: false,
      hasStory: false,
      screenshotCount: 0,
      hasReasonableFileSize: false,
      averageRating: 0,
      ratingCount: 0,
      teamReputation: 0,
      totalScore: 0,
      breakdown: {
        description: 0,
        story: 0,
        screenshots: 0,
        fileSize: 0,
        rating: 0,
        teamReputation: 0,
      },
    }
  }

  // Description: +10
  const hasDescription = (mod.description?.length || 0) > 50
  const descriptionScore = hasDescription ? 10 : 0

  // Story/summary: +10
  const hasStory = (mod.summary?.length || 0) > 20
  const storyScore = hasStory ? 10 : 0

  // Screenshots: +20 max (4 per screenshot)
  const screenshotUrls = mod.galleryUrls
    ? mod.galleryUrls.split(',').filter((u) => u.trim())
    : []
  const screenshotCount = Math.min(screenshotUrls.length, 5)
  const screenshotScore = screenshotCount * 4

  // File size reasonable (+10): between 1MB and 2GB
  const fileSizeStr = mod.fileSize || ''
  let fileSizeBytes = 0
  if (fileSizeStr.includes('GB')) {
    fileSizeBytes = parseFloat(fileSizeStr) * 1024 * 1024 * 1024
  } else if (fileSizeStr.includes('MB')) {
    fileSizeBytes = parseFloat(fileSizeStr) * 1024 * 1024
  } else if (fileSizeStr.includes('KB')) {
    fileSizeBytes = parseFloat(fileSizeStr) * 1024
  }
  const hasReasonableFileSize = fileSizeBytes >= 1024 * 1024 && fileSizeBytes <= 2 * 1024 * 1024 * 1024
  const fileSizeScore = hasReasonableFileSize ? 10 : 0

  // Rating: up to +50 (average * 10)
  const averageRating = mod.qualityRatingsCount > 0
    ? mod.qualityRatingsTotal / mod.qualityRatingsCount
    : 0
  const ratingScore = Math.round(averageRating * 10)

  // Team reputation: up to +20 (based on team's published mods)
  let teamReputation = 0
  if (mod.teamId) {
    const teamMods = await db.mod.count({
      where: {
        teamId: mod.teamId,
        workflowStatus: 'PUBLISHED',
      },
    })
    teamReputation = Math.min(20, Math.round((teamMods / 10) * 20))
  }
  const teamReputationScore = teamReputation

  const totalScore = Math.min(100,
    descriptionScore + storyScore + screenshotScore +
    fileSizeScore + ratingScore + teamReputationScore
  )

  return {
    hasDescription,
    hasStory,
    screenshotCount,
    hasReasonableFileSize,
    averageRating,
    ratingCount: mod.qualityRatingsCount,
    teamReputation,
    totalScore,
    breakdown: {
      description: descriptionScore,
      story: storyScore,
      screenshots: screenshotScore,
      fileSize: fileSizeScore,
      rating: ratingScore,
      teamReputation: teamReputationScore,
    },
  }
}

/** Auto-update quality score on mod create/update */
export async function updateModQualityScore(modId: string): Promise<void> {
  const score = await calculateQualityScore(modId)
  await db.mod.update({
    where: { id: modId },
    data: { qualityScore: score },
  })
}
