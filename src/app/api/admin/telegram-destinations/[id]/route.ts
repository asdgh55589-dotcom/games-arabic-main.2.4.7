import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  destinationReadiness,
  TELEGRAM_DESTINATION_STATUSES,
  validateDestinationThread,
} from '@/lib/telegram-destinations'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const PatchDestinationSchema = z.object({
  status: z.enum(TELEGRAM_DESTINATION_STATUSES).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
  botId: z.string().min(1).nullable().optional(),
  messageThreadId: z.number().int().nullable().optional(),
})

function stripDestination<T extends { verificationToken?: string | null }>(
  destination: T,
): Omit<T, 'verificationToken'> & { hasVerificationToken: boolean } {
  const { verificationToken, ...rest } = destination
  return { ...rest, hasVerificationToken: Boolean(verificationToken) }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const destination = await db.telegramDestination.findUnique({ where: { id } })
    if (!destination) return notFound('الوجهة غير موجودة')

    return ok({
      ...stripDestination(destination),
      readiness: destinationReadiness(destination),
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations/[id] GET] failed:', err)
    return internalError('Failed to load telegram destination')
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const existing = await db.telegramDestination.findUnique({ where: { id } })
    if (!existing) return notFound('الوجهة غير موجودة')

    const raw = await req.json().catch(() => ({}))
    const parsed = PatchDestinationSchema.safeParse(raw)
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
    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.title !== undefined) updateData.title = data.title
    if (data.notes !== undefined) updateData.notes = data.notes

    // البوت المُسنَد: null تُخلي الإسناد (رجوع للافتراضي العام).
    if (data.botId !== undefined) {
      if (data.botId !== null) {
        const bot = await db.socialTelegramBot.findUnique({
          where: { id: data.botId },
          select: { id: true },
        })
        if (!bot) {
          const msg = 'البوت المحدد غير موجود — اختر بوتاً من القائمة أو أخلِ الحقل للافتراضي'
          return fail('VALIDATION_ERROR', msg, 422, { botId: msg }, undefined, req.nextUrl.pathname)
        }
      }
      updateData.botId = data.botId
    }

    // الموضوع: صالح فقط لمجموعات المنتدى المؤكدة. نوع مُخمَّن من معرّف
    // -100 بلا فحص صحة ناجح ما يزال غامضاً (قد يكون قناة).
    if (data.messageThreadId !== undefined) {
      const threadCheck = validateDestinationThread(existing.chatType, data.messageThreadId, {
        canonicalId: existing.chatId,
        healthConfirmed: existing.lastHealthAt != null && existing.lastHealthError == null,
      })
      if (!threadCheck.ok) {
        return fail(
          'VALIDATION_ERROR',
          threadCheck.message,
          422,
          { messageThreadId: threadCheck.message },
          undefined,
          req.nextUrl.pathname,
        )
      }
      updateData.messageThreadId = data.messageThreadId
    }

    // اصطلاح "الوجهة الافتراضية" واحدة فقط: أي ترقيتها تُسقط الافتراضية عن غيرها.
    if (data.isDefault === true) {
      await db.telegramDestination.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
      updateData.isDefault = true
    } else if (data.isDefault === false) {
      updateData.isDefault = false
    }

    const destination = await db.telegramDestination.update({
      where: { id },
      data: updateData,
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'TELEGRAM_DESTINATION_UPDATED',
      entity: 'telegram_destination',
      entityId: id,
      details: JSON.stringify({
        before: { status: existing.status, isDefault: existing.isDefault },
        after: { status: destination.status, isDefault: destination.isDefault },
      }),
      request: req,
    })

    return ok({
      ...stripDestination(destination),
      readiness: destinationReadiness(destination),
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations/[id] PATCH] failed:', err)
    return internalError('Failed to update telegram destination')
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const existing = await db.telegramDestination.findUnique({ where: { id } })
    if (!existing) return notFound('الوجهة غير موجودة')

    // أرشفة ناعمة: لا حذف فيزيائي أبداً — الصف يبقى للتاريخ.
    if (existing.archivedAt) {
      return ok({ success: true, archived: true, alreadyArchived: true, relinked: 0, frozen: 0 })
    }

    // إعادة ربط المنشورات المجدولة: إلى الافتراضية البديلة إن وُجدت،
    // وإلا تُجمَّد (تبقى مرتبطة بوجهة معطلة فتفشل مغلقة) مع تحذير صريح.
    const fallback = await db.telegramDestination.findFirst({
      where: { isDefault: true, archivedAt: null, id: { not: id } },
      select: { id: true },
    })
    const scheduledPosts = await db.socialPost.findMany({
      where: { destinationId: id, status: 'scheduled' },
      select: { id: true },
    })

    let relinked = 0
    if (fallback && scheduledPosts.length > 0) {
      const res = await db.socialPost.updateMany({
        where: { destinationId: id, status: 'scheduled' },
        data: { destinationId: fallback.id },
      })
      relinked = res.count
    }
    const frozen = scheduledPosts.length - relinked

    await db.telegramDestination.update({
      where: { id },
      data: { archivedAt: new Date(), status: 'disabled', isDefault: false },
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'TELEGRAM_DESTINATION_ARCHIVED',
      entity: 'telegram_destination',
      entityId: id,
      details: JSON.stringify({
        chatId: existing.chatId,
        status: existing.status,
        verificationStatus: existing.verificationStatus,
        fallbackId: fallback?.id ?? null,
        relinked,
        frozen,
      }),
      request: req,
    })

    return ok({
      success: true,
      archived: true,
      relinked,
      frozen,
      fallbackId: fallback?.id ?? null,
      warning:
        frozen > 0
          ? `لا توجد وجهة افتراضية بديلة — ${frozen} منشوراً مجدولاً بقي مرتبطاً بوجهة مؤرشفة معطلة ولن يُرسل حتى يُعاد ربطه يدوياً`
          : null,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations/[id] DELETE] failed:', err)
    return internalError('Failed to archive telegram destination')
  }
}
