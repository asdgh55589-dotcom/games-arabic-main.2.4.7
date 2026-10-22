import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * stats-reconcile.ts — مصالحة عدّادات الإحصائيات.
 *
 * القاعدة (C-SEMANTICS):
 *   Mod.views        == Mod.viewsBaseline        + COUNT(ModView   WHERE modId)
 *   Mod.downloads    == Mod.downloadsBaseline    + COUNT(DownloadClick WHERE modId)
 *   Mod.endorsements == Mod.endorsementsBaseline + COUNT(Endorsement WHERE modId
 *                                                      AND value IN ('fire','sparkle','thumbsup'))
 *   Game.totalDownloads    == SUM(Mod.downloads)    over PUBLISHED mods
 *   Game.totalEndorsements == SUM(Mod.endorsements) over PUBLISHED mods
 *   Game.modCount          == COUNT(Mod)            over PUBLISHED mods
 *
 * الـ baseline هو الجزء المُبذَّر/المُلفَّق من العدّاد (زرع البيانات)،
 * والجزء الحقيقي = counter - baseline. `thumbsdown` تفاعل سلبي وليس إعجاباً
 * فلا تُحتسب ضمن التزكيات.
 *
 * كل الاستعلامات هنا set-based (UPDATE ... FROM / CTE) لأن بركة Aiven تحتمل
 * 5 اتصالات فقط مع statement_timeout=15000 — أي حلقة per-mod على 225 مود
 * ستكون بطيئة وهشّة.
 */

/** التزكيات الإيجابية فقط — thumbsdown ليست إعجاباً. */
export const POSITIVE_ENDORSEMENT_VALUES = ['fire', 'sparkle', 'thumbsup'] as const

/** حالة المود المنشور — العدّادات العامة للعبة/السلسلة تحسب من المنشور فقط. */
export const PUBLISHED_STATUS = 'PUBLISHED'

export interface ModBaselines {
  viewsBaseline: number
  downloadsBaseline: number
  endorsementsBaseline: number
}

export interface ModCounters {
  views: number
  downloads: number
  endorsements: number
}

export interface ModCounts {
  viewCount: number
  downloadCount: number
  positiveEndorsementCount: number
}

export interface ModStatDiff {
  id: string
  changed: boolean
  dryRun: boolean
  before: ModCounters
  after: ModCounters
}

export interface ReconcileSummary {
  dryRun: boolean
  modsScanned: number
  modsChanged: number
  downloadsDelta: number
  viewsDelta: number
  endorsementsDelta: number
  gamesChanged: number
  seriesChanged: number
  errors: string[]
}

/**
 * حساب العدّادات المستهدفة = baseline + عدد صفوف التفاصيل.
 * دالة نقية (قابلة للاختبار بدون قاعدة بيانات).
 */
export function computeModCounters(baselines: ModBaselines, counts: ModCounts): ModCounters {
  return {
    views: baselines.viewsBaseline + counts.viewCount,
    downloads: baselines.downloadsBaseline + counts.downloadCount,
    endorsements: baselines.endorsementsBaseline + counts.positiveEndorsementCount,
  }
}

/**
 * مصالحة مود واحد — تُستخدم من مسار الأدمن /api/admin/reconcile-endorsements.
 * تعتمد على Prisma API (أعداد صغيرة) ومكتوبة لتكون قابلة للاختبار.
 */
export async function reconcileModStats(
  modId: string,
  opts: { dryRun?: boolean } = {},
): Promise<ModStatDiff | null> {
  const dryRun = opts.dryRun === true

  const mod = await db.mod.findUnique({
    where: { id: modId },
    select: {
      id: true,
      views: true,
      downloads: true,
      endorsements: true,
      viewsBaseline: true,
      downloadsBaseline: true,
      endorsementsBaseline: true,
    },
  })
  if (!mod) return null

  const [viewCount, downloadCount, positiveEndorsementCount] = await Promise.all([
    db.modView.count({ where: { modId } }),
    db.downloadClick.count({ where: { modId } }),
    db.endorsement.count({
      where: { modId, value: { in: [...POSITIVE_ENDORSEMENT_VALUES] } },
    }),
  ])

  const after = computeModCounters(
    {
      viewsBaseline: mod.viewsBaseline,
      downloadsBaseline: mod.downloadsBaseline,
      endorsementsBaseline: mod.endorsementsBaseline,
    },
    { viewCount, downloadCount, positiveEndorsementCount },
  )

  const before: ModCounters = {
    views: mod.views,
    downloads: mod.downloads,
    endorsements: mod.endorsements,
  }

  const changed =
    before.views !== after.views ||
    before.downloads !== after.downloads ||
    before.endorsements !== after.endorsements

  if (!dryRun && changed) {
    await db.mod.update({
      where: { id: modId },
      data: {
        views: after.views,
        downloads: after.downloads,
        endorsements: after.endorsements,
      },
    })
  }

  return { id: modId, changed, dryRun, before, after }
}

// ===== SQL المصالحة الجماعية (set-based) =====

/** CTE الترجمة: لكل مود — الأعداد الحقيقية المستهدفة. */
const MOD_TARGETS_CTE = Prisma.sql`
  WITH v AS (SELECT "modId", COUNT(*)::int AS cnt FROM "ModView" GROUP BY "modId"),
       d AS (SELECT "modId", COUNT(*)::int AS cnt FROM "DownloadClick" GROUP BY "modId"),
       e AS (
         SELECT "modId", COUNT(*)::int AS cnt FROM "Endorsement"
         WHERE "value" IN ('fire', 'sparkle', 'thumbsup') GROUP BY "modId"
       ),
       t AS (
         SELECT m."id" AS "id",
                m."viewsBaseline" + COALESCE(v.cnt, 0) AS "nViews",
                m."downloadsBaseline" + COALESCE(d.cnt, 0) AS "nDownloads",
                m."endorsementsBaseline" + COALESCE(e.cnt, 0) AS "nEndorsements"
         FROM "Mod" m
         LEFT JOIN v ON v."modId" = m."id"
         LEFT JOIN d ON d."modId" = m."id"
         LEFT JOIN e ON e."modId" = m."id"
       )
`

/** فرق الأعداد لكل المودات (بدون كتابة) — يُستخدم في وضع dryRun. */
const MOD_DIFF_SQL = Prisma.sql`${MOD_TARGETS_CTE}
  SELECT
    COUNT(*)::int AS "modsScanned",
    COUNT(*) FILTER (
      WHERE m."views" <> t."nViews"
         OR m."downloads" <> t."nDownloads"
         OR m."endorsements" <> t."nEndorsements"
    )::int AS "modsChanged",
    COALESCE(SUM(t."nViews" - m."views"), 0)::int AS "viewsDelta",
    COALESCE(SUM(t."nDownloads" - m."downloads"), 0)::int AS "downloadsDelta",
    COALESCE(SUM(t."nEndorsements" - m."endorsements"), 0)::int AS "endorsementsDelta"
  FROM "Mod" m JOIN t ON t."id" = m."id"
`

/** تطبيق فرق الأعداد على المودات. */
const MOD_APPLY_SQL = Prisma.sql`${MOD_TARGETS_CTE}
  UPDATE "Mod" m
  SET "views" = t."nViews", "downloads" = t."nDownloads", "endorsements" = t."nEndorsements"
  FROM t
  WHERE t."id" = m."id"
    AND (m."views" <> t."nViews"
      OR m."downloads" <> t."nDownloads"
      OR m."endorsements" <> t."nEndorsements")
`

/** تجميع أهداف اللعبة — mods المنشورة فقط. */
const GAME_TARGETS_CTE = Prisma.sql`
  WITH agg AS (
    SELECT "gameId",
           COALESCE(SUM("downloads"), 0)::int AS dl,
           COALESCE(SUM("endorsements"), 0)::int AS en,
           COUNT(*)::int AS cnt
    FROM "Mod" WHERE "workflowStatus" = 'PUBLISHED' GROUP BY "gameId"
  ),
  t AS (
    SELECT g."id" AS "id",
           COALESCE(a.dl, 0) AS "dl",
           COALESCE(a.en, 0) AS "en",
           COALESCE(a.cnt, 0) AS "cnt"
    FROM "Game" g LEFT JOIN agg a ON a."gameId" = g."id"
  )
`

const GAME_DIFF_SQL = Prisma.sql`${GAME_TARGETS_CTE}
  SELECT COUNT(*)::int AS "changed"
  FROM "Game" g JOIN t ON t."id" = g."id"
  WHERE g."totalDownloads" <> t."dl"
     OR g."totalEndorsements" <> t."en"
     OR g."modCount" <> t."cnt"
`

const GAME_APPLY_SQL = Prisma.sql`${GAME_TARGETS_CTE}
  UPDATE "Game" g
  SET "totalDownloads" = t."dl", "totalEndorsements" = t."en", "modCount" = t."cnt"
  FROM t
  WHERE t."id" = g."id"
    AND (g."totalDownloads" <> t."dl"
      OR g."totalEndorsements" <> t."en"
      OR g."modCount" <> t."cnt")
`

/** تجميع أهداف السلسلة — يطابق سلوك syncSeriesCounts (كل مودات السلسلة). */
const SERIES_TARGETS_CTE = Prisma.sql`
  WITH agg AS (
    SELECT "seriesId",
           COALESCE(SUM("downloads"), 0)::int AS dl,
           COALESCE(SUM("endorsements"), 0)::int AS en,
           COUNT(*)::int AS cnt
    FROM "Mod" WHERE "seriesId" IS NOT NULL GROUP BY "seriesId"
  ),
  t AS (
    SELECT s."id" AS "id",
           COALESCE(a.dl, 0) AS "dl",
           COALESCE(a.en, 0) AS "en",
           COALESCE(a.cnt, 0) AS "cnt"
    FROM "Series" s LEFT JOIN agg a ON a."seriesId" = s."id"
  )
`

const SERIES_DIFF_SQL = Prisma.sql`${SERIES_TARGETS_CTE}
  SELECT COUNT(*)::int AS "changed"
  FROM "Series" s JOIN t ON t."id" = s."id"
  WHERE s."totalDownloads" <> t."dl"
     OR s."totalEndorsements" <> t."en"
     OR s."modCount" <> t."cnt"
`

const SERIES_APPLY_SQL = Prisma.sql`${SERIES_TARGETS_CTE}
  UPDATE "Series" s
  SET "totalDownloads" = t."dl", "totalEndorsements" = t."en", "modCount" = t."cnt"
  FROM t
  WHERE t."id" = s."id"
    AND (s."totalDownloads" <> t."dl"
      OR s."totalEndorsements" <> t."en"
      OR s."modCount" <> t."cnt")
`

interface ModDiffRow {
  modsScanned: number
  modsChanged: number
  viewsDelta: number
  downloadsDelta: number
  endorsementsDelta: number
}

interface CountRow {
  changed: number
}

/**
 * مصالحة شاملة لكل العدّادات.
 *
 * @param opts.dryRun عند true: يحسب الفرق ويعرضه دون كتابة أي شيء.
 */
export async function reconcileAllStats(opts: { dryRun?: boolean } = {}): Promise<ReconcileSummary> {
  const dryRun = opts.dryRun === true
  const errors: string[] = []

  const summary: ReconcileSummary = {
    dryRun,
    modsScanned: 0,
    modsChanged: 0,
    downloadsDelta: 0,
    viewsDelta: 0,
    endorsementsDelta: 0,
    gamesChanged: 0,
    seriesChanged: 0,
    errors,
  }

  try {
    const rows = await db.$queryRaw<ModDiffRow[]>(MOD_DIFF_SQL)
    const row = rows?.[0]
    if (row) {
      summary.modsScanned = Number(row.modsScanned || 0)
      summary.modsChanged = Number(row.modsChanged || 0)
      summary.viewsDelta = Number(row.viewsDelta || 0)
      summary.downloadsDelta = Number(row.downloadsDelta || 0)
      summary.endorsementsDelta = Number(row.endorsementsDelta || 0)
    }
  } catch (err) {
    errors.push(`mods_diff: ${err instanceof Error ? err.message : String(err)}`)
    logger.error({ event: 'stats_reconcile_mods_diff_failed', err }, 'stats reconcile failed (mods)')
    return summary
  }

  try {
    const rows = await db.$queryRaw<CountRow[]>(GAME_DIFF_SQL)
    summary.gamesChanged = Number(rows?.[0]?.changed || 0)
  } catch (err) {
    errors.push(`games_diff: ${err instanceof Error ? err.message : String(err)}`)
    logger.error({ event: 'stats_reconcile_games_diff_failed', err }, 'stats reconcile failed (games)')
  }

  try {
    const rows = await db.$queryRaw<CountRow[]>(SERIES_DIFF_SQL)
    summary.seriesChanged = Number(rows?.[0]?.changed || 0)
  } catch (err) {
    errors.push(`series_diff: ${err instanceof Error ? err.message : String(err)}`)
    logger.error({ event: 'stats_reconcile_series_diff_failed', err }, 'stats reconcile failed (series)')
  }

  if (dryRun) return summary

  try {
    await db.$executeRaw(MOD_APPLY_SQL)
  } catch (err) {
    errors.push(`mods_apply: ${err instanceof Error ? err.message : String(err)}`)
    logger.error({ event: 'stats_reconcile_mods_apply_failed', err }, 'stats reconcile apply failed (mods)')
  }

  try {
    await db.$executeRaw(GAME_APPLY_SQL)
  } catch (err) {
    errors.push(`games_apply: ${err instanceof Error ? err.message : String(err)}`)
    logger.error({ event: 'stats_reconcile_games_apply_failed', err }, 'stats reconcile apply failed (games)')
  }

  try {
    await db.$executeRaw(SERIES_APPLY_SQL)
  } catch (err) {
    errors.push(`series_apply: ${err instanceof Error ? err.message : String(err)}`)
    logger.error(
      { event: 'stats_reconcile_series_apply_failed', err },
      'stats reconcile apply failed (series)',
    )
  }

  return summary
}
