import { db } from './db'

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface TeamPermissionCheck {
  allowed: boolean
  reason?: string
}

function getTeamRole(teamId: string, userId: string): Promise<string | null> {
  return db.teamMembership
    .findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    })
    .then((m) => m?.role || null)
}

export async function canEditMod(
  teamId: string,
  userId: string,
  modId: string
): Promise<TeamPermissionCheck> {
  const role = await getTeamRole(teamId, userId)
  if (!role) return { allowed: false, reason: 'عضو الفريق فقط' }
  if (role === 'owner' || role === 'admin') return { allowed: true }
  if (role === 'member') {
    const mod = await db.mod.findUnique({
      where: { id: modId },
      select: { authorId: true, teamId: true },
    })
    if (mod?.authorId === userId) return { allowed: true }
    return { allowed: false, reason: 'يمكن تعديل التعريبات الخاصة بك فقط' }
  }
  return { allowed: false, reason: 'صلاحية العرض فقط' }
}

export async function canDeleteMod(
  teamId: string,
  userId: string,
  modId: string
): Promise<TeamPermissionCheck> {
  const role = await getTeamRole(teamId, userId)
  if (!role) return { allowed: false, reason: 'عضو الفريق فقط' }
  if (role === 'owner' || role === 'admin') return { allowed: true }
  return { allowed: false, reason: 'صلاحية المشرف فقط' }
}

export async function canManageMembers(
  teamId: string,
  userId: string
): Promise<TeamPermissionCheck> {
  const role = await getTeamRole(teamId, userId)
  if (!role) return { allowed: false, reason: 'عضو الفريق فقط' }
  if (role === 'owner' || role === 'admin') return { allowed: true }
  return { allowed: false, reason: 'صلاحية المشرف فقط' }
}

export async function canViewDashboard(
  teamId: string,
  userId: string
): Promise<TeamPermissionCheck> {
  const role = await getTeamRole(teamId, userId)
  if (!role) return { allowed: false, reason: 'عضو الفريق فقط' }
  return { allowed: true }
}

export async function canManageTeamSettings(
  teamId: string,
  userId: string
): Promise<TeamPermissionCheck> {
  const role = await getTeamRole(teamId, userId)
  if (!role) return { allowed: false, reason: 'عضو الفريق فقط' }
  if (role === 'owner') return { allowed: true }
  return { allowed: false, reason: 'صلاحية المالك فقط' }
}

/** Check if a platform user is admin/owner (global role) */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'admin' || user?.role === 'owner'
}
