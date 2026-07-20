import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { Prisma } from '@prisma/client'

// POST /api/auth/sync-user — مزامنة بيانات المستخدم من Supabase Auth إلى Neon DB
// محمي: يجب أن يكون المستخدم مسجّل دخول في Supabase Auth
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'auth:sync' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    // ===== تحقق من جلسة Supabase (منع Account Takeover) =====
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const body = await req.json()
    const { supabaseUserId, username, email } = body

    // ===== التحقق أن البيانات تتطابق مع الجلسة =====
    if (supabaseUserId && supabaseUser.id !== supabaseUserId) {
      return NextResponse.json({ error: 'معرّف المستخدم غير متطابق' }, { status: 403 })
    }
    if (email && supabaseUser.email && email.toLowerCase() !== supabaseUser.email.toLowerCase()) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير متطابق' }, { status: 403 })
    }

    // استخدم بيانات الجلسة كـ source of truth (تجاهل الـ body)
    const finalUsername = username?.trim() || supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || 'مستخدم'
    const finalEmail = supabaseUser.email?.toLowerCase() || email?.toLowerCase()

    if (!finalEmail) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 })
    }

    // البحث عن المستخدم بـ supabaseId أو بالبريد الإلكتروني
    let user = await db.user.findFirst({
      where: {
        OR: [
          { supabaseId: supabaseUser.id },
          { email: finalEmail },
        ],
      },
    })

    if (user) {
      // تحديث بيانات المستخدم الموجود — ربط supabaseId
      // لو الـ username جديد، تحقق أنه لا يتعارض مع مستخدم آخر
      if (finalUsername !== user.username) {
        const existing = await db.user.findFirst({
          where: { username: finalUsername, id: { not: user.id } },
        })
        if (existing) {
          return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل', code: 'USERNAME_TAKEN' }, { status: 409 })
        }
      }

      user = await db.user.update({
        where: { id: user.id },
        data: {
          supabaseId: supabaseUser.id,
          username: finalUsername,
          email: finalEmail,
        },
      })
    } else {
      // إنشاء مستخدم جديد
      try {
        user = await db.user.create({
          data: {
            supabaseId: supabaseUser.id,
            username: finalUsername,
            email: finalEmail,
            role: 'member',
          },
        })
      } catch (err) {
        // P2002 = unique constraint violation (إيميل أو username مكرر)
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return NextResponse.json({ error: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل', code: 'CONFLICT' }, { status: 409 })
        }
        throw err
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (err) {
    console.error('[sync-user] failed:', err)
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
  }
}
