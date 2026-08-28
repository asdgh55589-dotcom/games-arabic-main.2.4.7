// Prisma enums are imported for type safety only — runtime values remain strings (matching DB enums)
// This ensures constants.ts stays in sync with schema.prisma enums
import type { ReportReason as PrismaReportReason, ReportStatus as PrismaReportStatus, ReportPriority as PrismaReportPriority, ReportType as PrismaReportType, ReportAction as PrismaReportAction } from '@prisma/client'

export const REPORT_REASONS: Record<string, { label: string; priority: string; icon: string }> = {
  spam: { label: 'سبام وإعلانات', priority: 'medium', icon: 'Ban' },
  inappropriate: { label: 'محتوى مخالف للآداب', priority: 'high', icon: 'AlertTriangle' },
  copyright: { label: 'انتهاك حقوق الملكية', priority: 'high', icon: 'Copyright' },
  offensive: { label: 'إساءة شخصية', priority: 'high', icon: 'Frown' },
  false_info: { label: 'معلومات خاطئة', priority: 'medium', icon: 'Info' },
  technical: { label: 'محتوى تقني معطوب', priority: 'low', icon: 'Wrench' },
  other: { label: 'أخرى', priority: 'medium', icon: 'MoreHorizontal' },
} as const

export type ReportReason = keyof typeof REPORT_REASONS // kept for backward compat; also satisfies PrismaReportReason

export const REPORT_STATUSES: Record<string, { label: string; color: string }> = {
  new: { label: 'جديدة', color: 'bg-blue-500/10 text-blue-500' },
  under_review: { label: 'قيد المراجعة', color: 'bg-yellow-500/10 text-yellow-500' },
  confirmed: { label: 'مؤكد', color: 'bg-red-500/10 text-red-500' },
  rejected: { label: 'مرفوض', color: 'bg-gray-500/10 text-gray-500' },
  pending: { label: 'معلقة', color: 'bg-orange-500/10 text-orange-500' },
  resolved: { label: 'منجز', color: 'bg-green-500/10 text-green-500' },
  reopened: { label: 'معاد فتحها', color: 'bg-purple-500/10 text-purple-500' },
} as const

export type ReportStatus = keyof typeof REPORT_STATUSES

export const REPORT_PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفضة', color: 'bg-gray-500/10 text-gray-500' },
  medium: { label: 'متوسطة', color: 'bg-yellow-500/10 text-yellow-500' },
  high: { label: 'عالية', color: 'bg-orange-500/10 text-orange-500' },
  critical: { label: 'حرجة', color: 'bg-red-500/10 text-red-500' },
} as const

export type ReportPriority = keyof typeof REPORT_PRIORITIES

export const REPORT_TARGET_TYPES: Record<string, { label: string; icon: string }> = {
  mod: { label: 'تعريب', icon: 'Package' },
  comment: { label: 'تعليق', icon: 'MessageSquare' },
  user: { label: 'مستخدم', icon: 'User' },
} as const
// Note: Prisma enum ReportType also has 'team' for future — not enabled in app yet (no FK)

export type ReportTargetType = keyof typeof REPORT_TARGET_TYPES

export const REPORT_ACTIONS: Record<string, { label: string }> = {
  none: { label: 'بدون إجراء' },
  warned: { label: 'تحذير' },
  content_hidden: { label: 'إخفاء المحتوى' },
  content_deleted: { label: 'حذف المحتوى' },
  temp_ban: { label: 'تعليق مؤقت' },
  perm_ban: { label: 'حظر دائم' },
} as const

export type ReportAction = keyof typeof REPORT_ACTIONS

// Re-export Prisma enums for callers that want strict typing
export type { PrismaReportReason, PrismaReportStatus, PrismaReportPriority, PrismaReportType, PrismaReportAction }

export const DAILY_REPORT_LIMIT = 5

// ===== Status Transition Rules (State Machine) =====
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['under_review', 'confirmed', 'rejected', 'resolved'],
  under_review: ['confirmed', 'rejected', 'reopened', 'resolved'],
  reopened: ['under_review', 'confirmed', 'rejected', 'resolved'],
  confirmed: ['resolved'],
  rejected: ['reopened'],
  // resolved is terminal — no transitions allowed
}

export function isValidTransition(fromStatus: string, toStatus: string): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[fromStatus]
  if (!allowed) return false
  return allowed.includes(toStatus)
}
