import { type NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { getBanStatus, setRoleCookie, type UserRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { generateUniqueUsername, generateUsernameFromEmail } from '@/lib/username-generator'

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
    // Audit D.2: rate-limit the OAuth entry point (code-exchange abuse).
    const { rateLimit } = await import('@/lib/rate-limit')
    const rl = await rateLimit(req, { limit: 20, window: 60, keyPrefix: 'auth:callback' })
    if (!rl.success) {
      return new NextResponse('طلبات كثيرة جداً، انتظر قليلاً وحاول مجدداً', { status: 429 })
    }
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') || '/'
    // حماية من Open Redirect — السماح بالمسارات النسبية فقط
    // يرفض: //evil.com, /\evil.com, URL-encoded variants, protocol-relative URLs, path traversal
    // searchParams.get() تفك الترميز تلقائياً → %2F%2F يصبح // ويُرفض
    const next =
      /^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/.test(rawNext) &&
      !rawNext.startsWith('//') &&
      !rawNext.includes('/../')
        ? rawNext
        : '/'
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
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return NextResponse.redirect(new URL('/?error=no_session', baseUrl))
    }

    // استخراج مزود OAuth
    const provider = supabaseUser.app_metadata?.provider || 'email'
    const providerAccountId = supabaseUser.id

    // استخراج بيانات المستخدم من metadata
    const email = supabaseUser.email || ''
    const avatarUrl =
      supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null
    const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || ''
    let username =
      supabaseUser.user_metadata?.username ||
      supabaseUser.user_metadata?.preferred_username ||
      fullName ||
      ''
    if (!username) {
      username = await generateUsernameFromEmail(email)
    } else {
      username = await generateUniqueUsername(username)
    }

    // الخطوة 1: البحث عن المستخدم في Neon DB عبر supabaseId
    let neonUser = await db.user.findFirst({
      where: { supabaseId: supabaseUser.id },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        role: true,
        avatarUrl: true,
        banStatus: true,
        bannedUntil: true,
        banReason: true,
        tokenVersion: true,
        onboardingCompleted: true,
      },
    })

    if (neonUser) {
      // المستخدم موجود — تحديث avatarUrl إذا كان فارغاً
      if (!neonUser.avatarUrl && avatarUrl) {
        neonUser = await db.user.update({
          where: { id: neonUser.id },
          data: { avatarUrl },
          select: {
            id: true,
            username: true,
            email: true,
            emailVerified: true,
            role: true,
            avatarUrl: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
            tokenVersion: true,
            onboardingCompleted: true,
          },
        })
      }
    } else {
      // الخطوة 2: البحث عبر OAuthAccount
      const existingOAuth = await db.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: provider,
            providerAccountId: providerAccountId,
          },
        },
        include: { user: true },
      })

      if (existingOAuth) {
        neonUser = existingOAuth.user
      } else {
        // الخطوة 3: فحص تداخل البريد الإلكتروني — حظر
        const emailUser = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { id: true },
        })

        if (emailUser) {
          return NextResponse.redirect(new URL('/?error=email_exists_link_accounts', baseUrl))
        }

        // الخطوة 4: إنشاء مستخدم جديد + OAuthAccount (داخل transaction) — username أصبح فريداً مسبقاً عبر generateUniqueUsername
        const finalUsername = username

        neonUser = await db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              supabaseId: supabaseUser.id,
              username: finalUsername,
              email: email.toLowerCase(),
              avatarUrl,
              role: 'member',
              emailVerified: true,
            },
            select: {
              id: true,
              username: true,
              email: true,
              emailVerified: true,
              role: true,
              avatarUrl: true,
              banStatus: true,
              bannedUntil: true,
              banReason: true,
              tokenVersion: true,
              onboardingCompleted: true,
            },
          })

          await tx.oAuthAccount.create({
            data: {
              userId: user.id,
              provider,
              providerAccountId,
              providerEmail: email.toLowerCase(),
              providerUsername: username,
              avatarUrl,
            },
          })

          await tx.notificationPreference
            .create({
              data: {
                userId: user.id,
                emailEnabled: true,
                pushEnabled: true,
                dailySummary: true,
                summaryIntervalDays: 3,
                likeThreshold: 25,
                quietHoursEnabled: false,
                typePreferences: {},
              },
            })
            .catch(() => {})

          return user
        })
      }
    }

    if (!neonUser) {
      return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl))
    }

    // Google OAuth auto-verifies the email — for new AND existing users.
    // No verification emails or messages are ever involved in this flow.
    if (provider === 'google' && 'emailVerified' in neonUser && !neonUser.emailVerified) {
      try {
        await db.user.update({ where: { id: neonUser.id }, data: { emailVerified: true } })
      } catch {
        // best-effort — login continues regardless
      }
    }

    // فحص الحظر
    const ban = getBanStatus(neonUser)
    if (ban.banned) {
      return NextResponse.redirect(new URL('/?error=banned', baseUrl))
    }

    // إنشاء role cookie مع tokenVersion
    await setRoleCookie(neonUser.id, neonUser.role as UserRole, neonUser.tokenVersion, false, neonUser.onboardingCompleted)

    // تحديث lastLoginAt + loginCount
    await db.user.update({
      where: { id: neonUser.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    // إنشاء سجل جلسة مركزي (ledger) لـ Supabase flow
    let ledgerToken: string | null = null
    let ledgerExpires: Date | null = null
    try {
      const { randomUUID } = await import('crypto')
      ledgerToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
      ledgerExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null
      const ua = req.headers.get('user-agent') || null
      await db.session.create({
        data: {
          id: randomUUID(),
          token: ledgerToken,
          userId: neonUser.id,
          expiresAt: ledgerExpires,
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: ip,
          userAgent: ua,
        } as any,
      })
    } catch (e) {
      console.warn('[auth/callback] ledger create failed', e)
    }

    // تسجيل audit
    await logAction({
      userId: neonUser.id,
      username: neonUser.username,
      action: 'login',
      entity: 'user',
      entityId: neonUser.id,
    })

    // redirect مع كوكي ledger
    const res = NextResponse.redirect(new URL(next, baseUrl))
    if (ledgerToken && ledgerExpires) {
      res.cookies.set('ga_session_ledger', ledgerToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: ledgerExpires,
      })
    }
    return res
  } catch (err) {
    console.error('[auth/callback] failed:', err instanceof Error ? err.message : 'unknown error')
    const baseUrl = getBaseUrl(req)
    return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl))
  }
}
