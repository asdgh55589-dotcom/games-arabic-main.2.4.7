import type { TeamMembership } from '@prisma/client'

interface MembershipUser {
  id: string
  username: string
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
 * اسم العرض — الحساب الحقيقي له الأولوية عند الربط
 */
export function getMemberDisplayName(member: MembershipWithUser): string {
  if (member.user) return member.user.username
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
 * تسمية الدور بالعربية
 */
export function getMemberRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    leader: 'قائد',
    admin: 'مسؤول',
    member: 'عضو',
    translator: 'مترجم',
    tester: 'مختبر',
    guest: 'ضيف',
    viewer: 'مشاهد',
  }
  return roleLabels[role] || role
}
