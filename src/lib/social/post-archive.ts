/**
 * lib/social/post-archive.ts — أرشفة/استعادة المنشورات (Phase 5).
 *
 * قواعد الأرشفة (الفئة 4-5/6 من الخطة):
 * - الأرشفة ليست حالة بل `archivedAt` (حالتها العرضية): تُخفي من كل القوائم
 *   عدا صفحة الأرشيف، والاستعادة تعيد لآخر حالة قبل الأرشفة لأن `status`
 *   لا يتغير في أي من الاتجاهين.
 * - منشور `publishing` (قيد النشر) لا يُؤرشف — تعارض 409.
 * - المكرون يستثني المؤرشف (راجع social-publish: archivedAt null).
 */

import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { type SocialPostDto, serializePost } from '@/lib/social/serialize'

export type PostArchiveAction = 'archive' | 'restore'

export interface PostArchiveActor {
  id?: string
  username?: string
}

export interface PostArchiveResult {
  ok: boolean
  code?: string
  status?: number
  message: string
  post?: SocialPostDto
}

export async function setPostArchived(
  id: string,
  action: PostArchiveAction,
  actor: PostArchiveActor = {},
): Promise<PostArchiveResult> {
  const post = await db.socialPost.findUnique({ where: { id } })
  if (!post) {
    return { ok: false, code: 'NOT_FOUND', status: 404, message: 'المنشور غير موجود' }
  }

  if (action === 'archive') {
    if (post.archivedAt) {
      return { ok: false, code: 'CONFLICT', status: 409, message: 'المنشور مؤرشف بالفعل' }
    }
    if (post.status === 'publishing') {
      return {
        ok: false,
        code: 'CONFLICT',
        status: 409,
        message: 'لا يمكن أرشفة منشور قيد النشر — انتظر اكتمال العملية',
      }
    }
    const updated = await db.socialPost.update({ where: { id }, data: { archivedAt: new Date() } })
    if (actor.id) {
      await logAction({
        userId: actor.id,
        username: actor.username,
        action: 'archive_post',
        entity: 'social_post',
        entityId: id,
        details: `أرشفة المنشور (الحالة قبل الأرشفة: ${post.status})`,
      })
    }
    return {
      ok: true,
      message: 'تمت الأرشفة',
      post: serializePost(updated as unknown as Record<string, unknown>),
    }
  }

  // restore — يَعِد لآخر حالة قبل الأرشفة تلقائياً (status محفوظ).
  if (!post.archivedAt) {
    return { ok: false, code: 'CONFLICT', status: 409, message: 'المنشور غير مؤرشف' }
  }
  const updated = await db.socialPost.update({ where: { id }, data: { archivedAt: null } })
  if (actor.id) {
    await logAction({
      userId: actor.id,
      username: actor.username,
      action: 'restore_post',
      entity: 'social_post',
      entityId: id,
      details: `استعادة من الأرشيف (الحالة الحالية: ${post.status})`,
    })
  }
  return {
    ok: true,
    message: 'تمت الاستعادة',
    post: serializePost(updated as unknown as Record<string, unknown>),
  }
}
