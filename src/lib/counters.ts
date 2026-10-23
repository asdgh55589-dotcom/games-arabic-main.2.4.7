/**
 * lib/counters.ts — نظام عدادات محصّن ضد التلاعب.
 *
 * الاستراتيجية الهجينة:
 * 1. Redis (SET NX) للتحقق الفوري من التكرار O(1)
 * 2. جداول تتبع دائمة (ModView / DownloadClick) تُكتب فقط عند dedup-miss
 * 3. الزيادة الذرية للعدادات عبر Prisma { increment }
 *
 * الهوية:
 * - مستخدم مسجل: userId من الـ role cookie (JWT محلي رخيص) → TTL 24 ساعة
 * - زائر: IP + UA hash → TTL ساعة واحدة
 * - Bots الواضحة: لا تُحتسب إطلاقاً (ومنها مدفوفات الخادم: node/bun/undici)
 * - الطلب الداخلي من الخادم (x-ga-internal: 1) لا يُحتسب أبداً
 *
 * الخصوصية: ModView.ipAddress / DownloadClick.ipAddress تخزّن معرّفاً مُجزّأً
 * (hashIdentity) لا عنوان IP خاماً.
 */

import { getUserIdFromRequestCookies } from './auth'
import { refreshBadgesOnDownload } from './badges'
import { logger } from './logger'
import { isRedisConfigured, redisSetNX } from './redis'

const HOUR = 3600
const DAY = 86400

/**
 * View/download counters intentionally do NOT clear the home cache.
 *
 * Counters change on every counted event while the home payload (~255 kB) is
 * rebuilt from 8 sequential queries; invalidating it per view/download caused
 * cache stampedes (egress + compute) on Neon Free. The home-cache TTL bounds
 * counter staleness; endorsement/admin section changes invalidate explicitly,
 * while mod create/update rely on revalidatePath plus the TTL.
 */

/**
 * أنماط bots — لا نرفض privacy browsers بدون UA.
 *
 * يشمل أيضاً مدفوفات الخادم (node / bun / undici / node-fetch) حتى لا يعدّ
 * الخادم مشاهداته هو: الطلب الداخلي من Next.js إلى /api/mods/[slug] يحمل
 * User-Agent الخاص بــ Node/Bun وكان يُسجَّل كمشاهدة حقيقية.
 * حدود الكلمة (بداية/نهاية أو فاصل \s / ( ; )) تمنع مطابقة "node" داخل كلمة أخرى
 * — لا يوجد User-Agent لمتصفح حقيقي يحتوي هذه الرموز ككلمة مستقلة.
 */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|headless|phantom|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|python-requests|curl\/|wget|axios\/|node-fetch|undici|(?:^|[\s/;(])node(?:[\s/;)]|$)|(?:^|[\s/;(])bun(?:[\s/;)]|$)/i

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false // Privacy browsers (Brave, Firefox Focus) — لا نرفض، نستخدم dedup أشد
  return BOT_PATTERN.test(userAgent)
}

/**
 * C1 — ترويسة الطلب الداخلي.
 *
 * الخادم (ISR) يستدعي /api/mods/[slug] من نفسه. هذا الطلب يجب ألّا يُحتسب
 * كمشاهدة أبداً — نُعلّمه بترويسة صريحة بدل الاعتماد على User-Agent فقط.
 */
export const INTERNAL_REQUEST_HEADER = 'x-ga-internal'

/** هل هذا طلب داخلي صادر عن الخادم نفسه (ISR self-fetch)؟ */
export function isInternalRequest(req: Request): boolean {
  return req.headers.get(INTERNAL_REQUEST_HEADER) === '1'
}

export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = req.headers.get('x-real-ip')
  if (realIP) return realIP
  return 'unknown'
}

function hashUA(userAgent: string): string {
  let h = 0
  for (let i = 0; i < userAgent.length && i < 120; i++) {
    h = ((h << 5) - h + userAgent.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/** Privacy hash for guest identifiers (stored instead of raw IP). */
export function hashIdentity(s: string): string {
  let h = 0
  const input = s.slice(0, 200)
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/**
 * بداية اليوم بتوقيت UTC — تُستخدم كـ `dayBucket` في ModView / DownloadClick
 * ليجعل الـ dedup الدائم (unique index) مبنياً على (اليوم + الهوية).
 */
export function startOfUtcDay(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return out
}

/** هل هذا خطأ من Prisma يعني انتهاك قيد التفرّد (unique index)؟ */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

/** هل Redis (Upstash) مُهيّأ في هذه البيئة؟ */
const REDIS_CONFIGURED = isRedisConfigured()

/**
 * بديل محلي لـ SET NX — يُستخدم فقط عندما لا يكون Redis مُهيّأً إطلاقاً
 * (تطوير/اختبار). في الإنتاج يُمنع: تعطُّل Redis يجب ألّا يُحتسب الحدث.
 */
const localNxStore = new Map<string, number>()

function localSetNX(key: string, ttlSeconds: number): boolean {
  const now = Date.now()
  const expires = localNxStore.get(key)
  if (expires !== undefined && expires > now) return false
  localNxStore.set(key, now + ttlSeconds * 1000)
  if (localNxStore.size > 5000) {
    for (const [k, exp] of localNxStore) {
      if (exp <= now) localNxStore.delete(k)
      if (localNxStore.size <= 4000) break
    }
  }
  return true
}

interface CounterIdentity {
  /** مفتاح الهوية داخل الـ dedup key */
  identity: string
  /** TTL بالثواني حسب نوع الهوية */
  ttl: number
  /** هل صاحب الطلب مستخدم مسجل؟ */
  authenticated: boolean
}

async function resolveIdentity(req: Request): Promise<CounterIdentity> {
  const ua = req.headers.get('user-agent') || ''
  const userId = await getUserIdFromRequestCookies(req)
  // No UA → stricter dedup 30 min (Issue 8)
  if (!ua) {
    if (userId) return { identity: `u:${userId}`, ttl: 1800, authenticated: true }
    const ip = getClientIP(req)
    return { identity: `i:${ip}:${hashUA('unknown')}`, ttl: 1800, authenticated: false }
  }
  if (userId) {
    return { identity: `u:${userId}`, ttl: DAY, authenticated: true }
  }
  const ip = getClientIP(req)
  return { identity: `i:${ip}:${hashUA(ua)}`, ttl: HOUR, authenticated: false }
}

/**
 * فحص dedup موحّد — يرجع true إذا كان الحدث جديداً (يُحتسب).
 *
 * fail-closed: عند تعذّر الوصول إلى Redis نُرجع false (لا نحتسب) بدل
 * الاعتماد على الذاكرة المحلية — لأن الذاكرة المحلية غير مشتركة بين نسخ
 * الخادم، في الماضي كان تعطُّل Redis يمرّ كـ "جديد" دائماً (= تضخّم العدّاد).
 * الخيار `failClosed: true` يجعل redisSetNX نفسه يتولّى هذا السلوك.
 *
 * تفرّع صريح بين البيئة الإنتاجية وبيئة التطوير/الاختبار:
 *
 * - الإنتاج (أو أي بيئة Redis مُهيّأة): المصدر الوحيد للقرار هو Redis عبر
 *   `redisSetNX(..., { failClosed: true })`. تعطُّل Redis = لا احتساب.
 * - التطوير/الاختبار بدون Redis مُهيّأ: المصدر الوحيد هو المخزن المحلي
 *   `localSetNX` أدناه. لا نخلط بين المسارين، لأن `redisSetNX`
 *   قد يعيد `false` لسببين مختلفين تماماً:
 *     (أ) المفتاح موجود مسبقاً = تكرار حقيقي → لا نحتسب، و
 *     (ب) Redis غير مُهيّأ/غير متاح مع fail-closed → لا نحتسب.
 *   الخلط بين المسارين كان يجعل كل طلب "جديداً" (localSetNX فوق نتيجة Redis)
 *   = تضخّم العدّادات وتكرار المشاهدات/التحميلات.
 */
async function shouldCount(
  scope: string,
  req: Request,
): Promise<{ fresh: boolean; identity: CounterIdentity }> {
  const identity = await resolveIdentity(req)
  const key = `count:${scope}:${identity.identity}`
  if (!REDIS_CONFIGURED && process.env.NODE_ENV !== 'production') {
    // تطوير/اختبار بدون Redis — المخزن المحلي هو المرجع الوحيد.
    return { fresh: localSetNX(key, identity.ttl), identity }
  }
  // cast محدَّد (وليس any): الخيار الثالث `failClosed` مُنفَّذ في lib/redis.ts
  // (redisSetNX(key, ttlSeconds, opts?: { failClosed?: boolean })) — التوقيع
  // مطابق تماماً فلا حاجة لـ cast بعد وصوله.
  const fresh = await redisSetNX(key, identity.ttl, { failClosed: true })
  return { fresh, identity }
}

export interface RecordResult {
  counted: boolean
}

/**
 * تسجيل مشاهدة تعريب — تكتب صف ModView وتزيد العداد فقط للمشاهدة الفريدة.
 * يُرجع counted=false للمكرر أو الـ bots أو الطلب الداخلي من الخادم.
 */
export async function recordModView(modId: string, req: Request, db: any): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }
  // C1 — الطلب الداخلي (ISR self-fetch) لا يُحتسب أبداً
  if (isInternalRequest(req)) return { counted: false }

  const { fresh, identity } = await shouldCount(`view:mod:${modId}`, req)
  if (!fresh) return { counted: false }

  const ip = getClientIP(req)
  // R30 — العمود يحمل الآن معرّفاً مُجزّأً (hash) لا عنوان IP خاماً (GDPR).
  // المستخدم المسجَّل يُعرَّف بـ userId فقط → لا نحتاج أي معرّف IP له.
  const ipHash = identity.authenticated ? null : hashIdentity(ip)
  const dayBucket = startOfUtcDay(new Date())

  const modViewData = {
    modId,
    userId: identity.authenticated ? identity.identity.slice(2) : null,
    ipAddress: ipHash,
    userAgent: userAgent?.substring(0, 200) || null,
    dayBucket,
  }

  // Atomic transaction for view count — مع fallback لـ test mocks
  try {
    if (typeof db.$transaction === 'function') {
      await db.$transaction(async (tx: any) => {
        // نكتب الصف أولاً: لو رُفض بـ P2002 (تكرار في نفس اليوم) تتوقف
        // العملية قبل زيادة العدّاد، فلا نُضخّم المشاهدات.
        await tx.modView.create({ data: modViewData })
        await tx.mod.update({
          where: { id: modId },
          data: { views: { increment: 1 } },
        })
      })
    } else {
      // fallback بلا transaction — نفس الترتيب (صف ثم عدّاد)
      await db.modView.create({ data: modViewData })
      await db.mod.update({
        where: { id: modId },
        data: { views: { increment: 1 } },
      })
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      // P2002 — الصف موجود مسبقاً (نفس البصمة في نفس اليوم) = محسوب سابقاً
      return { counted: false }
    }
    throw err
  }
  return { counted: true }
}

/**
 * تسجيل مشاهدة صفحة فريق — عداد Team.views مع dedup بنفس سياسة المشاهدات.
 */
export async function recordTeamView(teamId: string, req: Request, db: any): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }

  const { fresh } = await shouldCount(`view:team:${teamId}`, req)
  if (!fresh) return { counted: false }

  await db.team.update({
    where: { id: teamId },
    data: { views: { increment: 1 } },
  })
  return { counted: true }
}

/**
 * Wave B Task 5 — تسجيل فتح قسم التعليقات (funnel: view → download → click).
 * نفس سياسة المشاهدات (bot-excluded + Redis dedup). يُرجع counted=false
 * للمكرر أو الـ bots. لا يوجد عدّاد تراكمي — التجميع من الجدول مباشرة.
 */
export async function recordCommentSectionClick(
  modId: string,
  req: Request,
  db: any,
): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }

  const { fresh, identity } = await shouldCount(`csc:mod:${modId}`, req)
  if (!fresh) return { counted: false }

  const ip = getClientIP(req)
  await db.commentSectionClick.create({
    data: {
      modId,
      userId: identity.authenticated ? identity.identity.slice(2) : null,
      ipHash: identity.authenticated ? null : hashIdentity(`${ip}:${userAgent || 'unknown'}`),
      userAgent: userAgent?.substring(0, 200) || null,
    },
  })
  return { counted: true }
}

/**
 * تسجيل تحميل فعلي — يزيد Mod.downloads ويسجل DownloadClick فقط للأحداث الفريدة.
 *
 * نطاق الـ dedup: لكل FILE (`dl:file:{fileId}`) — لأن موداً واحداً قد يكون له
 * عدة روابط مرايا (mirrors) لنفس الملف، والنطاق القديم (لكل رابط) كان
 * يسمح لمستخدم واحد بتوليد عدة تحميلات محسوبة في اليوم نفسه.
 * إن لم يوجد fileId نرجع لنطاق المود (`dl:mod:{modId}`).
 * TTL: مستخدم مسجَّل = 24 ساعة، زائر = ساعة واحدة.
 */
export async function recordDownload(
  opts: {
    modId: string
    linkId?: string | null
    fileId?: string | null
    linkUrl?: string | null
    userId?: string | null
  },
  req: Request,
  db: any,
): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }
  // C1 — الطلب الداخلي من الخادم لا يُحتسب
  if (isInternalRequest(req)) return { counted: false }

  // R24 — النطاق لكل ملف (وليس لكل رابط)
  const scopeKey = opts.fileId ? `dl:file:${opts.fileId}` : `dl:mod:${opts.modId}`
  const { fresh } = await shouldCount(scopeKey, req)
  if (!fresh) return { counted: false }

  const identityUserId = opts.userId ?? null
  const ip = getClientIP(req)
  const referrer = req.headers.get('referer')
  // R30 — العمود يحمل معرّفاً مُجزّأً (hash) لا عنوان IP خاماً (GDPR)
  const ipHash = hashIdentity(ip)
  const dayBucket = startOfUtcDay(new Date())

  const downloadClickData = {
    modId: opts.modId,
    fileId: opts.fileId ?? null,
    linkId: opts.linkId ?? null,
    linkUrl: opts.linkUrl ?? '',
    userId: identityUserId,
    ipAddress: ipHash,
    userAgent: userAgent?.substring(0, 200) || null,
    referrer,
    dayBucket,
  }

  // Atomic transaction: Mod + DownloadClick + Game + Series — مع fallback للـ test mocks
  try {
    if (typeof db.$transaction === 'function') {
      await db.$transaction(async (tx: any) => {
        // الصف أولاً — لو رُفض بـ P2002 لا نزيد عدّاد التحميلات
        await tx.downloadClick.create({ data: downloadClickData })
        await tx.mod.update({
          where: { id: opts.modId },
          data: { downloads: { increment: 1 } },
        })
        // Cascade to Game/Series — fetch once inside transaction
        try {
          const mod = await tx.mod.findUnique({
            where: { id: opts.modId },
            select: { gameId: true, seriesId: true },
          })
          if (mod?.gameId && tx.game) {
            await tx.game.update({
              where: { id: mod.gameId },
              data: { totalDownloads: { increment: 1 } },
            })
          }
          if (mod?.seriesId && tx.series) {
            await tx.series.update({
              where: { id: mod.seriesId },
              data: { totalDownloads: { increment: 1 } },
            })
          }
        } catch (err) {
          // Game/Series cascade is best-effort — the Mod count + DownloadClick row are already committed in the same tx
          // intentional: expected+handled (partial cascade converges on next download; no rollback of the primary count)
          logger.warn(
            { event: 'download_cascade_failed', action: 'record_download_tx', err },
            'download game/series cascade failed',
          )
        }
      })
    } else {
      // fallback بلا transaction — نفس الترتيب (صف ثم عدّاد)
      await db.downloadClick.create({ data: downloadClickData })
      await db.mod.update({
        where: { id: opts.modId },
        data: { downloads: { increment: 1 } },
      })
      // Best-effort cascade for non-transactional mocks
      try {
        if (db.game && db.mod?.findUnique) {
          const mod = await db.mod.findUnique({
            where: { id: opts.modId },
            select: { gameId: true, seriesId: true },
          })
          if (mod?.gameId && db.game?.update)
            await db.game.update({
              where: { id: mod.gameId },
              data: { totalDownloads: { increment: 1 } },
            })
          if (mod?.seriesId && db.series?.update)
            await db.series.update({
              where: { id: mod.seriesId },
              data: { totalDownloads: { increment: 1 } },
            })
        }
      } catch (err) {
        // non-transactional cascade is best-effort — primary Mod count + DownloadClick already written
        // intentional: expected+handled (converges on next download; no rollback)
        logger.warn(
          { event: 'download_cascade_failed', action: 'record_download_fallback', err },
          'download game/series cascade failed',
        )
      }
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      // P2002 — نفس البصمة في نفس اليوم = محسوبة سابقاً
      return { counted: false }
    }
    throw err
  }
  // تحديث تدريجي لشارات التعريب (best-effort — لا يكسر العدّ عند الفشل)
  await refreshBadgesOnDownload(db, opts.modId).catch(() => undefined)
  // R23 — إعادة فهرسة المود في Meilisearch (best-effort — فشل الفهرسة لا يكسر التحميل)
  try {
    const idx = (await import('@/lib/meilisearch/indexer')) as {
      reindexModById?: (id: string) => Promise<void>
    }
    await idx.reindexModById?.(opts.modId)
  } catch {
    // best-effort — indexing failure must never break a download
  }
  return { counted: true }
}

/**
 * تسجيل نقرة إعلان — يزيد HomepageAd.clicksCount ويسجل AdClick فقط للنقرات الفريدة.
 */
export async function recordAdClick(adId: string, req: Request, db: any): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }

  const { fresh, identity } = await shouldCount(`click:ad:${adId}`, req)
  if (!fresh) return { counted: false }

  const ip = getClientIP(req)
  const referrer = req.headers.get('referer')

  await Promise.all([
    db.homepageAd.update({
      where: { id: adId },
      data: { clicksCount: { increment: 1 } },
    }),
    db.adClick.create({
      data: {
        adId,
        userId: identity.authenticated ? identity.identity.slice(2) : null,
        ipAddress: identity.authenticated ? null : ip,
        userAgent: userAgent?.substring(0, 200) || null,
        referrer,
      },
    }),
  ])
  return { counted: true }
}

/**
 * تسجيل مشاهدة خبر — يزيد News.views ويسجل NewsView فقط للمشاهدات الفريدة.
 */
export async function recordNewsView(newsId: string, req: Request, db: any): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }

  const { fresh, identity } = await shouldCount(`view:news:${newsId}`, req)
  if (!fresh) return { counted: false }

  const ip = getClientIP(req)

  await Promise.all([
    db.news.update({
      where: { id: newsId },
      data: { views: { increment: 1 } },
    }),
    db.newsView.create({
      data: {
        newsId,
        userId: identity.authenticated ? identity.identity.slice(2) : null,
        ipAddress: identity.authenticated ? null : ip,
        userAgent: userAgent?.substring(0, 200) || null,
      },
    }),
  ])
  return { counted: true }
}

/**
 * تسجيل نقرة خبر — يزيد News.clicksCount ويسجل NewsClick فقط للنقرات الفريدة.
 */
export async function recordNewsClick(
  newsId: string,
  req: Request,
  db: any,
): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }

  const { fresh, identity } = await shouldCount(`click:news:${newsId}`, req)
  if (!fresh) return { counted: false }

  const ip = getClientIP(req)
  const referrer = req.headers.get('referer')

  await Promise.all([
    db.news.update({
      where: { id: newsId },
      data: { clicksCount: { increment: 1 } },
    }),
    db.newsClick.create({
      data: {
        newsId,
        userId: identity.authenticated ? identity.identity.slice(2) : null,
        ipAddress: identity.authenticated ? null : ip,
        userAgent: userAgent?.substring(0, 200) || null,
        referrer,
      },
    }),
  ])
  return { counted: true }
}
