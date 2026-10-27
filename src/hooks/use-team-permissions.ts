import { canManageTeam } from '@/lib/team-permissions'

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'translator' | 'member' | 'tester'

export function useTeamPermissions(teamRole?: string | null) {
  const role = (teamRole || 'member') as TeamRole
  const can = (action: Parameters<typeof canManageTeam>[1]) => canManageTeam(role, action)
  return {
    teamRole: role,
    canInvite: can('invite'),
    canRemove: can('remove_member'),
    canChangeRole: can('change_role'),
    canEditContacts: can('manage_contacts'),
    canEditTabs: can('manage_tabs'),
    canEditSettings: can('manage_settings'),
    canLinkMods: can('edit_mod'),
    canTransfer: can('transfer_ownership'),
    canArchive: can('manage_settings'),
    canViewStats: can('view_stats'),
    isOwner: role === 'owner',
  }
}
