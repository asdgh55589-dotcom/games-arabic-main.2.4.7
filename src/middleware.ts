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

const ROLE_COOKIE_NAME = 'ga_admin_role'
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    return new TextEncoder().encode('fallback-dev-secret-change-in-production')
  }
  return new TextEncoder().encode(secret)
})()

const PUBLIC_ADMIN_PATHS = ['/admin/login']

interface RoleCookiePayload {
  role?: string
  tv?: number // tokenVersion
}

/** قراءة الـ role + tokenVersion من الـ role cookie (Edge-compatible) */
async function getRoleFromCookie(req: NextRequest): Promise<RoleCookiePayload | null> {
  const token = req.cookies.get(ROLE_COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return { role: payload.role as string, tv: typeof payload.tv === 'number' ? payload.tv : undefined }
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // تحديث + التحقق من صلاحية Supabase session (لجميع الـ routes)
  const { supabase, response } = await updateSession(req)
  const { data: { user } } = await supabase.auth.getUser()

  // ===== فحص حظر IP للـ APIs الحساسة (auth + comments + endorse) =====
  // نتجنب فحص كل طلب (أصول ثابتة) — فقط مسارات الكتابة
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/comments') ||
    pathname.startsWith('/api/mods') ||
    pathname.startsWith('/api/admin/users')
  ) {
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
    if (rolePayload.role !== 'moderator' && rolePayload.role !== 'admin' && rolePayload.role !== 'owner') {
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
    if (rolePayload.role !== 'moderator' && rolePayload.role !== 'admin' && rolePayload.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden — insufficient role' }, { status: 403 })
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
