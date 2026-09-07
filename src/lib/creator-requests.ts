import { db } from '@/lib/db'
import { sendCreatorApprovalEmail } from '@/lib/notifications/email-service'

interface CreatorRequestWithUser {
  id: string
  userId: string
  status: string
  track?: string | null
}

export type CreatorTrack = 'publisher' | 'translator'

/** Track → role mapping: translator is a subset of creator. */
export function roleForTrack(track?: string | null): 'publisher' | 'creator' {
  return track === 'publisher' ? 'publisher' : 'creator'
}

export function trackLabel(track?: string | null): string {
  return track === 'publisher' ? 'ناشر' : 'معرّب'
}

/**
 * Shared approve/reject path for single ([id]) and bulk admin actions.
 * Approving grants the track role (publisher → publisher, else creator),
 * stores the optional applicant-visible approveNote, notifies in-app,
 * and emails track + next steps (fail-open when Resend is unconfigured).
 */
export async function approveCreatorRequest(
  request: CreatorRequestWithUser,
  adminId: string,
  opts?: { approveNote?: string },
) {
  const role = roleForTrack(request.track)
  const label = trackLabel(request.track)
  const note = opts?.approveNote?.trim() || null

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: request.userId },
      data: { role },
    })
    await tx.creatorRequest.update({
      where: { id: request.id },
      data: {
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        approveNote: note,
      },
    })
  })

  const message = note
    ? `تم قبول طلبك ك${label}. ملاحظة المراجعة: ${note}`
    : `تم قبول طلبك ك${label}. يمكنك الآن النشر من لوحة منشئ المحتوى.`
  try {
    await db.notification.create({
      data: {
        userId: request.userId,
        actorId: adminId,
        type: 'admin_action',
        title: `🎉 مبروك! أنت الآن ${label} رسمي`,
        message,
        data: { requestId: request.id, track: request.track || 'translator', approveNote: note },
      },
    })
  } catch (e) {
    console.error('[creator-requests approve notify] failed:', e)
  }

  try {
    const user = await db.user.findUnique({
      where: { id: request.userId },
      select: { email: true, username: true },
    })
    if (user?.email) {
      await sendCreatorApprovalEmail(user.email, {
        username: user.username,
        track: role === 'publisher' ? 'publisher' : 'translator',
        approveNote: note || undefined,
      })
    }
  } catch (e) {
    console.error('[creator-requests approve email] failed:', e)
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
