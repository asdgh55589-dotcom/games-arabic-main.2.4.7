import { NextRequest } from 'next/server'
import { ok, validationFail, forbidden, notFound, internalError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { isValidTransition, canTransition, type WorkflowStatus } from '@/lib/workflow'
import { canApproveMods } from '@/lib/permissions'
import { notifyWorkflowChange } from '@/lib/mod-notifications'
import { revalidatePath } from 'next/cache'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/admin/mods/[id]/workflow — تغيير حالة التعريب
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params
    const body = await req.json()

    const { toStatus, reason, notes } = body as {
      toStatus: string
      reason?: string
      notes?: string
    }

    if (!toStatus) {
      return validationFail({ toStatus: 'toStatus is required' })
    }

    // جلب التعريب الحالي
    const mod = await db.mod.findUnique({
      where: { id },
      select: { id: true, workflowStatus: true, authorId: true },
    })

    if (!mod) {
      return notFound()
    }

    const fromStatus = mod.workflowStatus as WorkflowStatus
    const targetStatus = toStatus as WorkflowStatus

    // التحقق من صحة الانتقال
    if (!isValidTransition(fromStatus, targetStatus)) {
      return validationFail({
        toStatus: `Invalid transition from ${fromStatus} to ${targetStatus}`,
      })
    }

    // التحقق من الصلاحية — مع دعم الدور الخاص reviewer
    if (!canTransition(user.role, fromStatus, targetStatus)) {
      // reviewer يمكنه الموافقة/الرفض حتى لو ليس admin
      const freshUser = await db.user.findUnique({ where: { id: user.id }, select: { specialRoles: true } })
      const specialRoles = freshUser?.specialRoles || null
      const isReviewerApprove = (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') && canApproveMods(user.role, specialRoles)
      if (!isReviewerApprove) {
        return forbidden(`Your role (${user.role}) cannot perform this transition`)
      }
    }

    // تحديث التعريب + إنشاء سجل في transaction
    const updatedMod = await db.$transaction(async (tx) => {
      // تحديث حالة التعريب
      const updateData: Record<string, unknown> = {
        workflowStatus: targetStatus,
      }

      // تحديث الحقول المرتبطة بالحالة
      if (targetStatus === 'IN_REVIEW') {
        updateData.submittedAt = new Date()
      } else if (targetStatus === 'APPROVED') {
        updateData.reviewedAt = new Date()
        updateData.reviewerId = user.id
      } else if (targetStatus === 'PUBLISHED') {
        updateData.publishedAt = new Date()
      } else if (targetStatus === 'ARCHIVED') {
        updateData.archivedAt = new Date()
      } else if (targetStatus === 'REJECTED') {
        updateData.reviewedAt = new Date()
        updateData.reviewerId = user.id
        updateData.rejectionReason = reason || null
      }

      const updated = await tx.mod.update({
        where: { id },
        data: updateData,
      })

      // إنشاء سجل تغيير الحالة
      await tx.workflowEntry.create({
        data: {
          modId: id,
          fromStatus,
          toStatus: targetStatus,
          changedBy: user.id,
          reason: reason || null,
          notes: notes || null,
        },
      })

      return updated
    })

    // إرسال إشعار تغيير الحالة
    const modForNotif = await db.mod.findUnique({
      where: { id },
      select: { name: true, slug: true },
    })
    if (modForNotif) {
      notifyWorkflowChange({
        modId: id,
        modName: modForNotif.name,
        modSlug: modForNotif.slug,
        fromStatus,
        toStatus: targetStatus,
        changedBy: user.id,
        changedByName: user.username,
        reason: reason || undefined,
      }).catch(console.error)
    }

    // ISR: revalidate public pages after workflow status change
    try {
      const modForRevalidate = await db.mod.findUnique({ where: { id }, select: { slug: true } })
      if (modForRevalidate) {
        revalidatePath('/')
        revalidatePath('/mod/' + modForRevalidate.slug)
      }
    } catch {}

    return ok(updatedMod)
  } catch (err) {
    console.error('[admin/mods/[id]/workflow POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to update workflow status')
  }
}

// GET /api/admin/mods/[id]/workflow — جلب سجل تغييرات الحالة
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    // التأكد إن التعريب موجود
    const mod = await db.mod.findUnique({ where: { id }, select: { id: true } })
    if (!mod) {
      return notFound()
    }

    // جلب السجل
    const history = await db.workflowEntry.findMany({
      where: { modId: id },
      orderBy: { changedAt: 'desc' },
      include: {
        changedByUser: {
          select: { id: true, username: true, avatarUrl: true, role: true },
        },
      },
    })

    return ok(history)
  } catch (err) {
    console.error('[admin/mods/[id]/workflow GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to fetch workflow history')
  }
}
