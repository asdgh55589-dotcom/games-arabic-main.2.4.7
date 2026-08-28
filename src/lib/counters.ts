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
 * - Bots الواضحة: لا تُحتسب إطلاقاً
 */

import { redisSetNX } from './redis'
import { getUserIdFromRequestCookies } from './auth'
import { clearHomeCache } from './home-cache'

const HOUR = 3600
const DAY = 86400

/** أنماط bots — لا نرفض privacy browsers بدون UA */
const BOT_PATTERN = /bot|crawler|spider|crawling|headless|phantom|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|python-requests|curl\/|wget|axios\/|node-fetch/i

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false // Privacy browsers (Brave, Firefox Focus) — لا نرفض، نستخدم dedup أشد
  return BOT_PATTERN.test(userAgent)
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
 * fail-open عند فشل Redis كلياً: يُرجع false لمنع التضخم (الذاكرة المحلية تغطي الحالة الشائعة).
 */
async function shouldCount(scope: string, req: Request): Promise<{ fresh: boolean; identity: CounterIdentity }> {
  const identity = await resolveIdentity(req)
  const fresh = await redisSetNX(`count:${scope}:${identity.identity}`, identity.ttl)
  return { fresh, identity }
}

export interface RecordResult {
  counted: boolean
}

/**
 * تسجيل مشاهدة تعريب — تكتب صف ModView وتزيد العداد فقط للمشاهدة الفريدة.
 * يُرجع counted=false للمكرر أو الـ bots.
 */
export async function recordModView(
  modId: string,
  req: Request,
  db: any
): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }

  const { fresh, identity } = await shouldCount(`view:mod:${modId}`, req)
  if (!fresh) return { counted: false }

  const ip = getClientIP(req)

  // Atomic transaction for view count — مع fallback لـ test mocks
  if (typeof db.$transaction === 'function') {
    await db.$transaction(async (tx: any) => {
      await tx.mod.update({
        where: { id: modId },
        data: { views: { increment: 1 } },
      })
      await tx.modView.create({
        data: {
          modId,
          userId: identity.authenticated ? identity.identity.slice(2) : null,
          ipAddress: identity.authenticated ? null : ip,
          userAgent: userAgent?.substring(0, 200) || null,
        },
      })
    })
  } else {
    await Promise.all([
      db.mod.update({
        where: { id: modId },
        data: { views: { increment: 1 } },
      }),
      db.modView.create({
        data: {
          modId,
          userId: identity.authenticated ? identity.identity.slice(2) : null,
          ipAddress: identity.authenticated ? null : ip,
          userAgent: userAgent?.substring(0, 200) || null,
        },
      }),
    ])
  }
  try { clearHomeCache() } catch {}
  return { counted: true }
}

/**
 * تسجيل مشاهدة صفحة فريق — عداد Team.views مع dedup بنفس سياسة المشاهدات.
 */
export async function recordTeamView(
  teamId: string,
  req: Request,
  db: any
): Promise<RecordResult> {
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
 * تسجيل تحميل فعلي — يزيد Mod.downloads ويسجل DownloadClick فقط للأحداث الفريدة.
 * السياسة: مسجل 1/ملف/يوم، زائر 1/IP/ساعة.
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
  db: any
): Promise<RecordResult> {
  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return { counted: false }

  const scopeKey = opts.linkId ? `dl:link:${opts.linkId}` : `dl:mod:${opts.modId}`
  const { fresh } = await shouldCount(scopeKey, req)
  if (!fresh) return { counted: false }

  const identityUserId = opts.userId ?? null
  const ip = getClientIP(req)
  const referrer = req.headers.get('referer')

  // Atomic transaction: Mod + DownloadClick + Game + Series — مع fallback للـ test mocks
  if (typeof db.$transaction === 'function') {
    await db.$transaction(async (tx: any) => {
      await tx.mod.update({
        where: { id: opts.modId },
        data: { downloads: { increment: 1 } },
      })
      await tx.downloadClick.create({
        data: {
          modId: opts.modId,
          fileId: opts.fileId ?? null,
          linkId: opts.linkId ?? null,
          linkUrl: opts.linkUrl ?? '',
          userId: identityUserId,
          ipAddress: ip,
          userAgent: userAgent?.substring(0, 200) || null,
          referrer,
        },
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
      } catch {}
    })
  } else {
    await Promise.all([
      db.mod.update({
        where: { id: opts.modId },
        data: { downloads: { increment: 1 } },
      }),
      db.downloadClick.create({
        data: {
          modId: opts.modId,
          fileId: opts.fileId ?? null,
          linkId: opts.linkId ?? null,
          linkUrl: opts.linkUrl ?? '',
          userId: identityUserId,
          ipAddress: ip,
          userAgent: userAgent?.substring(0, 200) || null,
          referrer,
        },
      }),
    ])
    // Best-effort cascade for non-transactional mocks
    try {
      if (db.game && db.mod?.findUnique) {
        const mod = await db.mod.findUnique({ where: { id: opts.modId }, select: { gameId: true, seriesId: true } })
        if (mod?.gameId && db.game?.update) await db.game.update({ where: { id: mod.gameId }, data: { totalDownloads: { increment: 1 } } })
        if (mod?.seriesId && db.series?.update) await db.series.update({ where: { id: mod.seriesId }, data: { totalDownloads: { increment: 1 } } })
      }
    } catch {}
  }
  try { clearHomeCache() } catch {}
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
export async function recordNewsClick(newsId: string, req: Request, db: any): Promise<RecordResult> {
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
