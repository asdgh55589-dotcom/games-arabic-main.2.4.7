/**
 * src/lib/permissions.ts — المصدر الموحد الوحيد للصلاحيات
 *
 * كل سؤال "هل يستطيع هذا الدور فعل هذا الشيء؟" يجب أن يمر من هنا.
 * يستند إلى ROLE_ORDER من src/lib/roles.ts لتجنب التكرار والتناقض.
 */

import { hasRoleAtLeast, ROLE_ORDER, type UserRole } from '@/lib/roles'
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
  | 'mod.translate'
  | 'mod.republishExternal'
  | 'news.create'
  | 'report.readOwn'
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
  'mod.translate': 'creator',
  'mod.republishExternal': 'publisher',
  'news.create': 'publisher',
  'report.readOwn': 'creator',
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

/**
 * Phase 4 — Content Creator Program track matrix.
 *
 * Track lives in CreatorRequest.track at application time; after approval it
 * is ENCODED AS ROLE: translator → 'creator', publisher → 'publisher'
 * (see roleForTrack in src/lib/creator-requests.ts). The Edge proxy only
 * sees the role cookie, so every track gate below is a role gate.
 *
 *   publisher (ناشر):  mod.createOwn + mod.republishExternal + news.create
 *                       + report.readOwn (all inherited upward to staff)
 *   translator (معرّب = creator role): mod.createOwn (own translation work)
 *                       + mod.translate + report.readOwn — a strict subset.
 *                       NO news.create, NO republishExternal.
 */
export type CreatorTrack = 'publisher' | 'translator'

export function trackForRole(role: string | null | undefined): CreatorTrack | null {
  if (!role) return null
  if (role === 'publisher') return 'publisher'
  if (role === 'creator') return 'translator'
  // Staff operate above tracks — publisher capabilities for gating purposes.
  if (['moderator', 'admin', 'manager', 'owner'].includes(role)) return 'publisher'
  return null
}

/** نشر الأخبار — مسار الناشر فقط (الإدارة ترثها). */
export function canPublishNews(role: string | null | undefined): boolean {
  return can(role, 'news.create')
}

/** الترجمة — مسار المعرّب (subset من creator) والناشر والإدارة. */
export function canTranslateMod(role: string | null | undefined): boolean {
  return can(role, 'mod.translate')
}

/** قراءة بلاغات المحتوى الخاصة — كل أدوار الاستوديو. */
export function canReadOwnReports(role: string | null | undefined): boolean {
  return can(role, 'report.readOwn')
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

/**
 * هل يمكن للدور الحالي تعيين الدور المستهدف؟
 * Owner → الكل، Manager → حتى admin، Admin → حتى moderator
 */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'owner') return true
  const actorLevel = ROLE_ORDER.indexOf(actorRole as UserRole)
  const targetLevel = ROLE_ORDER.indexOf(targetRole as UserRole)
  if (actorLevel === -1 || targetLevel === -1) return false
  // لا يمكن تعيين دور مساوٍ أو أعلى من دورك (إلا المالك)
  if (actorLevel <= targetLevel) return false
  // Manager لا يستطيع تعيين manager أو owner
  if (actorRole === 'manager' && targetLevel >= ROLE_ORDER.indexOf('manager' as UserRole))
    return false
  // Admin لا يستطيع تعيين admin أو أعلى
  if (actorRole === 'admin' && targetLevel >= ROLE_ORDER.indexOf('admin' as UserRole)) return false
  return true
}
