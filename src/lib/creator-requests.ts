import { db } from '@/lib/db'

interface CreatorRequestWithUser {
  id: string
  userId: string
  status: string
  // NOTE (Phase 4 Task 5): role assignment becomes track-based here.
  // Until then approvals grant the legacy 'creator' role.
  track?: string | null
}

/**
 * Shared approve/reject path for single ([id]) and bulk admin actions.
 * Approving grants the creator role + notifies the applicant.
 */
export async function approveCreatorRequest(
  request: CreatorRequestWithUser,
  adminId: string,
) {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: request.userId },
      data: { role: 'creator' },
    })
    await tx.creatorRequest.update({
      where: { id: request.id },
      data: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
    })
  })

  try {
    await db.notification.create({
      data: {
        userId: request.userId,
        actorId: adminId,
        type: 'admin_action',
        title: '🎉 مبروك! أنت الآن معرّب رسمي',
        message: 'تم قبول طلبك. يمكنك الآن رفع تعريباتك ومشاركتها مع المجتمع.',
        data: { requestId: request.id },
      },
    })
  } catch (e) {
    console.error('[creator-requests approve notify] failed:', e)
  }
}

export async function rejectCreatorRequest(
  request: CreatorRequestWithUser,
  adminId: string,
  reason: string,
) {
  await db.creatorRequest.update({
    where: { id: request.id },
    data: {
      status: 'rejected',
      rejectReason: reason,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
  })

  try {
    await db.notification.create({
      data: {
        userId: request.userId,
        actorId: adminId,
        type: 'admin_action',
        title: '❌ تم رفض طلب الترقية',
        message: `تم رفض طلبك. السبب: ${reason}`,
        data: { requestId: request.id, rejectReason: reason },
      },
    })
  } catch (e) {
    console.error('[creator-requests reject notify] failed:', e)
  }
}
