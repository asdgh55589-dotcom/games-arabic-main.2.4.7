/**
 * middleware.ts — حماية الـ routes الخاصة بلوحة التحكم + تحديث Supabase session.
 *
 * مهم: الـ middleware بيشتغل في Edge runtime، فمينفعش نستورد Prisma أو أي
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

    // Validate tokenVersion against Redis cache (Edge-safe)
    // If cache has a value and it doesn't match → session revoked
    if (tv !== undefined && userId) {
      const cachedTv = await getTokenVersionCache(userId)
      if (cachedTv !== null && cachedTv !== tv) {
        return null  // Session revoked — tv mismatch
      }
    }

    return { userId, role, tv }
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
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

  // ===== Supabase session refresh (CRITICAL: wrapped in try-catch) =====
  // If Supabase is unreachable, public routes MUST still work.
  let user: { id: string } | null = null
  let supabaseResponse = NextResponse.next({ request: req })

  try {
    const { supabase, response } = await updateSession(req)
    const { data } = await supabase.auth.getUser()
    user = data.user
    supabaseResponse = response
  } catch (err) {
    // Supabase unreachable — continue without session.
    // Public routes work normally; admin routes will fail auth check below.
    console.error('[Middleware] Supabase session error:', err)
  }

  // ===== IP ban check (ONLY for write/sensitive paths) =====
  // Read-only operations (GET /api/mods, /api/games, etc.) are NOT checked.
  // This prevents Redis/cache failures from blocking all data loading.
  const isWritePath =
    (pathname.startsWith('/api/auth') && req.method !== 'GET') ||
    (pathname.startsWith('/api/comments') && req.method !== 'GET') ||
    (pathname.startsWith('/api/mods') && req.method !== 'GET') ||
    pathname.startsWith('/api/admin/users')

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
      console.error('[Middleware] IP ban check failed:', err)
    }
  }

  // حماية /admin/* (مش /admin/login) — تحقق من role cookie + Supabase session
  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.includes(pathname)) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role || !user) {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    // مش moderator أو أعلى → redirect لـ /admin/login مع رسالة خطأ
    if (rolePayload.role !== 'moderator' && rolePayload.role !== 'admin' && rolePayload.role !== 'manager' && rolePayload.role !== 'owner') {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('error', 'insufficient_role')
      return NextResponse.redirect(loginUrl)
    }
  }

  // حماية /api/admin/* — تحقق من role cookie + Supabase session
  if (pathname.startsWith('/api/admin')) {
    const rolePayload = await getRoleFromCookie(req)
    if (!rolePayload?.role || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (rolePayload.role !== 'moderator' && rolePayload.role !== 'admin' && rolePayload.role !== 'manager' && rolePayload.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden — insufficient role' }, { status: 403 })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
