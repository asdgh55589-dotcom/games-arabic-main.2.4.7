import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword } from '@/lib/auth'
import { parsePagination } from '@/lib/api-utils'
import { ok, okPaginated, fail, forbidden, internalError, validationFail } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/server'
import { canAssignRole } from '@/lib/permissions'

// GET /api/admin/users — قائمة المستخدمين مع pagination + فلتر
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const { page, limit } = parsePagination(
      searchParams.get('page'),
      searchParams.get('limit'),
      { limit: 50, maxLimit: 100 }
    )
    const search = searchParams.get('search')?.trim() || null
    const role = searchParams.get('role') || null
    const banned = searchParams.get('banned') || null

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (role) where.role = role
    if (banned === 'banned') {
      // حظر دائم أو مؤقت ساري
      ;(where as any).bannedUntil = { not: null, gt: new Date() }
    }
    if (banned === 'active') {
      const activeOr = [{ bannedUntil: null }, { bannedUntil: { lte: new Date() } }]
      if (search && where.OR) {
        const searchOr = where.OR
        delete where.OR
        ;(where as any).AND = [{ OR: searchOr }, { OR: activeOr }]
      } else {
        where.OR = activeOr
      }
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          bio: true,
          role: true,
          tier: true,
          specialRoles: true,
          bannedUntil: true,
          banStatus: true,
          banReason: true,
          bannedBy: true,
          bannedAt: true,
          lastLoginAt: true,
          loginCount: true,
          joinedAt: true,
          _count: { select: { mods: true, comments: true, endorsements: true } },
        },
      }),
    ])

    return okPaginated(users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin/users GET] failed:', err)
    return internalError('Failed')
  }
}

// POST /api/admin/users — إنشاء مستخدم جديد (admin/owner)
// ملاحظة: المستخدمون يسجلون عبر OAuth فقط. هذا الـ route للإنشاء اليدوي من الإدارة.
export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAdmin()
    const body = await req.json()

    if (!body.email) {
      return validationFail({ message: 'البريد مطلوب' })
    }

    // استخدام username المُعطى أو توليده من البريد
    let username = body.username
    if (!username) {
      const { generateUsernameFromEmail } = await import('@/lib/username-generator')
      username = await generateUsernameFromEmail(body.email)
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ username }, { email: body.email }] },
    })
    if (existing) {
      return validationFail({ message: 'اسم المستخدم أو البريد مستخدم بالفعل' })
    }

    const role = body.role || 'member'
    if (!canAssignRole(currentUser.role, role)) {
      return forbidden(`Forbidden — your role (${currentUser.role}) cannot assign role: ${role}`)
    }

    const user = await db.user.create({
      data: {
        username,
        displayName: body.displayName || null,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        email: body.email,
        avatarUrl: body.avatarUrl || null,
        bio: body.bio || null,
        role,
      },
      select: { id: true, username: true, displayName: true, email: true, role: true, avatarUrl: true },
    })

    // ===== إنشاء حساب Supabase (FIX #2) =====
    if (body.password && typeof body.password === 'string' && body.password.trim()) {
      const rawPassword = body.password.trim()
      if (rawPassword.length < 8) {
        await db.user.delete({ where: { id: user.id } })
        return fail('VALIDATION_ERROR', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400)
      }
      const adminClient = createAdminClient()
      if (adminClient) {
        try {
          const { data: supabaseUser, error: createError } = await adminClient.auth.admin.createUser({
            email: body.email.toLowerCase(),
            password: rawPassword,
            email_confirm: true,
            user_metadata: {
              username,
              display_name: body.displayName || username,
            },
          })
          if (createError) {
            console.error('[admin/users POST] Supabase creation failed:', createError)
            await db.user.delete({ where: { id: user.id } })
            return fail('INTERNAL_ERROR', 'فشل إنشاء حساب المصادقة: ' + createError.message, 500)
          }
          if (supabaseUser?.user?.id) {
            await db.user.update({
              where: { id: user.id },
              data: { supabaseId: supabaseUser.user.id } as any,
            })
          }
          // حفظ كلمة المرور مشفرة محلياً أيضاً للتوافق
          try {
            const hashed = await hashPassword(rawPassword)
            await db.user.update({ where: { id: user.id }, data: { password: hashed } as any })
          } catch {}
        } catch (error) {
          console.error('[admin/users POST] Supabase creation error:', error)
          await db.user.delete({ where: { id: user.id } })
          return fail('INTERNAL_ERROR', 'خطأ في إنشاء حساب المصادقة', 500)
        }
      } else {
        // Supabase غير مُهيأ — fallback محلي فقط
        try {
          const hashed = await hashPassword(rawPassword)
          await db.user.update({ where: { id: user.id }, data: { password: hashed } as any })
        } catch {}
      }
    }

    return ok(user)
  } catch (err) {
    console.error('[admin/users POST] failed:', err)
    return internalError('Failed to create user')
  }
}
