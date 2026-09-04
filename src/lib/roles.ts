/**
 * src/lib/roles.ts — التعريف المركزي الموحد للأدوار
 *
 * المصدر الرسمي الوحيد لترتيب الأدوار وأسمائها ووصفها.
 * أي كود يعرض أو يتحقق من دور يجب أن يستورد من هنا بدل التكرار.
 */

export const ROLE_ORDER = [
  'member',
  'creator',
  'publisher',
  'moderator',
  'admin',
  'manager',
  'owner',
] as const

export type UserRole = (typeof ROLE_ORDER)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  member: 'عضو',
  creator: 'مُعَرِّب',
  publisher: 'ناشر',
  moderator: 'مشرف',
  admin: 'مسؤول',
  manager: 'مدير',
  owner: 'مالك الموقع',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  member: 'عضو عادي يمكنه التصفح والتحميل والتعليق والتقييم.',
  creator: 'مُعَرِّب ينشئ تعريباته الخاصة ويدير أعماله.',
  publisher: 'ناشر ينشر تعريبات من مصادر خارجية مع ذكر المصدر الأصلي.',
  moderator: 'مشرف يراجع المحتوى ويدير البلاغات والتعليقات.',
  admin: 'مسؤول يدير المستخدمين والمحتوى والإعدادات العامة.',
  manager: 'مدير بصلاحيات إدارية متقدمة لإدارة المنصة.',
  owner: 'مالك الموقع وله أعلى صلاحيات كاملة.',
}

export const ROLE_BADGE_VARIANTS: Record<UserRole, string> = {
  member: 'secondary',
  creator: 'default',
  publisher: 'outline',
  moderator: 'warning',
  admin: 'destructive',
  manager: 'destructive',
  owner: 'destructive',
}

export function getRoleLabel(role?: string | null): string {
  if (!role) return 'عضو'
  return ROLE_LABELS[role as UserRole] || role
}

export function getRoleDescription(role?: string | null): string {
  if (!role) return ROLE_DESCRIPTIONS.member
  return ROLE_DESCRIPTIONS[role as UserRole] || 'دور غير معروف'
}

export function hasRoleAtLeast(role: string, minimum: UserRole): boolean {
  const roleIndex = ROLE_ORDER.indexOf(role as UserRole)
  const minIndex = ROLE_ORDER.indexOf(minimum)
  if (roleIndex === -1 || minIndex === -1) return false
  return roleIndex >= minIndex
}
