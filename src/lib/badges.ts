/**
 * lib/badges.ts — محرك الشارات التلقائي للتعريبات.
 *
 * القواعد (قرارات المالك — نهائية):
 * - شارات الأداء (يسار الصورة): مميز > رائج > شائع — تُعرض الأعلى فقط.
 * - شارات الوقت (يمين الصورة): جديد (48 ساعة) / محدّث (24 ساعة) — نظامية فقط، بلا تجاوز.
 * - يمكن للتعريب عرض شارة أداء واحدة + شارة وقت واحدة معاً.
 * - دوال الحساب خالصة (pure) لسهولة الاختبار؛ التفاعل مع DB عبر دوال مساعدة.
 */

export interface FeaturedTier {
  downloads: number
  durationDays: number
}

export const DEFAULT_FEATURED_TIERS: FeaturedTier[] = [
  { downloads: 100, durationDays: 2 }, // Level 1
  { downloads: 200, durationDays: 3 }, // Level 2
  { downloads: 300, durationDays: 4 }, // Level 3
  { downloads: 500, durationDays: 5 }, // Level 4
  { downloads: 1000, durationDays: 7 }, // Level 5
]

export const DEFAULT_TRENDING_THRESHOLD = 50
export const DEFAULT_POPULAR_THRESHOLD = 20
export const NEW_BADGE_DURATION_HOURS = 48
export const UPDATED_BADGE_DURATION_HOURS = 24
export const TRENDING_BADGE_DURATION_HOURS = 24
export const POPULAR_BADGE_DURATION_HOURS = 24

export type PerformanceBadge = 'featured' | 'trending' | 'popular' | null
export type TimeBadge = 'new' | 'updated' | null

export interface BadgeResult {
  performance: PerformanceBadge
  time: TimeBadge
  featuredLevel?: number
  featuredUntil?: Date
}

export interface ResolvedBadgeSettings {
  trendingThreshold: number
  popularThreshold: number
  featuredTiers: FeaturedTier[]
  badgesEnabled: boolean
}

export interface ModBadgeState {
  createdAt: Date | string
  updatedAt: Date | string
  featuredLevel?: number | null
  featuredUntil?: Date | string | null
  trendingUntil?: Date | string | null
  popularUntil?: Date | string | null
  hiddenBadges?: string | null
}

const HOUR_MS = 60 * 60 * 1000

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Parse hiddenBadges CSV → set of tokens. */
export function parseHiddenBadges(csv: string | null | undefined): Set<string> {
  if (!csv) return new Set()
  return new Set(
    csv
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** Validate/normalize tiers from DB JSON — falls back to defaults on any issue. */
export function normalizeTiers(raw: unknown): FeaturedTier[] {
  if (!Array.isArray(raw)) return DEFAULT_FEATURED_TIERS
  const tiers = raw
    .filter(
      (t): t is FeaturedTier =>
        !!t &&
        typeof (t as FeaturedTier).downloads === 'number' &&
        typeof (t as FeaturedTier).durationDays === 'number' &&
        (t as FeaturedTier).downloads > 0 &&
        (t as FeaturedTier).durationDays > 0,
    )
    .map((t) => ({ downloads: t.downloads, durationDays: t.durationDays }))
    .sort((a, b) => a.downloads - b.downloads)
  return tiers.length > 0 ? tiers : DEFAULT_FEATURED_TIERS
}

/** Merge DB settings row (or null) with defaults. */
export function resolveBadgeSettings(row: {
  trendingThreshold?: number | null
  popularThreshold?: number | null
  featuredTiers?: unknown
  badgesEnabled?: boolean | null
} | null): ResolvedBadgeSettings {
  return {
    trendingThreshold:
      typeof row?.trendingThreshold === 'number' && row.trendingThreshold > 0
        ? row.trendingThreshold
        : DEFAULT_TRENDING_THRESHOLD,
    popularThreshold:
      typeof row?.popularThreshold === 'number' && row.popularThreshold > 0
        ? row.popularThreshold
        : DEFAULT_POPULAR_THRESHOLD,
    featuredTiers: normalizeTiers((row as { featuredTiers?: unknown } | null)?.featuredTiers),
    badgesEnabled: row?.badgesEnabled !== false,
  }
}

/** Highest featured tier reached by downloadsLast24h (1-based level) or null. */
export function tierForDownloads(
  downloadsLast24h: number,
  tiers: FeaturedTier[],
): { level: number; tier: FeaturedTier } | null {
  let best: { level: number; tier: FeaturedTier } | null = null
  tiers.forEach((tier, i) => {
    if (downloadsLast24h >= tier.downloads) best = { level: i + 1, tier }
  })
  return best
}

/**
 * حساب الشارات — دالة خالصة.
 * - الأداء: featured النشط (حتى انتهائه) > trending (تجاوز نشط أو عتبة) > popular.
 * - الوقت: جديد ≤48h من الإنشاء، وإلا محدّث ≤24h من التحديث (ولا تجاوز عليهما أبداً).
 */
export function calculateBadges(
  mod: ModBadgeState,
  downloadsLast24h: number,
  settings: ResolvedBadgeSettings,
  now: Date = new Date(),
): BadgeResult {
  const result: BadgeResult = { performance: null, time: null }
  const nowMs = now.getTime()

  // ---- Time badges: purely time-based, no override possible by construction ----
  const createdMs = toDate(mod.createdAt)?.getTime()
  const updatedMs = toDate(mod.updatedAt)?.getTime()
  if (createdMs !== null && createdMs !== undefined) {
    const ageCreatedH = (nowMs - createdMs) / HOUR_MS
    if (ageCreatedH >= 0 && ageCreatedH <= NEW_BADGE_DURATION_HOURS) {
      result.time = 'new'
    } else if (updatedMs !== null && updatedMs !== undefined) {
      const ageUpdatedH = (nowMs - updatedMs) / HOUR_MS
      // Updated only when the mod is NOT new (createdAt > 48h ago)
      if (ageUpdatedH >= 0 && ageUpdatedH <= UPDATED_BADGE_DURATION_HOURS) {
        result.time = 'updated'
      }
    }
  }

  // ---- Performance badges (system can be disabled entirely by admin) ----
  if (settings.badgesEnabled === false) return result

  const hidden = parseHiddenBadges(mod.hiddenBadges)
  const featuredUntil = toDate(mod.featuredUntil)
  const trendingUntil = toDate(mod.trendingUntil)
  const popularUntil = toDate(mod.popularUntil)

  if (
    mod.featuredLevel != null &&
    featuredUntil &&
    featuredUntil.getTime() > nowMs &&
    !hidden.has('featured')
  ) {
    result.performance = 'featured'
    result.featuredLevel = mod.featuredLevel
    result.featuredUntil = featuredUntil
    return result
  }
  if (
    ((trendingUntil && trendingUntil.getTime() > nowMs) ||
      downloadsLast24h >= settings.trendingThreshold) &&
    !hidden.has('trending')
  ) {
    result.performance = 'trending'
    return result
  }
  if (
    ((popularUntil && popularUntil.getTime() > nowMs) ||
      downloadsLast24h >= settings.popularThreshold) &&
    !hidden.has('popular')
  ) {
    result.performance = 'popular'
    return result
  }
  return result
}

// ============================================================
// Recalculation decision (pure) — used by the recalc endpoint
// ============================================================

export interface RecalcModState extends ModBadgeState {
  id: string
}

export interface RecalcUpdate {
  isFeatured: boolean
  isTrending: boolean
  isLatest: boolean
  featuredLevel: number | null
  featuredUntil: Date | null
  trendingUntil: Date | null
  popularUntil: Date | null
  dailyDownloads: number
  lastDownloadDate: Date
}

/**
 * قرار إعادة الحساب لتعريب واحد — خالص وقابل للاختبار.
 * - مميز: أعلى مستوى مؤهل؛ لا يُقصَّر إن كان نشطاً بمستوى أعلى/مساوٍ.
 * - رائج/شائع: مؤهل → Until = الآن+24h (أو إبقاء الأبعد إن كان تجاوز أدمن)؛
 *   غير مؤهل ومنتهي → تصفير Until.
 */
export function decideRecalcBadges(
  mod: RecalcModState,
  downloadsLast24h: number,
  settings: ResolvedBadgeSettings,
  now: Date = new Date(),
): RecalcUpdate {
  const nowMs = now.getTime()
  const createdMs = toDate(mod.createdAt)?.getTime() ?? nowMs
  const isLatest = nowMs - createdMs <= NEW_BADGE_DURATION_HOURS * HOUR_MS

  const update: RecalcUpdate = {
    isFeatured: false,
    isTrending: false,
    isLatest,
    featuredLevel: null,
    featuredUntil: null,
    trendingUntil: null,
    popularUntil: null,
    dailyDownloads: downloadsLast24h,
    lastDownloadDate: now,
  }

  if (settings.badgesEnabled === false) {
    // النظام معطّل: إسقاط كل شارات الأداء
    return update
  }

  // ---- Featured (tiered, persistent) ----
  const qualified = tierForDownloads(downloadsLast24h, settings.featuredTiers)
  const currentUntil = toDate(mod.featuredUntil)
  const currentActive =
    mod.featuredLevel != null && !!currentUntil && currentUntil.getTime() > nowMs
  if (qualified) {
    if (currentActive && (mod.featuredLevel as number) >= qualified.level) {
      // نشط بمستوى أعلى/مساوٍ — إبقاء (لا تقصير ولا تمديد)
      update.isFeatured = true
      update.featuredLevel = mod.featuredLevel as number
      update.featuredUntil = currentUntil
    } else {
      // منح/ترقية للمستوى المؤهل
      update.isFeatured = true
      update.featuredLevel = qualified.level
      update.featuredUntil = new Date(nowMs + qualified.tier.durationDays * 24 * HOUR_MS)
    }
  } else if (currentActive) {
    // لا تأهيل حالي لكن الشارة ما زالت سارية — تبقى حتى انتهائها
    update.isFeatured = true
    update.featuredLevel = mod.featuredLevel as number
    update.featuredUntil = currentUntil
  }

  // ---- Trending ----
  const trendingAuto = downloadsLast24h >= settings.trendingThreshold
  const existingTrendingUntil = toDate(mod.trendingUntil)
  if (trendingAuto) {
    update.isTrending = true
    const autoUntil = new Date(nowMs + TRENDING_BADGE_DURATION_HOURS * HOUR_MS)
    update.trendingUntil =
      existingTrendingUntil && existingTrendingUntil.getTime() > autoUntil.getTime()
        ? existingTrendingUntil // تجاوز أدمن أبعد — يُحترم
        : autoUntil
  } else if (existingTrendingUntil && existingTrendingUntil.getTime() > nowMs) {
    // غير مؤهل لكن Until مستقبلي (تجاوز أدمن أو منح حديث) — يُحترم
    update.isTrending = true
    update.trendingUntil = existingTrendingUntil
  }

  // ---- Popular ----
  const popularAuto = downloadsLast24h >= settings.popularThreshold
  const existingPopularUntil = toDate(mod.popularUntil)
  if (popularAuto) {
    const autoUntil = new Date(nowMs + POPULAR_BADGE_DURATION_HOURS * HOUR_MS)
    update.popularUntil =
      existingPopularUntil && existingPopularUntil.getTime() > autoUntil.getTime()
        ? existingPopularUntil
        : autoUntil
  } else if (existingPopularUntil && existingPopularUntil.getTime() > nowMs) {
    update.popularUntil = existingPopularUntil
  }

  return update
}

// ============================================================
// DB helpers (fail-soft, mock-friendly)
// ============================================================

/** Fetch badge settings row merged with defaults. */
export async function getBadgeSettings(db: any): Promise<ResolvedBadgeSettings> {
  try {
    const row = await db.badgeSettings?.findUnique?.({ where: { id: 'default' } })
    return resolveBadgeSettings(row ?? null)
  } catch {
    return resolveBadgeSettings(null)
  }
}

/** Count downloads in the last 24h for a mod (single source: DownloadClick). */
export async function countDownloadsLast24h(
  db: any,
  modId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - 24 * HOUR_MS)
  return db.downloadClick.count({ where: { modId, createdAt: { gte: since } } })
}

/** Write a badge audit entry — best effort, never throws. */
export async function logBadgeChange(
  db: any,
  entry: { modId: string; action: string; oldValue?: string | null; newValue?: string | null; changedById?: string | null },
): Promise<void> {
  try {
    await db.badgeAuditLog?.create?.({ data: entry })
  } catch {
    // intentional: audit is best-effort
  }
}

function isSameUtcDay(a: Date | null, b: Date): boolean {
  if (!a) return false
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

/**
 * تحديث تدريجي عند كل تحميل محسوب — يُستدعى بعد recordDownload.
 * يزامن العداد اليومي ويمنح الشارات فور تجاوز العتبات.
 * Best-effort: لا يرمي أبداً ولا يكسر مسار العدّ.
 */
export async function refreshBadgesOnDownload(
  db: any,
  modId: string,
  now: Date = new Date(),
): Promise<void> {
  try {
    const mod = await db.mod?.findUnique?.({
      where: { id: modId },
      select: {
        createdAt: true,
        updatedAt: true,
        featuredLevel: true,
        featuredUntil: true,
        trendingUntil: true,
        popularUntil: true,
        hiddenBadges: true,
        dailyDownloads: true,
        lastDownloadDate: true,
      },
    })
    if (!mod) return

    const settings = await getBadgeSettings(db)
    const lastDate = toDate(mod.lastDownloadDate)
    const newDaily = isSameUtcDay(lastDate, now) ? (mod.dailyDownloads ?? 0) + 1 : 1
    const nowMs = now.getTime()

    const data: Record<string, unknown> = {
      dailyDownloads: newDaily,
      lastDownloadDate: now,
    }

    if (settings.badgesEnabled !== false) {
      // Trending فوري
      const trendingActive = !!toDate(mod.trendingUntil) && (toDate(mod.trendingUntil) as Date).getTime() > nowMs
      if (newDaily >= settings.trendingThreshold && !trendingActive) {
        const until = new Date(nowMs + TRENDING_BADGE_DURATION_HOURS * HOUR_MS)
        data.trendingUntil = until
        data.isTrending = true
        await logBadgeChange(db, {
          modId,
          action: 'AUTO_TRENDING',
          oldValue: `daily=${newDaily}`,
          newValue: `until=${until.toISOString()}`,
        })
      }
      // Popular فوري
      const popularActive = !!toDate(mod.popularUntil) && (toDate(mod.popularUntil) as Date).getTime() > nowMs
      if (newDaily >= settings.popularThreshold && !popularActive) {
        const until = new Date(nowMs + POPULAR_BADGE_DURATION_HOURS * HOUR_MS)
        data.popularUntil = until
        await logBadgeChange(db, {
          modId,
          action: 'AUTO_POPULAR',
          oldValue: `daily=${newDaily}`,
          newValue: `until=${until.toISOString()}`,
        })
      }
      // Featured فوري (مستويات)
      const qualified = tierForDownloads(newDaily, settings.featuredTiers)
      const currentUntil = toDate(mod.featuredUntil)
      const currentActive =
        mod.featuredLevel != null && !!currentUntil && currentUntil.getTime() > nowMs
      if (qualified && (!currentActive || (mod.featuredLevel as number) < qualified.level)) {
        const until = new Date(nowMs + qualified.tier.durationDays * 24 * HOUR_MS)
        data.featuredLevel = qualified.level
        data.featuredUntil = until
        data.isFeatured = true
        await logBadgeChange(db, {
          modId,
          action: 'AUTO_FEATURED',
          oldValue: `daily=${newDaily}`,
          newValue: `level=${qualified.level} until=${until.toISOString()}`,
        })
      }
    }

    await db.mod?.update?.({ where: { id: modId }, data })
  } catch {
    // intentional: badge refresh is best-effort — the download is already counted
  }
}
