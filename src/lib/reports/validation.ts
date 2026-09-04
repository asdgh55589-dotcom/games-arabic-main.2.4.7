import { db } from '@/lib/db'
import type { ReportReason, ReportTargetType } from './constants'
import { DAILY_REPORT_LIMIT, REPORT_REASONS, REPORT_TARGET_TYPES } from './constants'

const ALLOWED_URL_PROTOCOLS = ['http:', 'https:']

/**
 * تحقق من روابط الأدلة — يسمح فقط بـ http/https ويمنع XSS مثل javascript: و data:
 */
export function validateEvidenceUrls(urls: string[] | null | undefined): {
  valid: boolean
  urls: string[]
  error?: string
} {
  if (!urls || urls.length === 0) {
    return { valid: true, urls: [] }
  }

  const validated: string[] = []

  for (const raw of urls) {
    if (!raw || typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    try {
      const parsed = new URL(trimmed)
      if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) {
        return {
          valid: false,
          urls: [],
          error: `رابط غير صالح: ${trimmed} — يُسمح فقط بـ http/https`,
        }
      }
      validated.push(parsed.href) // normalized
    } catch {
      return {
        valid: false,
        urls: [],
        error: `رابط غير صالح: ${trimmed}`,
      }
    }
  }

  return { valid: true, urls: validated }
}

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
    const mod = await db.mod.findUnique({
      where: { id: targetId },
      select: { id: true, authorId: true },
    })
    if (!mod) return { error: 'التعريب غير موجود' }
    if (mod.authorId === reporterId) return { error: 'لا يمكنك الإبلاغ عن تعريبك الخاص' }
  }

  if (targetType === 'comment') {
    const comment = await db.modComment.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true },
    })
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

  // فحص تقييد المُبلّغ الكيدي (المستوى 2: بلاغ واحد/يوم)
  const restriction = await db.userAction.findFirst({
    where: {
      userId: reporterId,
      action: 'restrict',
      metadata: { contains: 'reporter_strike_l2' },
    },
  })

  if (restriction) {
    const restrictedDailyCount = await db.report.count({
      where: {
        reporterId,
        createdAt: { gte: todayStart },
      },
    })
    if (restrictedDailyCount >= 1) {
      return { error: 'تم تقييدك لبلاغ واحد يومياً بسبب بلاغات كيدية' }
    }
  }

  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const duplicateWhere: Record<string, unknown> = {
    reporterId,
    createdAt: { gte: THIRTY_DAYS_AGO },
  }
  if (targetType === 'mod') duplicateWhere.targetModId = targetId
  else if (targetType === 'comment') duplicateWhere.targetCommentId = targetId
  else if (targetType === 'user') duplicateWhere.targetUserId = targetId

  const duplicate = await db.report.findFirst({ where: duplicateWhere })
  if (duplicate) {
    return { error: 'لقد أبلّغت عن هذا المحتوى خلال آخر 30 يوماً' }
  }

  return null
}
