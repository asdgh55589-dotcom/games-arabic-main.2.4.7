import type { TeamMembership } from '@prisma/client'
import { ROLE_LABELS } from '@/lib/team-constants'

interface MembershipUser {
  id: string
  username: string
  displayName?: string | null
  avatar?: string | null
  avatarUrl?: string | null
}

interface MembershipWithUser extends TeamMembership {
  user?: MembershipUser | null
}

/**
 * هل العضو وهمي (غير مرتبط بحساب حقيقي)؟
 */
export function isPhantomMember(member: MembershipWithUser): boolean {
  return !member.userId
}

/**
 * هل العضو مرتبط بحساب حقيقي؟
 */
export function isLinkedMember(member: MembershipWithUser): boolean {
  return !!member.userId
}

/**
 * اسم العرض — الحساب الحقيقي له الأولوية عند الربط (displayName أولاً)
 */
export function getMemberDisplayName(member: MembershipWithUser): string {
  if (member.user) return (member.user.displayName as string) || member.user.username
  return member.name || 'عضو'
}

/**
 * صورة العضو — الحساب الحقيقي له الأولوية عند الربط
 */
export function getMemberAvatar(member: MembershipWithUser): string | null {
  if (member.user) {
    return member.user.avatar || member.user.avatarUrl || null
  }
  return member.avatarUrl || null
}

/**
 * رابط البروفايل (فقط للمرتبطين)
 */
export function getMemberProfileUrl(member: MembershipWithUser): string | null {
  if (member.user) return `/profile/${member.user.username}`
  return null
}

/**
 * النبذة — نبذة الوهمي محفوظة حتى بعد الربط
 */
export function getMemberBio(member: MembershipWithUser): string | null {
  return member.bio || null
}

/**
 * تسمية الدور بالعربية — مصدر واحد للحقيقة (team-constants.tsx).
 * تُعاد القيمة raw إن لم يوجد ترجمة معروفة.
 */
export function getMemberRoleLabel(role: string): string {
  return ROLE_LABELS[role]?.label || role
}
