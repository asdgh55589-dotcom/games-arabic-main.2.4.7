import { REPORT_REASONS, REPORT_TARGET_TYPES, DAILY_REPORT_LIMIT } from './constants'
import { db } from '@/lib/db'
import type { ReportReason, ReportTargetType } from './constants'

interface ValidateReportInput {
  reporterId: string
  targetType: string
  targetId: string
  reason: string
}

interface ValidationError {
  error: string
}

export async function validateReport(input: ValidateReportInput): Promise<ValidationError | null> {
  const { reporterId, targetType, targetId, reason } = input

  if (!targetType || !targetId || !reason) {
    return { error: 'جميع الحقول المطلوبة غير مكتملة' }
  }

  if (!(targetType in REPORT_TARGET_TYPES)) {
    return { error: 'نوع المستهدف غير صالح' }
  }

  if (!(reason in REPORT_REASONS)) {
    return { error: 'سبب البلاغ غير صالح' }
  }

  if (targetType === 'mod') {
    const mod = await db.mod.findUnique({ where: { id: targetId }, select: { id: true, authorId: true } })
    if (!mod) return { error: 'التعريب غير موجود' }
    if (mod.authorId === reporterId) return { error: 'لا يمكنك الإبلاغ عن تعريبك الخاص' }
  }

  if (targetType === 'comment') {
    const comment = await db.modComment.findUnique({ where: { id: targetId }, select: { id: true, userId: true } })
    if (!comment) return { error: 'التعليق غير موجود' }
    if (comment.userId === reporterId) return { error: 'لا يمكنك الإبلاغ عن تعليقك الخاص' }
  }

  if (targetType === 'user') {
    if (targetId === reporterId) return { error: 'لا يمكنك الإبلاغ عن نفسك' }
    const user = await db.user.findUnique({ where: { id: targetId }, select: { id: true } })
    if (!user) return { error: 'المستخدم غير موجود' }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await db.report.count({
    where: { reporterId, createdAt: { gte: todayStart } },
  })
  if (todayCount >= DAILY_REPORT_LIMIT) {
    return { error: `لقد تجاوزت الحد الأقصى للبلاغات اليوم (${DAILY_REPORT_LIMIT})` }
  }

  const whereClause: Record<string, unknown> = { reporterId }
  if (targetType === 'mod') whereClause.targetModId = targetId
  else if (targetType === 'comment') whereClause.targetCommentId = targetId
  else if (targetType === 'user') whereClause.targetUserId = targetId

  const existing = await db.report.findFirst({ where: whereClause })
  if (existing) {
    return { error: 'لقد أبلّغت عن هذا المحتوى مسبقاً' }
  }

  return null
}
