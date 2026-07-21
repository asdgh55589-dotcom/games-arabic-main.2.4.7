export const REPORT_REASONS = {
  spam: { label: 'سبام وإعلانات', priority: 'medium', icon: 'Ban' },
  inappropriate: { label: 'محتوى مخالف للآداب', priority: 'high', icon: 'AlertTriangle' },
  copyright: { label: 'انتهاك حقوق الملكية', priority: 'high', icon: 'Copyright' },
  offensive: { label: 'إساءة شخصية', priority: 'high', icon: 'Frown' },
  false_info: { label: 'معلومات خاطئة', priority: 'medium', icon: 'Info' },
  technical: { label: 'محتوى تقني معطوب', priority: 'low', icon: 'Wrench' },
  other: { label: 'أخرى', priority: 'medium', icon: 'MoreHorizontal' },
} as const

export type ReportReason = keyof typeof REPORT_REASONS

export const REPORT_STATUSES = {
  new: { label: 'جديدة', color: 'bg-blue-500/10 text-blue-500' },
  under_review: { label: 'قيد المراجعة', color: 'bg-yellow-500/10 text-yellow-500' },
  confirmed: { label: 'مؤكد', color: 'bg-red-500/10 text-red-500' },
  rejected: { label: 'مرفوض', color: 'bg-gray-500/10 text-gray-500' },
  pending: { label: 'معلقة', color: 'bg-orange-500/10 text-orange-500' },
  resolved: { label: 'منجز', color: 'bg-green-500/10 text-green-500' },
  reopened: { label: 'معاد فتحها', color: 'bg-purple-500/10 text-purple-500' },
} as const

export type ReportStatus = keyof typeof REPORT_STATUSES

export const REPORT_PRIORITIES = {
  low: { label: 'منخفضة', color: 'bg-gray-500/10 text-gray-500' },
  medium: { label: 'متوسطة', color: 'bg-yellow-500/10 text-yellow-500' },
  high: { label: 'عالية', color: 'bg-orange-500/10 text-orange-500' },
  critical: { label: 'حرجة', color: 'bg-red-500/10 text-red-500' },
} as const

export type ReportPriority = keyof typeof REPORT_PRIORITIES

export const REPORT_TARGET_TYPES = {
  mod: { label: 'تعريب', icon: 'Package' },
  comment: { label: 'تعليق', icon: 'MessageSquare' },
  user: { label: 'مستخدم', icon: 'User' },
} as const

export type ReportTargetType = keyof typeof REPORT_TARGET_TYPES

export const REPORT_ACTIONS = {
  none: { label: 'بدون إجراء' },
  warned: { label: 'تحذير' },
  content_hidden: { label: 'إخفاء المحتوى' },
  content_deleted: { label: 'حذف المحتوى' },
  temp_ban: { label: 'تعليق مؤقت' },
  perm_ban: { label: 'حظر دائم' },
} as const

export type ReportAction = keyof typeof REPORT_ACTIONS

export const DAILY_REPORT_LIMIT = 5
