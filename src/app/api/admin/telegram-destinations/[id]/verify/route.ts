import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  DESTINATION_TOKEN_DEFAULT_MAX_AGE_MS,
  destinationReadiness,
  signDestinationVerificationToken,
  verifyDestinationVerificationToken,
} from '@/lib/telegram-destinations'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const VerifyBodySchema = z.object({
  /** issue: إصدار رمز يُوضع في وصف الوجهة — check: تقديم الرمز — manual: توثيق يدوي. */
  action: z.enum(['issue', 'check', 'manual']),
  token: z.string().optional(),
})

const VERIFY_FAILURE_AR: Record<string, string> = {
  malformed: 'الرمز غير صالح أو تالف',
  mismatch: 'الرمز لا يطابق هذه الوجهة',
  expired: 'انتهت صلاحية الرمز — أصدر رمزاً جديداً',
}

/**
 * توثيق الوجهة (إجراء verification):
 *  - issue: يوقّع رمزاً (HMAC عبر TELEGRAM_BOT_TOKEN) ويرده للمدير ليضعه في
 *    وصف الوجهة — الرمز لا يُسلَّم إلا لمنفّذ manager المصرّح.
 *  - check: يتحقق من الرمز المقدَّم (مقارنة آمنة زمنياً + صلاحية) → verified
 *    مع تفعيل تلقائي لو كانت pending.
 *  - manual: توثيق يدوي من المدير (verificationMethod=manual) بلا رمز.
 * الفشل يُسجَّل failed + السبب ويُرجع 422 برسالة عربية.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const existing = await db.telegramDestination.findUnique({ where: { id } })
    if (!existing) return notFound('الوجهة غير موجودة')

    const raw = await req.json().catch(() => ({}))
    const parsed = VerifyBodySchema.safeParse(raw)
    if (!parsed.success) {
      const msg = 'حدّد إجراء التحقق (issue | check | manual)'
      return fail('VALIDATION_ERROR', msg, 422, { action: msg }, undefined, req.nextUrl.pathname)
    }

    const secret = process.env.TELEGRAM_BOT_TOKEN
    if (parsed.data.action !== 'manual' && !secret) {
      return internalError('TELEGRAM_BOT_TOKEN غير مضبوط — تحقق الرموز غير متاح')
    }

    if (parsed.data.action === 'issue') {
      const token = signDestinationVerificationToken({
        chatId: existing.chatId,
        secret: secret as string,
      })
      const destination = await db.telegramDestination.update({
        where: { id },
        data: { verificationMethod: 'token', lastVerificationError: null },
      })
      await logAction({
        userId: manager.id,
        username: manager.username,
        action: 'TELEGRAM_DESTINATION_TOKEN_ISSUED',
        entity: 'telegram_destination',
        entityId: id,
        details: JSON.stringify({ chatId: existing.chatId }),
        request: req,
      })
      return ok({
        token,
        chatId: destination.chatId,
        verificationMethod: 'token',
        maxAgeMs: DESTINATION_TOKEN_DEFAULT_MAX_AGE_MS,
        hint: 'ضع الرمز في وصف الوجهة ثم قدّمه عبر action=check',
      })
    }

    if (parsed.data.action === 'check') {
      if (!parsed.data.token) {
        const msg = 'قدّم الرمز (token) مع action=check'
        return fail('VALIDATION_ERROR', msg, 422, { token: msg }, undefined, req.nextUrl.pathname)
      }

      const result = verifyDestinationVerificationToken(parsed.data.token, {
        chatId: existing.chatId,
        secret: secret as string,
      })

      if (!result.ok) {
        const reasonAr = VERIFY_FAILURE_AR[result.reason] ?? 'فشل التحقق'
        await db.telegramDestination.update({
          where: { id },
          data: {
            verificationStatus: 'failed',
            verificationMethod: 'token',
            verificationCheckedAt: new Date(),
            lastVerificationError: reasonAr,
          },
        })
        await logAction({
          userId: manager.id,
          username: manager.username,
          action: 'TELEGRAM_DESTINATION_VERIFY_FAILED',
          entity: 'telegram_destination',
          entityId: id,
          details: JSON.stringify({ reason: result.reason }),
          request: req,
        })
        return fail(
          'VALIDATION_ERROR',
          reasonAr,
          422,
          { token: reasonAr, reason: result.reason },
          undefined,
          req.nextUrl.pathname,
        )
      }

      const now = new Date()
      const destination = await db.telegramDestination.update({
        where: { id },
        data: {
          verificationStatus: 'verified',
          verificationMethod: 'token',
          verificationCheckedAt: now,
          verifiedAt: now,
          lastVerificationError: null,
          // إثبات السيطرة يفعّل الوجهة المعلّقة تلقائياً (المعطّلة تبقى معطّلة).
          status: existing.status === 'pending' ? 'active' : existing.status,
        },
      })

      await logAction({
        userId: manager.id,
        username: manager.username,
        action: 'TELEGRAM_DESTINATION_VERIFIED',
        entity: 'telegram_destination',
        entityId: id,
        details: JSON.stringify({ method: 'token', status: destination.status }),
        request: req,
      })

      return ok({
        verified: true,
        destination: {
          ...destination,
          verificationToken: undefined,
          hasVerificationToken: true,
          readiness: destinationReadiness(destination),
        },
      })
    }

    // manual — توثيق يدوي موثّق باسم المدير المنفّذ.
    const now = new Date()
    const destination = await db.telegramDestination.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        verificationMethod: 'manual',
        verificationCheckedAt: now,
        verifiedAt: now,
        lastVerificationError: null,
        status: existing.status === 'pending' ? 'active' : existing.status,
      },
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'TELEGRAM_DESTINATION_VERIFIED',
      entity: 'telegram_destination',
      entityId: id,
      details: JSON.stringify({ method: 'manual', status: destination.status }),
      request: req,
    })

    return ok({
      verified: true,
      destination: {
        ...destination,
        verificationToken: undefined,
        hasVerificationToken: true,
        readiness: destinationReadiness(destination),
      },
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations/[id]/verify POST] failed:', err)
    return internalError('Failed to verify telegram destination')
  }
}
