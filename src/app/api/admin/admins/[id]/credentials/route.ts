import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { logUserAction } from '@/lib/audit'
import { hashPassword, invalidateUserSessions, requireOwner } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashSecurityKey, validateSecurityKey } from '@/lib/security-key'
import { createAdminClient } from '@/lib/supabase/server'

interface Params {
  params: Promise<{ id: string }>
}

// PUT /api/admin/admins/[id]/credentials — تحديث بيانات الاعتماد (password / securityKey / expiry)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireOwner()
    const { id } = await params
    const body = await req.json()

    const target = await db.user.findUnique({ where: { id } })
    if (!target) return notFound('المستخدم غير موجود')

    if (target.role === 'owner' && currentUser.id !== target.id && currentUser.role !== 'owner') {
      return forbidden('لا يمكن تعديل بيانات مالك آخر')
    }

    const updateData: Record<string, any> = {}
    let auditReason = ''

    // تغيير كلمة المرور
    if (body.password && typeof body.password === 'string' && body.password.trim()) {
      const newPassword = body.password.trim()
      if (newPassword.length < 8) {
        return fail('VALIDATION_ERROR', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400)
      }
      const adminClient = createAdminClient()
      let supabaseUpdated = false
      if (adminClient && target.supabaseId) {
        const { error } = await adminClient.auth.admin.updateUserById(target.supabaseId, {
          password: newPassword,
        })
        if (error) {
          console.error('[credentials PUT] Supabase password update failed:', error)
          return fail('INTERNAL_ERROR', 'فشل تحديث كلمة المرور: ' + error.message, 500)
        }
        supabaseUpdated = true
      }
      const hashed = await hashPassword(newPassword)
      updateData.password = hashed
      // fallback إنشاء Supabase لو بدون supabaseId
      if (!supabaseUpdated && adminClient && !target.supabaseId) {
        try {
          const { data, error } = await adminClient.auth.admin.createUser({
            email: target.email,
            password: newPassword,
            email_confirm: true,
            user_metadata: { username: target.username },
          })
          if (!error && data?.user?.id) {
            updateData.supabaseId = data.user.id
          }
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort credential rotation
        }
      }
      auditReason += 'تغيير كلمة المرور؛ '
    }

    // تغيير مفتاح الأمان
    if (body.securityKey && typeof body.securityKey === 'string' && body.securityKey.trim()) {
      const newKey = body.securityKey.trim()
      const check = validateSecurityKey(newKey)
      if (!check.valid) return fail('VALIDATION_ERROR', check.error!, 400)
      const hashedKey = await hashSecurityKey(newKey)
      updateData.securityKey = hashedKey
      updateData.securityKeyChangedAt = new Date()
      auditReason += 'تجديد مفتاح الأمان؛ '
    }

    // تغيير انتهاء المفتاح
    if (body.keyExpiryDays !== undefined) {
      const val = body.keyExpiryDays
      if (val === null || val === 'بدون' || val === 'بدون انتهاء' || val === 0 || val === '0') {
        updateData.securityKeyExpiresAt = null
        auditReason += 'إزالة انتهاء المفتاح؛ '
      } else {
        const days = Number(val)
        if (isNaN(days) || days <= 0) {
          return fail('VALIDATION_ERROR', 'مدة الانتهاء غير صالحة', 400)
        }
        updateData.securityKeyExpiresAt = new Date(Date.now() + days * 86400000)
        auditReason += `تغيير انتهاء المفتاح إلى ${days} يوم؛ `
      }
    }

    if (Object.keys(updateData).length === 0) {
      return fail('VALIDATION_ERROR', 'لا يوجد حقل للتحديث', 400)
    }

    await db.user.update({ where: { id }, data: updateData })

    // إبطال الجلسات عند تغيير بيانات حساسة
    if (updateData.password || updateData.securityKey) {
      await invalidateUserSessions(id)
    }

    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'CREDENTIALS_UPDATED',
      reason: auditReason.trim() || 'تحديث بيانات الاعتماد',
      request: req,
    })

    return ok({ success: true, message: 'تم تحديث بيانات الاعتماد بنجاح' })
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) return fail('FORBIDDEN', (err as Error).message, status)
    console.error('[credentials PUT] failed:', err)
    return internalError('فشل تحديث البيانات')
  }
}
