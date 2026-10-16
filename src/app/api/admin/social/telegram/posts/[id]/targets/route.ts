import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { conflict, fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { validateDestinationThread } from '@/lib/telegram-destinations'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const AddTargetSchema = z.object({
  destinationId: z.string().min(1),
  botId: z.string().min(1).nullable().optional(),
  threadId: z.number().int().min(1).nullable().optional(),
})

const targetInclude = {
  destination: {
    select: { id: true, chatId: true, title: true, chatType: true, status: true, archivedAt: true },
  },
  bot: { select: { id: true, label: true, status: true } },
} as const

/**
 * GET — أهداف المنشور مع حالتها. قراءة admin.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params

    const post = await db.socialPost.findUnique({ where: { id }, select: { id: true } })
    if (!post) return notFound('المنشور غير موجود')

    const targets = await db.socialPostTarget.findMany({
      where: { postId: id },
      include: targetInclude,
      orderBy: { createdAt: 'asc' },
    })

    return ok({ targets, total: targets.length })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — قراءة الأهداف للمشرفين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/posts/[id]/targets GET] failed:', err)
    return internalError('Failed to load post targets')
  }
}

/**
 * POST — إضافة هدف (وجهة + بوت اختياري + موضوع اختياري). manager.
 * مرفوض: وجهة مؤرشفة/غير موجودة، thread مخالف لقاعدة المنتدى، بوت
 * مجهول، أو تكرار (post,destination,thread) نفسه — القيد الفريد حارس
 * أخير (معالجة NULL: Postgres يميّز NULLs، لذا فحص مسبق صريح + P2002).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const post = await db.socialPost.findUnique({ where: { id }, select: { id: true } })
    if (!post) return notFound('المنشور غير موجود')

    const raw = await req.json().catch(() => ({}))
    const parsed = AddTargetSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات غير صالحة — راجع الحقول المدخلة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }
    const data = parsed.data

    const destination = await db.telegramDestination.findUnique({
      where: { id: data.destinationId },
      select: { id: true, chatId: true, chatType: true, archivedAt: true, lastHealthAt: true, lastHealthError: true },
    })
    if (!destination || destination.archivedAt) {
      const msg = !destination
        ? 'الوجهة غير موجودة'
        : 'الوجهة مؤرشفة — استعدها أولاً أو اختر وجهة نشطة'
      return fail('VALIDATION_ERROR', msg, 422, { destinationId: msg }, undefined, req.nextUrl.pathname)
    }

    const threadCheck = validateDestinationThread(destination.chatType, data.threadId, {
      canonicalId: destination.chatId,
      healthConfirmed:
        destination.lastHealthAt != null && destination.lastHealthError == null,
    })
    if (!threadCheck.ok) {
      return fail(
        'VALIDATION_ERROR',
        threadCheck.message,
        422,
        { threadId: threadCheck.message },
        undefined,
        req.nextUrl.pathname,
      )
    }

    if (data.botId) {
      const bot = await db.socialTelegramBot.findUnique({
        where: { id: data.botId },
        select: { id: true },
      })
      if (!bot) {
        const msg = 'البوت المحدد غير موجود — اختر بوتاً من القائمة أو اتركه فارغاً'
        return fail('VALIDATION_ERROR', msg, 422, { botId: msg }, undefined, req.nextUrl.pathname)
      }
    }

    // فحص تكرار صريح آمن لـ NULL (القيد الفريد لا يصطاد NULL=NULL).
    const existing = await db.socialPostTarget.findFirst({
      where: {
        postId: id,
        destinationId: data.destinationId,
        threadId: data.threadId ?? null,
      },
      select: { id: true },
    })
    if (existing) {
      return conflict('هذا الهدف مضاف أصلاً لهذا المنشور — لا تكرار')
    }

    const target = await db.socialPostTarget.create({
      data: {
        postId: id,
        destinationId: data.destinationId,
        botId: data.botId ?? null,
        threadId: data.threadId ?? null,
        status: 'pending',
      },
      include: targetInclude,
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SOCIAL_POST_TARGET_ADDED',
      entity: 'social_post',
      entityId: id,
      details: JSON.stringify({ targetId: target.id, destinationId: target.destinationId }),
      request: req,
    })

    return ok({ target })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الأهداف للمديرين فقط')
    if (auth) return auth
    if ((err as Error)?.message?.includes('Unique constraint')) {
      return conflict('هذا الهدف مضاف أصلاً لهذا المنشور — لا تكرار')
    }
    logger.error('[admin/social/telegram/posts/[id]/targets POST] failed:', err)
    return internalError('Failed to add post target')
  }
}
