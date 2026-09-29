/**
 * lib/prisma-selects.ts — shared Prisma `select` projections for public API routes.
 *
 * WHY: `author: true` returned the FULL User row (password hash, TOTP secret,
 * security key, recovery codes, email) on every public list/detail response.
 * These projections return exactly what the frontend contract (`src/lib/types.ts`
 * Author / ModSummary) needs — nothing secret, nothing wasteful.
 *
 * RULE: public routes must use these. Never reintroduce `author: true`.
 */

/** Public author card — matches `Author` minus optional email (PII, no consumer). */
export const authorPublicSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bannerUrl: true,
  bio: true,
  role: true,
  tier: true,
  specialRoles: true,
  qualityScore: true,
  joinedAt: true,
} as const

/** Minimal game card embedded in mod lists. */
export const gameCardSelect = {
  name: true,
  slug: true,
  platform: true,
} as const

/** Minimal category card embedded in mod lists. */
export const categoryCardSelect = {
  id: true,
  name: true,
  slug: true,
} as const

/**
 * Mod list row — matches `ModSummary` scalars (drops heavy markdown columns
 * like description/changelog/installGuide that list cards never render).
 */
export const modCardSelect = {
  id: true,
  slug: true,
  name: true,
  headline: true,
  summary: true,
  thumbnailUrl: true,
  imageUrl: true,
  galleryUrls: true,
  version: true,
  fileSize: true,
  fileFormat: true,
  downloads: true,
  endorsements: true,
  views: true,
  comments: true,
  rating: true,
  ratingCount: true,
  tags: true,
  series: true,
  translationTeam: true,
  translationType: true,
  isOriginalWork: true,
  originalSource: true,
  originalAuthor: true,
  isFeatured: true,
  isTrending: true,
  isLatest: true,
  featuredLevel: true,
  featuredUntil: true,
  trendingUntil: true,
  popularUntil: true,
  hiddenBadges: true,
  scheduledAt: true,
  workflowStatus: true,
  releaseDate: true,
  updatedAt: true,
  createdAt: true,
  author: { select: authorPublicSelect },
  game: { select: gameCardSelect },
  category: { select: categoryCardSelect },
} as const

/** Full game object for the mod-detail contract (`GameSummary` + description). */
export const gameDetailSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  description: true,
  thumbnailUrl: true,
  bannerUrl: true,
  logoUrl: true,
  category: true,
  platform: true,
  releaseYear: true,
  modCount: true,
  totalDownloads: true,
  totalEndorsements: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
} as const
