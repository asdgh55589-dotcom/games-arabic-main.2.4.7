/**
 * notification-helpers.ts — دوال إنشاء الإشعارات
 */

import { db } from './db'
import { NotificationType } from '@/lib/notifications/types'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  actorId?: string
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
        data: params.link ? { link: params.link, ...params.data } as any : params.data as any,
        actorId: params.actorId,
      },
    })
  } catch (err) {
    console.error('[notification] failed to create:', err)
  }
}

/** إشعار رد على تعليق */
export async function notifyCommentReply(opts: {
  userId: string
  actorId: string
  modName: string
  link?: string
}): Promise<void> {
  if (opts.userId === opts.actorId) return

  await createNotification({
    userId: opts.userId,
    type: NotificationType.CommentReply,
    title: 'رد على تعليقك',
    message: `قام شخص بالرد على تعليقك في تعريب ${opts.modName}`,
    link: opts.link,
    actorId: opts.actorId,
  })
}

/** إشعار إعجابات على تعريب */
export async function notifyModEndorseMilestone(opts: {
  userId: string
  modName: string
  count: number
  link?: string
}): Promise<void> {
  return createNotification({
    userId: opts.userId,
    type: NotificationType.ModEndorseMilestone,
    title: 'إنجاز تصويت',
    message: `حصل تعريب ${opts.modName} على ${opts.count} تصويت`,
    link: opts.link,
  })
}

/** إشعار تعريب مميّز */
export async function notifyModFeatured(opts: {
  userId: string
  modName: string
  link?: string
}): Promise<void> {
  return createNotification({
    userId: opts.userId,
    type: NotificationType.ModFeatured,
    title: 'تعريب مميز',
    message: `تم اختيار تعريب ${opts.modName} كتعريب مميز`,
    link: opts.link,
  })
}

/** إشعار إجراء إداري */
export async function notifyAdminAction(opts: {
  userId: string
  title: string
  message: string
  link?: string
}): Promise<void> {
  return createNotification({
    userId: opts.userId,
    type: NotificationType.AdminAction,
    title: opts.title,
    message: opts.message,
    link: opts.link,
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
    userId: mod.authorId,
    modName: mod.name,
    count: opts.endorsements,
    link: `/?view=mod&slug=${mod.slug}`,
  })
}
