import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { setRoleCookie, getBanStatus, type UserRole } from '@/lib/auth'
import { logAction } from '@/lib/audit'

// تحديد الـ base URL بناءً على الـ request
function getBaseUrl(req: NextRequest): string {
  // استخدام x-forwarded-host للـ production (Vercel)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  return `${protocol}://${host}`
}

// GET /api/auth/callback — استقبال callback من Supabase بعد نجاح OAuth
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') || '/'
    // حماية من Open Redirect — السماح بالمسارات النسبية فقط
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
    const baseUrl = getBaseUrl(req)

    // إنشاء عميل Supabase واحد فقط
    const supabase = await createClient()

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[auth/callback] Code exchange failed:', error.message)
        return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl))
      }
    }

    // قراءة بيانات المستخدم من Supabase session (نفس العميل)
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return NextResponse.redirect(new URL('/?error=no_session', baseUrl))
    }

    // استخراج مزود OAuth
    const provider = supabaseUser.app_metadata?.provider || 'email'
    const providerAccountId = supabaseUser.id

    // استخراج بيانات المستخدم من metadata
    const email = supabaseUser.email || ''
    const avatarUrl = supabaseUser.user_metadata?.avatar_url
      || supabaseUser.user_metadata?.picture
      || null
    const fullName = supabaseUser.user_metadata?.full_name
      || supabaseUser.user_metadata?.name
      || ''
    const username = supabaseUser.user_metadata?.username
      || supabaseUser.user_metadata?.preferred_username
      || fullName
      || email.split('@')[0]
      || 'مستخدم'

    // البحث عن المستخدم في Neon DB
    let neonUser = await db.user.findFirst({
      where: {
        OR: [
          { supabaseId: supabaseUser.id },
          { email: email.toLowerCase() },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        banStatus: true,
        bannedUntil: true,
        banReason: true,
        tokenVersion: true,
      },
    })

    if (neonUser) {
      // المستخدم موجود — تحديث البيانات إذا لزم الأمر
      const updateData: Record<string, unknown> = {}

      if (!neonUser.avatarUrl && avatarUrl) {
        updateData.avatarUrl = avatarUrl
      }
      if (provider !== 'email') {
        updateData.provider = provider
        updateData.providerAccountId = providerAccountId
      }

      if (Object.keys(updateData).length > 0) {
        neonUser = await db.user.update({
          where: { id: neonUser.id },
          data: updateData,
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            avatarUrl: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
            tokenVersion: true,
          },
        })
      }
    } else {
      // مستخدم جديد — إنشاء ملف شخصي
      // التحقق من تفرد username
      let finalUsername = username
      let counter = 1
      while (true) {
        const existing = await db.user.findUnique({
          where: { username: finalUsername },
          select: { id: true },
        })
        if (!existing) break
        finalUsername = `${username}${counter}`
        counter++
      }

      neonUser = await db.user.create({
        data: {
          supabaseId: supabaseUser.id,
          username: finalUsername,
          email: email.toLowerCase(),
          avatarUrl,
          role: 'member',
          provider,
          providerAccountId,
          emailVerified: true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatarUrl: true,
          banStatus: true,
          bannedUntil: true,
          banReason: true,
          tokenVersion: true,
        },
      })
    }

    // فحص الحظر
    const ban = getBanStatus(neonUser)
    if (ban.banned) {
      return NextResponse.redirect(new URL('/?error=banned', baseUrl))
    }

    // إنشاء role cookie مع tokenVersion
    await setRoleCookie(neonUser.id, neonUser.role as UserRole, neonUser.tokenVersion)

    // تحديث lastLoginAt + loginCount
    await db.user.update({
      where: { id: neonUser.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    // تسجيل audit
    await logAction({
      userId: neonUser.id,
      username: neonUser.username,
      action: 'login',
      entity: 'user',
      entityId: neonUser.id,
    })

    // redirect
    return NextResponse.redirect(new URL(next, baseUrl))
  } catch (err) {
    console.error('[auth/callback] failed:', err instanceof Error ? err.message : 'unknown error')
    const baseUrl = getBaseUrl(req)
    return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl))
  }
}
