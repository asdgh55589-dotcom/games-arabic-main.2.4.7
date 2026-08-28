/**
 * lib/mod-quality.ts — Mod Quality Score Calculator
 *
 * Calculates a 0-100 quality score based on mod completeness.
 * Used for sorting, filtering, and display in the admin dashboard.
 */

interface ModData {
  name: string
  summary: string
  description: string
  arabicTitle: string
  translationScope: string
  compatibility: string
  tags: string
  changelog: string
  installGuide: string
  thumbnailUrl: string
  imageUrl: string
  galleryUrls: string
  files: Array<{ links: Array<{ url: string }> }>
  teamMembers: Array<{ name: string }>
  gameId: string
  teamId: string | null
}

/**
 * Calculate quality score for a mod (0-100).
 */
export function calculateModQualityScore(mod: ModData): number {
  let score = 0

  // 1. Has description (+15)
  if (mod.description && mod.description.trim().length > 0) {
    score += 15
    // Bonus for long description (+5 if > 500 chars)
    if (mod.description.length > 500) score += 5
  }

  // 2. Has summary (+10)
  if (mod.summary && mod.summary.trim().length > 0) {
    score += 10
  }

  // 3. Has Arabic title (+10)
  if (mod.arabicTitle && mod.arabicTitle.trim().length > 0) {
    score += 10
  }

  // 4. Has translation scope (+5)
  if (mod.translationScope && mod.translationScope.trim().length > 0) {
    score += 5
  }

  // 5. Has compatibility info (+5)
  if (mod.compatibility && mod.compatibility.trim().length > 0) {
    score += 5
  }

  // 6. Has tags (+5)
  if (mod.tags && mod.tags.split(',').filter(Boolean).length > 0) {
    score += 5
  }

  // 7. Has changelog (+5)
  if (mod.changelog && mod.changelog.trim().length > 0) {
    score += 5
  }

  // 8. Has install guide (+10)
  if (mod.installGuide && mod.installGuide.trim().length > 0) {
    score += 10
  }

  // 9. Has screenshots (+10 for first, +2 each extra, max 10)
  const galleryCount = mod.galleryUrls ? mod.galleryUrls.split(',').filter(Boolean).length : 0
  if (galleryCount > 0) {
    score += 10
    score += Math.min(galleryCount * 2, 10)
  }

  // 10. Has downloadable files (+10)
  if (mod.files && mod.files.length > 0) {
    score += 10
    // Bonus for multiple download links
    const totalLinks = mod.files.reduce((sum, f) => sum + (f.links?.length || 0), 0)
    if (totalLinks > 1) score += 5
  }

  // 11. Has team members (+10)
  if (mod.teamMembers && mod.teamMembers.length > 0) {
    score += 10
  }

  // 12. Has thumbnail and image (+5)
  if (mod.thumbnailUrl && mod.imageUrl) {
    score += 5
  }

  return Math.min(score, 100)
}

/**
 * Get quality label from score.
 */
export function getQualityLabel(score: number): string {
  if (score >= 80) return 'ممتاز'
  if (score >= 60) return 'جيد جداً'
  if (score >= 40) return 'جيد'
  if (score >= 20) return 'مقبول'
  return 'ضعيف'
}

/**
 * Get quality color class from score.
 */
export function getQualityColor(score: number): string {
  if (score >= 80) return 'text-green'
  if (score >= 60) return 'text-blue'
  if (score >= 40) return 'text-yellow'
  if (score >= 20) return 'text-orange'
  return 'text-red'
}
