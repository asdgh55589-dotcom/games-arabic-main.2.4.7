import type { ReportModReason, ReportReason, ReportTargetType } from './constants'

export type ReportPayloadReason = ReportReason | ReportModReason

export interface BuildReportPayloadInput {
  targetType: ReportTargetType
  targetId: string
  reason: ReportPayloadReason
  description?: string
}

interface ReportPayloadBase {
  reason: ReportPayloadReason
  details?: string
}

export type ReportPayload =
  | (ReportPayloadBase & { targetType: 'mod'; targetModId: string })
  | (ReportPayloadBase & { targetType: 'comment'; targetCommentId: string })
  | (ReportPayloadBase & { targetType: 'user'; targetUserId: string })

/**
 * Maps the dialog's generic {targetType, targetId, description} shape onto the
 * typed fields accepted by CreateReportSchema. Unknown keys are stripped by
 * Zod, so sending targetId/description directly loses the report target.
 */
export function buildReportPayload({
  targetType,
  targetId,
  reason,
  description,
}: BuildReportPayloadInput): ReportPayload {
  const details = description || undefined

  switch (targetType) {
    case 'mod':
      return { targetType, targetModId: targetId, reason, details }
    case 'comment':
      return { targetType, targetCommentId: targetId, reason, details }
    case 'user':
      return { targetType, targetUserId: targetId, reason, details }
    default:
      throw new Error(`Unsupported report target type: ${targetType}`)
  }
}
