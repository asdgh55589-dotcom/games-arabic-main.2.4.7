/**
 * src/lib/permissions.ts — المصدر الموحد الوحيد للصلاحيات
 *
 * كل سؤال "هل يستطيع هذا الدور فعل هذا الشيء؟" يجب أن يمر من هنا.
 * يستند إلى ROLE_ORDER من src/lib/roles.ts لتجنب التكرار والتناقض.
 */

import { ROLE_ORDER, type UserRole, hasRoleAtLeast } from '@/lib/roles'
import { hasSpecialRole, type SpecialRole } from '@/lib/special-roles'

export type Permission =
  | 'content.view'
  | 'content.download'
  | 'content.comment'
  | 'content.rate'
  | 'content.favorite'
  | 'content.report'
  | 'content.follow'
  | 'content.requestTranslation'
  | 'mod.createOwn'
  | 'mod.republishExternal'
  | 'mod.saveDraft'
  | 'mod.editOwn'
  | 'mod.deleteOwn'
  | 'team.create'
  | 'team.manage'
  | 'stats.viewOwn'
  | 'mod.review'
  | 'mod.approve'
  | 'mod.reject'
  | 'reports.manage'
  | 'comments.moderate'
  | 'users.warn'
  | 'users.tempBan'
  | 'content.deleteAny'
  | 'users.promote'
  | 'creatorRequests.approve'
  | 'content.manageCatalog'
  | 'specialRoles.assign'
  | 'audit.view'
  | 'site.settings'
  | 'system.apiKeys'
  | 'system.backups'
  | 'system.scheduler'
  | 'system.subscriptions'
  | 'users.promoteAdmins'
  | 'site.critical'

// الحد الأدنى من الدور المطلوب لكل صلاحية
export const PERMISSION_MIN_ROLE: Record<Permission, UserRole> = {
  'content.view': 'member',
  'content.download': 'member',
  'content.comment': 'member',
  'content.rate': 'member',
  'content.favorite': 'member',
  'content.report': 'member',
  'content.follow': 'member',
  'content.requestTranslation': 'member',
  'mod.createOwn': 'creator',
  'mod.republishExternal': 'publisher',
  'mod.saveDraft': 'creator',
  'mod.editOwn': 'creator',
  'mod.deleteOwn': 'creator',
  'team.create': 'creator',
  'team.manage': 'creator',
  'stats.viewOwn': 'creator',
  'mod.review': 'moderator',
  'mod.approve': 'moderator',
  'mod.reject': 'moderator',
  'reports.manage': 'moderator',
  'comments.moderate': 'moderator',
  'users.warn': 'moderator',
  'users.tempBan': 'moderator',
  'content.deleteAny': 'admin',
  'users.promote': 'admin',
  'creatorRequests.approve': 'admin',
  'content.manageCatalog': 'admin',
  'specialRoles.assign': 'admin',
  'audit.view': 'admin',
  'site.settings': 'manager',
  'system.apiKeys': 'manager',
  'system.backups': 'manager',
  'system.scheduler': 'manager',
  'system.subscriptions': 'owner',
  'users.promoteAdmins': 'owner',
  'site.critical': 'owner',
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  const minRole = PERMISSION_MIN_ROLE[permission]
  if (!minRole) return false
  return hasRoleAtLeast(role || 'member', minRole)
}

export function canCreateMod(role: string, isOriginalWork: boolean): boolean {
  if (isOriginalWork) return can(role, 'mod.createOwn')
  return can(role, 'mod.republishExternal')
}

// صلاحيات الأدوار الخاصة
export function canReviewMods(role: string, specialRoles?: string | null): boolean {
  if (can(role, 'mod.review')) return true
  if (hasSpecialRole(specialRoles, 'reviewer')) return true
  return false
}

export function canApproveMods(role: string, specialRoles?: string | null): boolean {
  if (can(role, 'mod.approve')) return true
  if (hasSpecialRole(specialRoles, 'reviewer')) return true
  return false
}

export function canManageTeam(role: string, specialRoles?: string | null): boolean {
  if (can(role, 'team.manage')) return true
  if (hasSpecialRole(specialRoles, 'team_lead')) return true
  return false
}
