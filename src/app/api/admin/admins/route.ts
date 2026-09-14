import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { logAction, logUserAction } from '@/lib/audit'
import { hashPassword, invalidateUserSessions, requireOwner } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { canAssignRole } from '@/lib/permissions'
import { hashSecurityKey, validateSecurityKey } from '@/lib/security-key'
import { createAdminClient } from '@/lib/supabase/server'

const CreateAdminSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  securityKey: z.string().min(1),
  role: z.string().min(1),
  keyExpiryDays: z.union([z.string(), z.number()]).optional(),
})

// POST /api/admin/admins — إنشاء عضو فريق جديد مع 4 بيانات اعتماد
export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireOwner()

    const body = await req.json()
    const parsed = CreateAdminSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { username, email, password, securityKey, role, keyExpiryDays } = parsed.data

    const keyCheck = validateSecurityKey(securityKey)
    if (!keyCheck.valid) {
      return fail('VALIDATION_ERROR', keyCheck.error!, 400)
    }

    if (!canAssignRole(currentUser.role, role)) {
      return forbidden(`لا تملك صلاحية تعيين هذا الدور: ${role}`)
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ username }, { email }] },
    })
    if (existing) {
      return validationFail({ message: 'اسم المستخدم أو البريد مستخدم بالفعل' })
    }

    // حساب انتهاء المفتاح
    let securityKeyExpiresAt: Date | null = null
    if (keyExpiryDays && keyExpiryDays !== 'بدون' && Number(keyExpiryDays) > 0) {
      const days = Number(keyExpiryDays)
      securityKeyExpiresAt = new Date(Date.now() + days * 86400000)
    }

    const hashedPass = await hashPassword(password)
    const hashedKey = await hashSecurityKey(securityKey)

    // إنشاء المستخدم
    const user = await db.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password: hashedPass,
        securityKey: hashedKey,
        securityKeyExpiresAt,
        securityKeyChangedAt: new Date(),
        role,
      },
      select: { id: true, username: true, email: true, role: true },
    })

    // إنشاء حساب Supabase
    const adminClient = createAdminClient()
    if (adminClient) {
      try {
        const { data: supabaseUser, error: createError } = await adminClient.auth.admin.createUser({
          email: email.toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: { username },
        })
        if (!createError && supabaseUser?.user?.id) {
          await db.user.update({
            where: { id: user.id },
            data: { supabaseId: supabaseUser.user.id } as any,
          })
        } else if (createError) {
          logger.error({ err: createError }, '[admin/admins POST] Supabase creation failed')
          // لا نحذف المستخدم — كلمة المرور المحلية كافية
        }
      } catch (e) {
        logger.error({ err: e }, '[admin/admins POST] Supabase error')
      }
    }

    // سجل التدقيق
    await logUserAction({
      userId: user.id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'STAFF_CREATED',
      reason: `إنشاء عضو جديد بدور ${role} — مفتاح ينتهي ${securityKeyExpiresAt ? securityKeyExpiresAt.toLocaleDateString('ar-EG') : 'بدون انتهاء'}`,
      request: req,
    })

    await logAction({
      userId: currentUser.id,
      username: currentUser.username,
      action: 'STAFF_CREATED',
      entity: 'user',
      entityId: user.id,
      details: JSON.stringify({ username, email, role, keyExpiryDays }),
      request: req,
    })

    return ok({ user, message: 'تم إنشاء العضو بنجاح' })
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) {
      return fail('FORBIDDEN', (err as Error).message, status)
    }
    logger.error({ err }, '[admin/admins POST] failed')
    return internalError('فشل إنشاء العضو')
  }
}

// GET /api/admin/admins — قائمة الفريق (نفس /admin/admins page)
export async function GET(req: NextRequest) {
  try {
    await requireOwner()
    const users = await db.user.findMany({
      where: { role: { in: ['moderator', 'admin', 'manager', 'owner'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        role: true,
        securityKeyExpiresAt: true,
        securityKeyChangedAt: true,
        lastLoginAt: true,
        createdAt: true,
        banStatus: true,
        _count: { select: { mods: true } },
      },
    })
    return ok(users)
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) {
      return fail('FORBIDDEN', (err as Error).message, status)
    }
    logger.error({ err }, '[admin/admins GET] failed')
    return internalError('فشل جلب الفريق')
  }
}
