import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

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

    // Check ownership — author only (Studio gate already restricts to
    // creator/publisher, so no staff bypass is reachable here).
    if (mod.authorId !== user.id) {
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

      case 'resubmit': {
        if (mod.workflowStatus !== 'REJECTED') {
          return validationFail('يمكن فقط إعادة إرسال التعريبات المرفوضة')
        }
        await db.$transaction(async (tx) => {
          await tx.mod.update({
            where: { id: mod.id },
            data: { workflowStatus: 'IN_REVIEW', submittedAt: new Date() },
          })
          await tx.workflowEntry.create({
            data: {
              modId: mod.id,
              fromStatus: 'REJECTED',
              toStatus: 'IN_REVIEW',
              changedBy: user.id,
            },
          })
        })
        // Notify admins
        try {
          const admins = await db.user.findMany({
            where: { role: { in: ['admin', 'manager', 'owner'] } },
            select: { id: true },
          })
          for (const admin of admins) {
            await db.notification.create({
              data: {
                userId: admin.id,
                actorId: user.id,
                type: 'admin_report',
                title: '🔄 إعادة إرسال تعريب',
                message: `${user.username} أعاد إرسال تعريب "${mod.name}" للمراجعة`,
                data: { modId: mod.id, modName: mod.name },
              },
            })
          }
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notification to admins
        }
        return ok({ success: true, message: 'تم إعادة إرسال التعريب للمراجعة' })
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
