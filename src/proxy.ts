/**
 * proxy.ts — حماية الـ routes الخاصة بلوحة التحكم + تحديث Supabase session.
 * (Next.js 16: تم ترحيله من middleware.ts إلى proxy.ts — المنطق مطابق 100%)
 *
 * مهم: الـ proxy بيشتغل في Edge runtime، فمينفعش نستورد Prisma أو أي
 * Node-only module هنا. بنستخدم role cookie موقّع (JWT) للتحقق من الصلاحيات.
 *
 *   - /admin/*         → لازم يكون مسجّل دخول (moderator أو أعلى) — role cookie
 *   - /api/admin/*     → نفس الشرط
 *   - /admin/login     → مسموح للجميع (للتسجيل)
 *   - /api/auth/login  → مسموح للجميع
 *   - باقي الـ routes → Supabase session refresh
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { updateSession } from '@/lib/supabase/middleware'
import { getIpBanCache } from '@/lib/ip-ban-cache'
import { getTokenVersionCache } from '@/lib/token-version-cache'
import { logger } from '@/lib/logger'

const ROLE_COOKIE_NAME = 'ga_admin_role'
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secret)
})()

const PUBLIC_ADMIN_PATHS = ['/admin/login']

interface RoleCookiePayload {
  userId?: string
  role?: string
  tv?: number // tokenVersion
}

/** قراءة الـ userId + role + tokenVersion من الـ role cookie (Edge-compatible) */
async function getRoleFromCookie(req: NextRequest): Promise<RoleCookiePayload | null> {
  const token = req.cookies.get(ROLE_COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userId = payload.userId as string
    const role = payload.role as string
    const tv = typeof payload.tv === 'number' ? payload.tv : undefined

    // Validate tokenVersion against Redis cache (Edge-safe) — مع timeout 1s
    // If cache has a value and it doesn't match → session revoked
    // لو Redis معلق، نتجاهل الفحص (fail-open) بدل ما نعلق الـ middleware
    if (tv !== undefined && userId) {
      try {
        const cachedTv = await Promise.race([
          getTokenVersionCache(userId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
        ])
        if (cachedTv !== null && cachedTv !== tv) {
          return null  // Session revoked — tv mismatch
        }
      } catch {
        // Redis فشل — نسمح بالمرور (لا نكسر تسجيل الدخول بسبب cache)
      }
    }

    return { userId, role, tv }
  } catch (err) {
    logger.warn('[middleware] invalid role cookie', err)
    return null
  }
}

/** نسخ الـ cookies من response إلى آخر (للحفاظ على refresh عند الـ redirect) */
function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c as never)
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ===== SPA → File-based route redirects (301) =====
  const view = req.nextUrl.searchParams.get('view')
  if (view) {
    let destination: string | null = null
    switch (view) {
      case 'platform': {
        const platform = req.nextUrl.searchParams.get('platform')
        if (platform) destination = `/platform/${encodeURIComponent(platform)}`
        break
      }
      case 'profile': {
        const user = req.nextUrl.searchParams.get('user')
        if (user) destination = `/profile/${encodeURIComponent(user)}`
        break
      }
      case 'series-detail': {
        const series = req.nextUrl.searchParams.get('series')
        if (series) destination = `/series/${encodeURIComponent(series)}`
        break
      }
      case 'team-detail': {
        const team = req.nextUrl.searchParams.get('team')
        if (team) destination = `/teams/${encodeURIComponent(team)}`
        break
      }
      case 'search': {
        const q = req.nextUrl.searchParams.get('q')
        if (q) destination = `/search?q=${encodeURIComponent(q)}`
        break
      }
    }
    if (destination) {
      return NextResponse.redirect(new URL(destination, req.url), 301)
    }
  }

  // ===== UTM Tracking (fire-and-forget) — Issue 7 =====
  if (
    pathname !== '/api/utm/track' &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api/')
  ) {
    const utmSource = req.nextUrl.searchParams.get('utm_source')
    const utmMedium = req.nextUrl.searchParams.get('utm_medium')
    const utmCampaign = req.nextUrl.searchParams.get('utm_campaign')
    if (utmSource || utmMedium || utmCampaign) {
      const origin = req.nextUrl.origin
      // Fire-and-forget — لا ننتظر، لا نحجب الطلب
      fetch(`${origin}/api/utm/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': req.headers.get('x-forwarded-for') || '',
          'user-agent': req.headers.get('user-agent') || '',
          cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          source: utmSource,
          medium: utmMedium,
          campaign: utmCampaign,
        }),
      }).catch(() => {})
    }
  }

  // ===== Supabase session refresh (CRITICAL: wrapped in try-catch + timeout) =====
  // If Supabase is unreachable, public routes MUST still work.
  // نضيف timeout 4s لمنع تعليق الـ middleware
  let user: { id: string } | null = null
  let supabaseResponse = NextResponse.next({ request: req })

  try {
    const result = await Promise.race([
      updateSession(req),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase timeout')), 8000)
      ),
    ])
    user = result.user
    supabaseResponse = result.response
  } catch (err) {
    // Supabase unreachable/timeout — continue without session.
    // Public routes work normally; admin routes تعتمد على role cookie كـ fallback.
    if ((err as Error)?.message !== 'Supabase timeout') {
      logger.error('[Middleware] Supabase session error', err)
    }
  }

  // ===== IP ban check (ONLY for write/sensitive paths) =====
  // Read-only operations (GET /api/mods, /api/games, etc.) are NOT checked.
  // This prevents Redis/cache failures from blocking all data loading.
  const isWritePath =
    (pathname.startsWith('/api/auth') && req.method !== 'GET') ||
    (pathname.startsWith('/api/comments') && req.method !== 'GET') ||
    (pathname.startsWith('/api/mods') && req.method !== 'GET') ||
    pathname.startsWith('/api/admin/users') ||
    (pathname.startsWith('/api/reports') && req.method === 'POST')

  if (isWritePath) {
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
      if (ip) {
        const ipBan = await getIpBanCache(ip)
        if (ipBan?.banned) {
          return NextResponse.json(
            { error: 'تم حظر عنوان IP الخاص بك', code: 'IP_BANNED' },
            { status: 403 }
          )
        }
      }
    } catch (err) {
      // If Redis/cache fails, allow the request (don't block all users)
      logger.error('[Middleware] IP ban check failed', err)
    }
  }

  // حماية /admin/* (مش /admin/login) — تحقق من role cookie فقط
  // لا نطلب Supabase user هنا — الـ cookie وحده كافٍ (يدعم Telegram + يمنع التعليق لو Supabase بطيء)
  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.includes(pathname)) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role) {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('from', pathname)
      const redirectRes = NextResponse.redirect(loginUrl)
      copyCookies(supabaseResponse, redirectRes)
      // Debugging header — helps identify invalid/expired cookie vs missing cookie
      if (req.cookies.has(ROLE_COOKIE_NAME)) {
        redirectRes.headers.set('x-auth-reason', 'invalid_jwt')
      }
      return redirectRes
    }
    // مش moderator أو أعلى → redirect لـ /admin/login مع رسالة خطأ
    // التسلسل: member < creator < publisher < moderator < admin < manager < owner
    if (!['moderator', 'admin', 'manager', 'owner'].includes(rolePayload.role)) {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('error', 'insufficient_role')
      const redirectRes = NextResponse.redirect(loginUrl)
      copyCookies(supabaseResponse, redirectRes)
      return redirectRes
    }
  }

  // حماية /api/admin/* — تحقق من role cookie فقط
  if (pathname.startsWith('/api/admin')) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (req.cookies.has(ROLE_COOKIE_NAME)) {
        res.headers.set('x-auth-reason', 'invalid_jwt')
      }
      return res
    }
    if (!['moderator', 'admin', 'manager', 'owner'].includes(rolePayload.role)) {
      return NextResponse.json({ error: 'Forbidden — insufficient role' }, { status: 403 })
    }
  }

  // حماية /creator/* — creator/publisher فقط (moderator+ يُمنع)
  if (pathname.startsWith('/creator')) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', pathname)
      const redirectRes = NextResponse.redirect(loginUrl)
      copyCookies(supabaseResponse, redirectRes)
      return redirectRes
    }
    const CREATOR_ONLY = ['creator', 'publisher']
    if (!CREATOR_ONLY.includes(rolePayload.role)) {
      const homeUrl = new URL('/', req.url)
      const redirectRes = NextResponse.redirect(homeUrl)
      copyCookies(supabaseResponse, redirectRes)
      return redirectRes
    }
  }

  // حماية /api/creator/* — creator/publisher فقط
  if (pathname.startsWith('/api/creator')) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const CREATOR_ONLY = ['creator', 'publisher']
    if (!CREATOR_ONLY.includes(rolePayload.role)) {
      return NextResponse.json({ error: 'Forbidden — creator access required' }, { status: 403 })
    }
  }

  return addSecurityHeaders(supabaseResponse)
}

// Alias للتوافق الخلفي — بعض الأدوات قد تستورد middleware
export async function middleware(req: NextRequest) {
  return proxy(req)
}

// Default export — يدعمه Next.js 16 لـ proxy.ts (mod.proxy || mod.default)
export default proxy

// ===== Security Headers =====

function addSecurityHeaders(response: NextResponse): NextResponse {
  // HSTS — forces HTTPS for 1 year
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  // CSP — Content Security Policy
  // Note: 'unsafe-eval' is required for Next.js webpack in development (and for hydration). Removing it breaks main-app.js.
  // Keeping it with comment for future nonce migration.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: https://img.youtube.com https://i.ytimg.com https://*.ytimg.com https://res.cloudinary.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://*.googlevideo.com https://*.ytimg.com",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://youtu.be https://m.youtube.com https://music.youtube.com https://*.youtube.com https://*.youtube-nocookie.com",
      "media-src 'self' https://*.youtube.com https://*.googlevideo.com https://*.ytimg.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )

  // Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // XSS protection (legacy but still useful)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Restrict browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
