import type { NextRequest } from 'next/server'
import { getUseCases } from '@/application/use-cases/factory'
import { internalError, ok, rateLimited, unauthorized, validationFail } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { REPORT_REASONS } from '@/lib/reports/constants'
import { analyzeReportFraud } from '@/lib/reports/fraud-detection'
import { checkFraudSpike } from '@/lib/reports/fraud-spike'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
import { validateEvidenceUrls, validateReport } from '@/lib/reports/validation'

export async function POST(req: NextRequest) {
  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized('يجب تسجيل الدخول')
    }

    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'reports:create' })
    if (!rl.success) {
      return rateLimited()
    }

    const body = await req.json()
    const { targetType, targetId, reason, description, evidenceUrls } = body

    const validationError = await validateReport({
      reporterId: neonUser.id,
      targetType,
      targetId,
      reason,
    })
    if (validationError) {
      return validationFail(validationError.error)
    }

    // تحقق XSS لروابط الأدلة — يُسمح فقط بـ http/https
    const evUrlsArray = Array.isArray(evidenceUrls)
      ? evidenceUrls
      : evidenceUrls
        ? [evidenceUrls]
        : []
    const evValidation = validateEvidenceUrls(evUrlsArray)
    if (!evValidation.valid) {
      return validationFail(evValidation.error || 'روابط الأدلة غير صالحة')
    }

    const priority = REPORT_REASONS[reason as keyof typeof REPORT_REASONS]?.priority || 'medium'

    const report = await db.report.create({
      data: {
        reporterId: neonUser.id,
        targetType: targetType as any,
        targetModId: targetType === 'mod' ? targetId : null,
        targetCommentId: targetType === 'comment' ? targetId : null,
        targetUserId: targetType === 'user' ? targetId : null,
        reason: reason as any,
        priority: priority as any,
        description: description || null,
        evidenceUrls: (evValidation.urls.length > 0 ? evValidation.urls : null) as any,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      },
    })

    // إشعار المشرفين بالبلاغ الجديد
    try {
      const admins = await db.user.findMany({
        where: { role: { in: ['admin', 'manager', 'owner'] } },
        select: { id: true },
      })
      const useCases = getUseCases()
      await useCases.sendReportSubmitted.execute({
        adminUserIds: admins.map((a) => a.id),
        reporterId: neonUser.id,
        reportId: report.id,
        targetType,
        targetTitle: targetId,
        reason: REPORT_REASONS[reason as keyof typeof REPORT_REASONS]?.label || reason,
      })
    } catch {}

    // Phase 2: Analyze fraud signals (fire-and-forget, don't block response)
    analyzeReportFraud(report.id).catch((err) => {
      console.error('[reports POST] fraud analysis failed:', err)
    })

    // Phase 2: Update reporter trust score
    recalculateTrustScore(neonUser.id).catch((err) => {
      console.error('[reports POST] trust score update failed:', err)
    })

    return ok({ report }, { status: 201 })
  } catch (err) {
    console.error('[reports POST] failed:', err)
    return internalError('فشل إرسال البلاغ')
  }
}
