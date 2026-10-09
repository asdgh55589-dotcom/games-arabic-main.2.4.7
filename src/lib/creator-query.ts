/**
 * src/lib/creator-query.ts —whitelists مركزية لباراميترات قوائم المبدعين (GAM-6/E E4)
 *
 * كل قيم `status`/`filter` الحرة القادمة من الـ query string يجب أن تمر عبر
 * هذه الـ Zod enums قبل الوصول إلى Prisma — أي قيمة غير معروفة تُرفض بـ
 * `validationFail` ولا تتدفق إلى `where` أبدًا.
 */
import { z } from 'zod'

/** GET /api/creator/requests?status= */
export const RequestStatusFilterSchema = z.enum([
  'all',
  'mine',
  'open',
  'accepted',
  'completed',
  'cancelled',
])
export type RequestStatusFilter = z.infer<typeof RequestStatusFilterSchema>

/** GET /api/creator/comments?filter= */
export const CommentFilterSchema = z.enum(['all', 'visible', 'hidden'])
export type CommentFilter = z.infer<typeof CommentFilterSchema>

/** GET /api/creator/reports?status= */
export const ReportStatusFilterSchema = z.enum([
  'all',
  'new',
  'under_review',
  'confirmed',
  'rejected',
  'pending',
  'resolved',
  'reopened',
])
export type ReportStatusFilter = z.infer<typeof ReportStatusFilterSchema>

/** GET /api/creator/mods?status= — يطابق WORKFLOW_STATUSES + 'all' */
export const ModStatusFilterSchema = z.enum([
  'all',
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'REJECTED',
])
export type ModStatusFilter = z.infer<typeof ModStatusFilterSchema>

/** GET /api/creator/team/invites?status= — يطابق TeamInvitation.status + 'all' */
export const InviteStatusFilterSchema = z.enum([
  'all',
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
])
export type InviteStatusFilter = z.infer<typeof InviteStatusFilterSchema>

/**
 * يقرأ باراميترًا من searchParams ويتحقق منه عبر Zod enum.
 * يعيد `{ ok: true, value }` أو `{ ok: false }` — والـ route يرد بـ
 * `validationFail` عند الفشل. القيمة الافتراضية تُطبق عند غياب الباراميتر.
 */
export function parseFilterParam<T extends string>(
  searchParams: URLSearchParams,
  key: string,
  // Zod 4 types a ZodEnum by its values record (`ZodEnum<{a: "a", ...}>`), not
  // by the old `ZodEnum<[T, ...T[]]>` tuple. The only contract this helper
  // needs is "a schema that turns an unknown input into a T", so type it as
  // `ZodType<T>` — which every ZodEnum satisfies and which keeps the parsed
  // `.data` narrowed to T.
  schema: z.ZodType<T>,
  fallback: T,
): { ok: true; value: T } | { ok: false } {
  const raw = searchParams.get(key)?.trim()
  if (!raw) return { ok: true, value: fallback }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false }
  return { ok: true, value: parsed.data }
}
