import { db } from './db'

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'translator' | 'member' | 'tester'

export type TeamAction =
  | 'manage_members'
  | 'remove_member'
  | 'change_role'
  | 'invite'
  | 'manage_settings'
  | 'transfer_ownership'
  | 'edit_mod'
  | 'delete_mod'
  | 'view_dashboard'
  | 'view_stats'
  | 'manage_contacts'
  | 'manage_tabs'

export interface TeamPermissionCheck {
  allowed: boolean
  reason?: string
}

/** Highest → lowest. indexOf is used for "at least X role" comparisons. */
export const TEAM_ROLE_ORDER: TeamRole[] = [
  'owner',
  'admin',
  'moderator',
  'translator',
  'member',
  'tester',
]

export function isTeamRole(role: string | undefined | null): role is TeamRole {
  return TEAM_ROLE_ORDER.includes(role as TeamRole)
}

/** Role hierarchy: true when `role` is at least `minimum`. */
export function hasTeamRoleAtLeast(role: TeamRole, minimum: TeamRole): boolean {
  return TEAM_ROLE_ORDER.indexOf(role) <= TEAM_ROLE_ORDER.indexOf(minimum)
}

/**
 * Static permission matrix: what each role may do without a DB lookup.
 * Used to short-circuit UI rendering and to guard route handlers before any
 * database call. Database-backed checks (below) remain the source of truth at
 * write time.
 */
export const TEAM_ROLE_PERMISSIONS: Record<TeamRole, Set<TeamAction>> = {
  owner: new Set([
    'manage_members', 'remove_member', 'change_role', 'invite',
    'manage_settings', 'transfer_ownership', 'edit_mod', 'delete_mod',
    'view_dashboard', 'view_stats', 'manage_contacts', 'manage_tabs',
  ]),
  admin: new Set([
    'manage_members', 'remove_member', 'change_role', 'invite',
    'manage_settings', 'edit_mod', 'delete_mod', 'view_dashboard',
    'view_stats', 'manage_contacts', 'manage_tabs',
  ]),
  moderator: new Set([
    'manage_members', 'invite', 'edit_mod', 'view_dashboard', 'view_stats',
    'manage_contacts', 'manage_tabs',
  ]),
  translator: new Set(['edit_mod', 'view_dashboard', 'view_stats']),
  member: new Set(['view_dashboard', 'view_stats']),
  tester: new Set(['view_dashboard', 'view_stats']),
}

export function canManageTeam(userRole: TeamRole, action: TeamAction): boolean {
  return TEAM_ROLE_PERMISSIONS[userRole]?.has(action) ?? false
}

/**
 * A member may not act on someone with an equal-or-higher role, and an owner
 * cannot be removed/demoted except through the ownership-transfer flow.
 */
export function canActOnTarget(actorRole: TeamRole, targetRole: TeamRole): boolean {
  if (targetRole === 'owner') return false
  return hasTeamRoleAtLeast(actorRole, targetRole)
}

export interface TeamPermissionContext {
  teamId: string
  userId: string
  actorRole: TeamRole
}

export async function getTeamRole(
  teamId: string,
  userId: string,
): Promise<TeamRole | null> {
  return db.teamMembership
    .findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true, status: true },
    })
    .then((m) => (m && isTeamRole(m.role) ? m.role : null))
}

/**
 * Assert the caller may perform `action` on `teamId`. Returns the resolved
 * role when allowed, or a rejection reason when not. Routes convert the
 * rejection into a 403 response.
 */
export async function assertTeamPermission(
  teamId: string,
  userId: string,
  action: TeamAction,
): Promise<{ allowed: true; role: TeamRole } | { allowed: false; reason: string }> {
  const role = await getTeamRole(teamId, userId)
  if (!role) {
    return { allowed: false, reason: 'أنت عضو في هذا الفريق' }
  }
  if (!canManageTeam(role, action)) {
    return { allowed: false, reason: 'لا تملك صلاحية تنفيذ هذا الإجراء' }
  }
  return { allowed: true, role }
}

export async function canEditMod(
  ctx: TeamPermissionContext,
  modId: string,
): Promise<TeamPermissionCheck> {
  const { teamId, userId, actorRole } = ctx
  if (!canManageTeam(actorRole, 'edit_mod')) {
    return { allowed: false, reason: 'لا تملك صلاحية تعديل التعريبات' }
  }
  const role = await getTeamRole(teamId, userId)
  if (!role) return { allowed: false, reason: 'أنت عضو في هذا الفريق' }
  if (role === 'owner' || role === 'admin') return { allowed: true }
  if (role === 'moderator') return { allowed: true }
  if (role === 'translator') {
    const mod = await db.mod.findUnique({
      where: { id: modId },
      select: { authorId: true, teamId: true },
    })
    if (mod?.authorId === userId && mod?.teamId === teamId) return { allowed: true }
    return { allowed: false, reason: 'يمكن تعديل التعريبات الخاصة بك فقط' }
  }
  return { allowed: false, reason: 'صلاحية العرض فقط' }
}

export async function canDeleteMod(
  ctx: TeamPermissionContext,
  modId: string,
): Promise<TeamPermissionCheck> {
  const { teamId, userId, actorRole } = ctx
  if (!canManageTeam(actorRole, 'delete_mod')) {
    return { allowed: false, reason: 'لا تملك صلاحية حذف التعريبات' }
  }
  const role = await getTeamRole(teamId, userId)
  if (!role) return { allowed: false, reason: 'أنت عضو في هذا الفريق' }
  if (role === 'owner' || role === 'admin') return { allowed: true }
  return { allowed: false, reason: 'صلاحية المشرف فقط' }
}

export async function canManageMembers(
  ctx: TeamPermissionContext,
): Promise<TeamPermissionCheck> {
  const { actorRole } = ctx
  if (!canManageTeam(actorRole, 'manage_members')) {
    return { allowed: false, reason: 'لا تملك صلاحية إدارة الأعضاء' }
  }
  return { allowed: true }
}

export async function canViewDashboard(
  ctx: TeamPermissionContext,
): Promise<TeamPermissionCheck> {
  const { actorRole } = ctx
  if (!canManageTeam(actorRole, 'view_dashboard')) {
    return { allowed: false, reason: 'صلاحية العرض فقط' }
  }
  return { allowed: true }
}

export async function canManageTeamSettings(
  ctx: TeamPermissionContext,
): Promise<TeamPermissionCheck> {
  const { actorRole } = ctx
  if (!canManageTeam(actorRole, 'manage_settings')) {
    return { allowed: false, reason: 'صلاحية المالك أو المدير فقط' }
  }
  return { allowed: true }
}

/** Check if a platform user is admin/owner (global role). */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'admin' || user?.role === 'owner'
}

/** Arabic labels for team roles — single source of truth. */
export const TEAM_ROLE_LABELS: Record<TeamRole, { label: string; color: string }> = {
  owner: { label: 'مالك', color: 'text-amber-600' },
  admin: { label: 'مدير', color: 'text-red-500' },
  moderator: { label: 'مشرف', color: 'text-orange-500' },
  translator: { label: 'مترجم', color: 'text-blue-500' },
  member: { label: 'عضو', color: 'text-slate-500' },
  tester: { label: 'مختبر', color: 'text-emerald-500' },
}

/** Arabic labels for member status. */
export const MEMBER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'نشط', color: 'text-green-600' },
  removed: { label: 'محذوف', color: 'text-red-600' },
  left: { label: 'غادر', color: 'text-gray-500' },
}
