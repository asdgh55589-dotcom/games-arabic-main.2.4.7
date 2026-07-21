import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { validateReport } from '@/lib/reports/validation'
import { analyzeReportFraud } from '@/lib/reports/fraud-detection'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
import { REPORT_REASONS } from '@/lib/reports/constants'
import { handleAdminNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 401 })
    }

    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'reports:create' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
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
      return NextResponse.json({ error: validationError.error }, { status: 400 })
    }

    const priority = REPORT_REASONS[reason as keyof typeof REPORT_REASONS]?.priority || 'medium'

    const report = await db.report.create({
      data: {
        reporterId: neonUser.id,
        targetType,
        targetModId: targetType === 'mod' ? targetId : null,
        targetCommentId: targetType === 'comment' ? targetId : null,
        targetUserId: targetType === 'user' ? targetId : null,
        reason,
        priority,
        description: description || null,
        evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls.join(',') : null,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      },
    })

    await handleAdminNotification('report', {
      reason: REPORT_REASONS[reason as keyof typeof REPORT_REASONS]?.label || reason,
    })

    // Phase 2: Analyze fraud signals (fire-and-forget, don't block response)
    analyzeReportFraud(report.id).catch(err => {
      console.error('[reports POST] fraud analysis failed:', err)
    })

    // Phase 2: Update reporter trust score
    recalculateTrustScore(neonUser.id).catch(err => {
      console.error('[reports POST] trust score update failed:', err)
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (err) {
    console.error('[reports POST] failed:', err)
    return NextResponse.json({ error: 'فشل إرسال البلاغ' }, { status: 500 })
  }
}
