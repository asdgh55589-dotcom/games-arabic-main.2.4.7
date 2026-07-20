/**
 * notification-helpers.ts — دوال إنشاء الإشعارات
 */

import { db } from './db'

interface CreateNotificationParams {
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
}

/** إنشاء إشعار جديد */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        ...(params.data !== undefined && { data: params.data as never }),
      },
    })
  } catch (err) {
    console.error('[notification] failed to create:', err)
  }
}

/** إشعار رد على تعليق */
export async function notifyCommentReply(opts: {
  parentAuthorId: string
  replyAuthorId: string
  modSlug: string
  modName: string
}): Promise<void> {
  if (opts.parentAuthorId === opts.replyAuthorId) return

  const replyUser = await db.user.findUnique({
    where: { id: opts.replyAuthorId },
    select: { username: true },
  })

  await createNotification({
    userId: opts.parentAuthorId,
    type: 'comment_reply',
    title: `ردّ ${replyUser?.username || 'مستخدم'} على تعليقك في ${opts.modName}`,
    message: '',
    data: {
      actorId: opts.replyAuthorId,
      entityType: 'mod',
      entityId: opts.modSlug,
      link: `/?view=mod&slug=${opts.modSlug}`,
    },
  })
}

/** إشعار إعجابات على تعريب */
export async function notifyModEndorseMilestone(opts: {
  authorId: string
  actorId: string
  modSlug: string
  modName: string
  endorsements: number
}): Promise<void> {
  if (opts.authorId === opts.actorId) return

  const actorUser = await db.user.findUnique({
    where: { id: opts.actorId },
    select: { username: true },
  })

  await createNotification({
    userId: opts.authorId,
    type: 'mod_endorse',
    title: `تعريبك "${opts.modName}" حصل على ${opts.endorsements} إعجاب!`,
    message: `${actorUser?.username || 'مستخدم'} أضاف إعجابه على تعريبك`,
    data: {
      actorId: opts.actorId,
      entityType: 'mod',
      entityId: opts.modSlug,
      link: `/?view=mod&slug=${opts.modSlug}`,
    },
  })
}

/** إشعار تعريب مميّز */
export async function notifyModFeatured(opts: {
  authorId: string
  modSlug: string
  modName: string
}): Promise<void> {
  await createNotification({
    userId: opts.authorId,
    type: 'mod_featured',
    title: `تمت إضافة تعريبك "${opts.modName}" إلى التعريبات المميزة!`,
    message: '',
    data: {
      entityType: 'mod',
      entityId: opts.modSlug,
      link: `/?view=mod&slug=${opts.modSlug}`,
    },
  })
}

/** إشعار إجراء إداري */
export async function notifyAdminAction(opts: {
  userId: string
  actorId?: string
  action: string
  details?: string
}): Promise<void> {
  await createNotification({
    userId: opts.userId,
    type: 'admin_action',
    title: opts.action,
    message: opts.details || '',
    data: opts.actorId ? { actorId: opts.actorId, entityType: 'user', entityId: opts.userId } : undefined,
  })
}

/** Milestones للإعجابات */
const ENDORSE_MILESTONES = [10, 50, 100, 500, 1000]

/** فحص الوصول لـ milestone وإنشاء إشعار */
export async function checkEndorseMilestone(opts: {
  modId: string
  endorsements: number
  actorId: string
}): Promise<void> {
  if (!ENDORSE_MILESTONES.includes(opts.endorsements)) return

  const mod = await db.mod.findUnique({
    where: { id: opts.modId },
    select: { slug: true, name: true, authorId: true },
  })
  if (!mod) return

  await notifyModEndorseMilestone({
    authorId: mod.authorId,
    actorId: opts.actorId,
    modSlug: mod.slug,
    modName: mod.name,
    endorsements: opts.endorsements,
  })
}
