import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { destinationReadiness, TELEGRAM_DESTINATION_STATUSES } from '@/lib/telegram-destinations'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const PatchDestinationSchema = z.object({
  status: z.enum(TELEGRAM_DESTINATION_STATUSES).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
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

    // jobs.destinationId onDelete: SetNull — الحذف يفصل الوظائف القديمة بأمان.
    await db.telegramDestination.delete({ where: { id } })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'TELEGRAM_DESTINATION_DELETED',
      entity: 'telegram_destination',
      entityId: id,
      details: JSON.stringify({
        chatId: existing.chatId,
        status: existing.status,
        verificationStatus: existing.verificationStatus,
      }),
      request: req,
    })

    return ok({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations/[id] DELETE] failed:', err)
    return internalError('Failed to delete telegram destination')
  }
}
