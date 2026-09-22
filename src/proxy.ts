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

import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  ADMIN_PAGES_FLAT,
  apiPathToAdminPath,
  findPageForPath,
  isPathAllowedByPagesClaim,
} from '@/lib/admin-pages'
import { getIpBanCache } from '@/lib/ip-ban-cache'
import { logger } from '@/lib/logger'
import { getOnboardingGate, ONBOARDING_PATH } from '@/lib/onboarding'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { withRedisCircuit } from '@/lib/redis-circuit-breaker'
import { updateSession } from '@/lib/supabase/middleware'
import { getTokenVersionCache } from '@/lib/token-version-cache'

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
  tvVerified: boolean
  mfaVerified?: boolean
  onboarded?: boolean // ob claim — absent on legacy cookies (fail-open)
  pages?: string[] // صلاحيات الصفحات المخصصة — غائب = النظام الافتراضي حسب الرتبة
}

/**
 * قراءة الـ userId + role + tokenVersion من الـ role cookie (Edge-compatible).
 * Exported for tier tests. Audit D.2 tiers: strictTv=true (admin/MFA paths)
 * fails CLOSED when tv is present but the cache is unverifiable; default
 * false keeps member pages fail-open (DB check in getSession is truth).
 */
export async function getRoleFromCookie(
  req: NextRequest,
  opts?: { strictTv?: boolean },
): Promise<RoleCookiePayload | null> {
  const token = req.cookies.get(ROLE_COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userId = payload.userId as string
    const role = payload.role as string
    const tv = typeof payload.tv === 'number' ? payload.tv : undefined
    const mfaVerified = payload.mfa === true
    const onboarded = typeof payload.ob === 'boolean' ? (payload.ob as boolean) : undefined
    const pages = Array.isArray(payload.pages)
      ? (payload.pages as unknown[]).filter((k): k is string => typeof k === 'string')
      : undefined

    // Validate tokenVersion against Redis cache (Edge-safe) مع circuit breaker + tvVerified
    // الأمن الحقيقي في getSession() عبر DB — Edge هنا دفاع إضافي فقط، لذا FAIL-OPEN عند عدم وجود Redis
    // مهلة 3s: قراءة Upstash الخام ~0.3s لكن runtime الميدلوير قد ينشغل (بناء/ضغط) — مهلة 1s كانت تطرد الجلسات السليمة.
    let tvVerified = false
    if (tv !== undefined && userId) {
      try {
        const cachedTv = await withRedisCircuit(
          async () =>
            await Promise.race([
              getTokenVersionCache(userId),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
            ]),
          async () => null,
        )

        if (cachedTv === null) {
          // لا يمكن التحقق (لا Redis / Redis متعطل / cache miss).
          // strictTv (admin/MFA): fail-CLOSED — tvVerified=false.
          // default (member pages): FAIL-OPEN — getSession() سيتحقق عبر DB.
          tvVerified = opts?.strictTv !== true
        } else if (cachedTv !== tv) {
          // تباين مؤكد → الجلسة أُبطلت → رفض
          return null
        } else {
          tvVerified = true
        }
      } catch {
        tvVerified = false
        fetch(`${req.nextUrl.origin}/api/telemetry/edge-error`, {
          method: 'POST',
          body: JSON.stringify({
            message: 'token version cache check failed',
            route: req.nextUrl.pathname,
            requestId: req.headers.get('x-request-id') ?? undefined,
          }),
        }).catch(() => {})
      }
    } else {
      tvVerified = false
    }

    return { userId, role, tv, tvVerified, mfaVerified, onboarded, pages }
  } catch (err) {
    logger.warn('[middleware] invalid role cookie', err)
    fetch(`${req.nextUrl.origin}/api/telemetry/edge-error`, {
      method: 'POST',
      body: JSON.stringify({
        message: ((err as Error)?.message ?? 'invalid role cookie').slice(0, 500),
        route: req.nextUrl.pathname,
        requestId: req.headers.get('x-request-id') ?? undefined,
      }),
    }).catch(() => {})
    return null
  }
}

/** نسخ الـ cookies من response إلى آخر (للحفاظ على refresh عند الـ redirect) */
function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c as never)
  }
}

/**
 * SA-3: request correlation ID Plumbing (Edge-safe — Web Crypto only).
 * Reuses the incoming `x-request-id` when present (upstream/CDN propagation),
 * otherwise generates one. Attach to every response via `withRequestId` so
 * clients and logs can correlate a single request end-to-end.
 */
export function getOrCreateRequestId(req: Pick<NextRequest, 'headers'>): string {
  return req.headers.get('x-request-id') ?? crypto.randomUUID()
}

export function withRequestId<T extends NextResponse>(res: T, requestId: string): T {
  res.headers.set('x-request-id', requestId)
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requestId = getOrCreateRequestId(req)

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
      return withRequestId(NextResponse.redirect(new URL(destination, req.url), 301), requestId)
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
          'x-request-id': requestId,
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
        setTimeout(() => reject(new Error('Supabase timeout')), 8000),
      ),
    ])
    user = result.user
    supabaseResponse = result.response
  } catch (err) {
    // Supabase unreachable/timeout — continue without session.
    // Public routes work normally; admin routes تعتمد على role cookie كـ fallback.
    if ((err as Error)?.message !== 'Supabase timeout') {
      logger.error(
        { event: 'proxy_supabase_session_error', requestId, err },
        '[Middleware] Supabase session error',
      )
      fetch(`${req.nextUrl.origin}/api/telemetry/edge-error`, {
        method: 'POST',
        body: JSON.stringify({
          message: ((err as Error)?.message ?? 'supabase session error').slice(0, 500),
          route: pathname,
          requestId,
        }),
      }).catch(() => {})
    }
  }

  // ===== Session ledger check (Supabase single auth) — fail-open, throttled =====
  try {
    const ledgerToken = req.cookies.get('ga_session_ledger')?.value
    if (
      ledgerToken &&
      !pathname.startsWith('/api/auth/ledger-check') &&
      !pathname.startsWith('/api/health') &&
      !pathname.startsWith('/_next') &&
      !pathname.startsWith('/api/auth/callback')
    ) {
      const active = await withRedisCircuit(
        async () =>
          await Promise.race([
            fetch(
              `${req.nextUrl.origin}/api/auth/ledger-check?token=${encodeURIComponent(ledgerToken)}`,
              {
                headers: {
                  cookie: `ga_session_ledger=${ledgerToken}`,
                  'x-request-id': requestId,
                },
                cache: 'no-store',
              },
            )
              .then(async (r) => {
                if (!r.ok) return true
                const j: any = await r.json().catch(() => null)
                return j?.active !== false
              })
              .catch(() => true),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 600)),
          ]),
        async () => true,
      )
      if (active === false) {
        const isProtected =
          pathname.startsWith('/admin') ||
          pathname.startsWith('/creator') ||
          pathname.startsWith('/settings')
        if (isProtected) {
          const loginUrl = pathname.startsWith('/admin')
            ? new URL('/admin/login', req.url)
            : new URL('/login', req.url)
          const res = NextResponse.redirect(loginUrl)
          res.cookies.set('ga_session_ledger', '', { path: '/', maxAge: 0 })
          res.cookies.set('ga_admin_role', '', { path: '/', maxAge: 0 })
          copyCookies(supabaseResponse, res)
          return withRequestId(res, requestId)
        } else {
          supabaseResponse.cookies.set('ga_session_ledger', '', { path: '/', maxAge: 0 })
        }
      }
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort proxy operation
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
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
      if (ip) {
        const ipBan = await getIpBanCache(ip)
        if (ipBan?.banned) {
          return withRequestId(
            NextResponse.json(
              { error: 'تم حظر عنوان IP الخاص بك', code: 'IP_BANNED' },
              { status: 403 },
            ),
            requestId,
          )
        }
      }
    } catch (err) {
      // If Redis/cache fails, allow the request (don't block all users)
      logger.error(
        { event: 'proxy_ip_ban_check_failed', requestId, err },
        '[Middleware] IP ban check failed',
      )
      fetch(`${req.nextUrl.origin}/api/telemetry/edge-error`, {
        method: 'POST',
        body: JSON.stringify({
          message: ((err as Error)?.message ?? 'ip ban check failed').slice(0, 500),
          route: pathname,
          requestId,
        }),
      }).catch(() => {})
    }
  }

  // ===== Rate limit for POST /api/auth/* (max 10/min) — additive, fail-open =====
  if (pathname.startsWith('/api/auth') && req.method === 'POST') {
    try {
      const rl = await withRedisCircuit(
        async () =>
          await Promise.race([
            rateLimit(req, { limit: 10, window: 60, keyPrefix: 'auth:post' }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
          ]),
        async () => null,
      )
      if (rl && !rl.success) {
        return withRequestId(
          NextResponse.json(
            { error: 'محاولات كتير جداً، استنى شوية', code: 'RATE_LIMITED' },
            { status: 429, headers: rateLimitHeaders(rl) },
          ),
          requestId,
        )
      }
    } catch (err) {
      logger.error(
        { event: 'proxy_auth_rate_limit_failed', requestId, err },
        '[Middleware] auth rate limit failed',
      )
      fetch(`${req.nextUrl.origin}/api/telemetry/edge-error`, {
        method: 'POST',
        body: JSON.stringify({
          message: ((err as Error)?.message ?? 'auth rate limit failed').slice(0, 500),
          route: pathname,
          requestId,
        }),
      }).catch(() => {})
    }
  }

  // ===== Ban check on session load (GET /api/auth/*) — additive, fail-open =====
  if (pathname.startsWith('/api/auth') && req.method === 'GET') {
    // IP ban already checked for write paths; this adds check for session loads
    // Do not block if Redis unavailable — fail-open
    try {
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
      if (
        ip &&
        (pathname.includes('session') ||
          pathname.includes('/me') ||
          pathname.includes('get-session'))
      ) {
        const ipBan = await withRedisCircuit(
          async () =>
            await Promise.race([
              getIpBanCache(ip),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
            ]),
          async () => null,
        )
        if (ipBan?.banned) {
          return withRequestId(
            NextResponse.json(
              { error: 'تم حظر عنوان IP الخاص بك', code: 'IP_BANNED' },
              { status: 403 },
            ),
            requestId,
          )
        }
      }
    } catch (err) {
      logger.error(
        { event: 'proxy_session_ban_check_failed', requestId, err },
        '[Middleware] session ban check failed',
      )
      fetch(`${req.nextUrl.origin}/api/telemetry/edge-error`, {
        method: 'POST',
        body: JSON.stringify({
          message: ((err as Error)?.message ?? 'session ban check failed').slice(0, 500),
          route: pathname,
          requestId,
        }),
      }).catch(() => {})
    }
  }

  // ===== Onboarding gate (D.6-a) — members with ob===false funnel to /onboarding =====
  // Edge has no DB access: the ob claim in ga_admin_role carries the flag.
  // Missing claim (legacy cookies) = fail-open; server-side DB flag is truth.
  // Pages → 302, API calls → 403 JSON (so fetch() callers can route client-side).
  {
    const rolePayload = await getRoleFromCookie(req)
    const decision = getOnboardingGate(rolePayload?.role, rolePayload?.onboarded, pathname)
    if (decision === 'redirect') {
      const onboardingUrl = new URL(ONBOARDING_PATH, req.url)
      onboardingUrl.searchParams.set('from', pathname)
      const redirectRes = NextResponse.redirect(onboardingUrl)
      copyCookies(supabaseResponse, redirectRes)
      redirectRes.headers.set('x-auth-reason', 'onboarding_required')
      return withRequestId(redirectRes, requestId)
    }
    if (decision === 'json') {
      return withRequestId(
        NextResponse.json(
          { error: 'أكمل إعداد حسابك أولاً', code: 'ONBOARDING_REQUIRED' },
          { status: 403 },
        ),
        requestId,
      )
    }
  }

  // حماية /admin/* (مش /admin/login) — تحقق من role cookie فقط
  // لا نطلب Supabase user هنا — الـ cookie وحده كافٍ (يدعم Telegram + يمنع التعليق لو Supabase بطيء)
  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.includes(pathname)) {
    // Audit D.2 admin tier: strictTv — tv present but cache unverifiable ⇒ reject.
    const rolePayload = await getRoleFromCookie(req, { strictTv: true })
    if (
      !rolePayload ||
      !['moderator', 'admin', 'manager', 'owner'].includes(rolePayload.role as string)
    ) {
      const loginUrl = new URL('/admin/login', req.url)
      if (!rolePayload?.role) loginUrl.searchParams.set('from', pathname)
      else loginUrl.searchParams.set('error', 'insufficient_role')
      const redirectRes = NextResponse.redirect(loginUrl)
      copyCookies(supabaseResponse, redirectRes)
      if (req.cookies.has(ROLE_COOKIE_NAME) && !rolePayload?.role) {
        redirectRes.headers.set('x-auth-reason', 'invalid_jwt')
      }
      return withRequestId(redirectRes, requestId)
    }
    if (rolePayload.tv !== undefined && rolePayload.tvVerified !== true) {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('token_check_failed', '1')
      const redirectRes = NextResponse.redirect(loginUrl)
      copyCookies(supabaseResponse, redirectRes)
      redirectRes.headers.set('x-auth-reason', 'token_version_unverified')
      console.error('[Proxy] Admin tvVerified failed — rejecting', {
        path: pathname,
        userId: rolePayload.userId,
      })
      return withRequestId(redirectRes, requestId)
    }
    // صلاحيات الصفحات المخصصة — claim موجود + غير مالك ⇒ لازم تطابق.
    // غير المسموح يُحوَّل لأول صفحة مسموحة (المستخدم مصادق عليه — ليست مشكلة دخول).
    if (
      rolePayload.role !== 'owner' &&
      Array.isArray(rolePayload.pages) &&
      rolePayload.pages.length > 0 &&
      !isPathAllowedByPagesClaim(pathname, rolePayload.pages, rolePayload.role as string)
    ) {
      const allowedHrefs = ADMIN_PAGES_FLAT.filter((d) =>
        (rolePayload.pages as string[]).includes(d.key),
      ).map((d) => d.href)
      const target = allowedHrefs[0] ?? '/admin/login'
      const redirectRes = NextResponse.redirect(new URL(target, req.url))
      copyCookies(supabaseResponse, redirectRes)
      redirectRes.headers.set('x-auth-reason', 'page_forbidden')
      return withRequestId(redirectRes, requestId)
    }
    // Audit D.2: MFA enforced for staff pages ONLY when explicitly enabled.
    // Default OFF — set MFA_ENFORCED=1 to require 2FA. /admin/security stays
    // exempt so staff can enroll; verify re-issues the cookie
    // with mfa=true (see mfa/verify route).
    if (
      process.env.MFA_ENFORCED === '1' &&
      !rolePayload.mfaVerified &&
      pathname !== '/admin/security' &&
      !pathname.startsWith('/admin/security')
    ) {
      const securityUrl = new URL('/admin/security', req.url)
      securityUrl.searchParams.set('mfa_required', '1')
      const redirectRes = NextResponse.redirect(securityUrl)
      copyCookies(supabaseResponse, redirectRes)
      redirectRes.headers.set('x-auth-reason', 'mfa_required')
      return withRequestId(redirectRes, requestId)
    }
  }

  // حماية /api/admin/* — تحقق من role cookie فقط
  if (pathname.startsWith('/api/admin')) {
    // Audit D.2 admin tier: strictTv — tv present but cache unverifiable ⇒ reject.
    const rolePayload = await getRoleFromCookie(req, { strictTv: true })
    if (
      !rolePayload ||
      !['moderator', 'admin', 'manager', 'owner'].includes(rolePayload.role as string)
    ) {
      const res = NextResponse.json(
        { error: rolePayload?.role ? 'Forbidden — insufficient role' : 'Unauthorized' },
        { status: rolePayload?.role ? 403 : 401 },
      )
      if (req.cookies.has(ROLE_COOKIE_NAME)) {
        res.headers.set('x-auth-reason', 'invalid_jwt')
      }
      return withRequestId(res, requestId)
    }
    if (rolePayload.tv !== undefined && rolePayload.tvVerified !== true) {
      return withRequestId(
        NextResponse.json(
          { error: 'Unable to verify session token version', code: 'TOKEN_VERSION_UNVERIFIED' },
          { status: 503 },
        ),
        requestId,
      )
    }
    // صلاحيات الصفحات المخصصة على الـ API (‎/api/admin/X ← صفحة ‎/admin/X).
    if (
      rolePayload.role !== 'owner' &&
      Array.isArray(rolePayload.pages) &&
      rolePayload.pages.length > 0
    ) {
      const adminPath = apiPathToAdminPath(pathname)
      const pageDef = adminPath ? findPageForPath(adminPath) : null
      if (!pageDef || !(rolePayload.pages as string[]).includes(pageDef.key)) {
        return withRequestId(
          NextResponse.json({ error: 'غير مصرح لهذه الصفحة', code: 'PAGE_FORBIDDEN' }, { status: 403 }),
          requestId,
        )
      }
    }
    // Audit D.2: MFA enforced for staff APIs ONLY when explicitly enabled
    // (MFA_ENFORCED=1, default OFF). mfa/* stays open for the
    // verify/login handshake itself.
    if (
      process.env.MFA_ENFORCED === '1' &&
      !rolePayload.mfaVerified &&
      !pathname.startsWith('/api/auth/mfa')
    ) {
      return withRequestId(
        NextResponse.json(
          { error: 'المصادقة الثنائية مطلوبة', code: 'MFA_REQUIRED' },
          { status: 403 },
        ),
        requestId,
      )
    }
  }

  // حماية /creator/* — كل الأدوار ما عدا member (المعرّبون + الإدارة)
  if (pathname.startsWith('/creator')) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', pathname)
      const redirectRes = NextResponse.redirect(loginUrl)
      copyCookies(supabaseResponse, redirectRes)
      return withRequestId(redirectRes, requestId)
    }
    const CREATOR_ONLY = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
    if (!CREATOR_ONLY.includes(rolePayload.role)) {
      const becomeUrl = new URL('/become-creator/apply', req.url)
      const redirectRes = NextResponse.redirect(becomeUrl)
      copyCookies(supabaseResponse, redirectRes)
      return withRequestId(redirectRes, requestId)
    }
  }

  // حماية /api/creator/* — كل الأدوار ما عدا member (المعرّبون + الإدارة)
  // ملاحظة: المطابقة على حدّ المقطع (/api/creator/) حتى لا تبتلع
  // مسار /api/creator-requests المخصّص للأعضاء العاديين.
  if (pathname === '/api/creator' || pathname.startsWith('/api/creator/')) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role) {
      return withRequestId(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId)
    }
    const CREATOR_ONLY = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
    if (!CREATOR_ONLY.includes(rolePayload.role)) {
      return withRequestId(
        NextResponse.json({ error: 'Forbidden — creator access required' }, { status: 403 }),
        requestId,
      )
    }
    // Track gate (Phase 4): news.create is publisher-only — translators
    // (creator role) get 403 even though they pass the studio gate above.
    // Role IS the track post-approval (translator→creator, publisher→publisher).
    if (pathname === '/api/creator/news' || pathname.startsWith('/api/creator/news/')) {
      const NEWS_PUBLISHERS = ['publisher', 'moderator', 'admin', 'manager', 'owner']
      if (!NEWS_PUBLISHERS.includes(rolePayload.role)) {
        return withRequestId(
          NextResponse.json(
            { error: 'Forbidden — publisher track required' },
            { status: 403 },
          ),
          requestId,
        )
      }
    }
  }

  // Track gate (Phase 4): /creator/news page is publisher-only — translators
  // fall back to the dashboard (the page itself also renders a notice).
  if (pathname === '/creator/news' || pathname.startsWith('/creator/news/')) {
    const rolePayload = await getRoleFromCookie(req)
    const NEWS_PUBLISHERS = ['publisher', 'moderator', 'admin', 'manager', 'owner']
    if (rolePayload?.role && !NEWS_PUBLISHERS.includes(rolePayload.role)) {
      const dashboardUrl = new URL('/creator', req.url)
      const redirectRes = NextResponse.redirect(dashboardUrl)
      copyCookies(supabaseResponse, redirectRes)
      return withRequestId(redirectRes, requestId)
    }
  }

  supabaseResponse.headers.set('x-request-id', requestId)
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
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  // CSP — Content Security Policy
  // Note: 'unsafe-eval' is required for Next.js webpack in development (and for hydration). Removing it breaks main-app.js.
  // Keeping it with comment for future nonce migration.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://oauth.telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: https://img.youtube.com https://i.ytimg.com https://*.ytimg.com https://images.unsplash.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.supabase.co https://*.supabase.in https://res.cloudinary.com https://telegram.org https://t.me https://iili.io https://freeimage.host https://*.freeimage.host https://img.gamesarabic.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://*.googlevideo.com https://*.ytimg.com https://api.telegram.org",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://youtu.be https://m.youtube.com https://music.youtube.com https://*.youtube.com https://*.youtube-nocookie.com https://oauth.telegram.org https://telegram.org",
      "media-src 'self' https://*.youtube.com https://*.googlevideo.com https://*.ytimg.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
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
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  )

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    // Static assets bypass the proxy entirely (no Supabase/ledger/rate-limit cost).
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|eot|otf|mp4|webm|txt|xml|webmanifest|json|css|js)$).*)',
  ],
}
