import { NextRequest } from 'next/server'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, validationFail, notFound, forbidden, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { action } = body as { action?: string }

    if (!action) return validationFail('إجراء مطلوب')

    const mod = await db.mod.findUnique({ where: { id } })
    if (!mod) return notFound('التعريب غير موجود')

    // Check ownership — only author or admin+ can manage
    if (mod.authorId !== user.id && !['admin', 'manager', 'owner'].includes(user.role)) {
      return forbidden('ليس لديك صلاحية تعديل هذا التعريب')
    }

    switch (action) {
      case 'submit': {
        if (mod.workflowStatus !== 'DRAFT') {
          return validationFail('يمكن إرسال المسودات فقط للمراجعة')
        }
        await db.$transaction(async (tx) => {
          await tx.mod.update({
            where: { id: mod.id },
            data: { workflowStatus: 'IN_REVIEW', submittedAt: new Date() },
          })
          await tx.workflowEntry.create({
            data: {
              modId: mod.id,
              fromStatus: 'DRAFT',
              toStatus: 'IN_REVIEW',
              changedBy: user.id,
            },
          })
        })
        return ok({ success: true, message: 'تم إرسال التعريب للمراجعة' })
      }

      case 'archive': {
        if (mod.workflowStatus !== 'PUBLISHED') {
          return validationFail('يمكن أرشفة التعريبات المنشورة فقط')
        }
        await db.$transaction(async (tx) => {
          await tx.mod.update({
            where: { id: mod.id },
            data: { workflowStatus: 'ARCHIVED', archivedAt: new Date() },
          })
          await tx.workflowEntry.create({
            data: {
              modId: mod.id,
              fromStatus: 'PUBLISHED',
              toStatus: 'ARCHIVED',
              changedBy: user.id,
            },
          })
        })
        return ok({ success: true, message: 'تم أرشفة التعريب' })
      }

      case 'delete': {
        if (!['DRAFT', 'ARCHIVED', 'REJECTED'].includes(mod.workflowStatus)) {
          return validationFail('يمكن حذف المسودات والمؤرشفة والمرفوضة فقط')
        }
        await db.mod.delete({ where: { id: mod.id } })
        return ok({ success: true, message: 'تم حذف التعريب' })
      }

      default:
        return validationFail('إجراء غير صالح')
    }
  } catch (err) {
    console.error('[creator/mods actions] failed:', err)
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) return forbidden('غير مصرح')
    return internalError('فشل تنفيذ الإجراء')
  }
}
