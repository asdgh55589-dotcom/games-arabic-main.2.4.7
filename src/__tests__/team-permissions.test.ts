/**
 * Team permissions — permission matrix + role hierarchy.
 * Pure unit tests (no DB) for canManageTeam / hasTeamRoleAtLeast / canActOnTarget.
 */
import {
  canManageTeam,
  hasTeamRoleAtLeast,
  canActOnTarget,
  TEAM_ROLE_PERMISSIONS,
  TEAM_ROLE_LABELS,
  type TeamRole,
  type TeamAction,
} from '@/lib/team-permissions'

const ROLES: TeamRole[] = [
  'owner',
  'admin',
  'moderator',
  'translator',
  'member',
  'tester',
]

const ACTIONS: TeamAction[] = [
  'manage_members',
  'remove_member',
  'change_role',
  'invite',
  'manage_settings',
  'transfer_ownership',
  'edit_mod',
  'delete_mod',
  'view_dashboard',
  'view_stats',
  'manage_contacts',
  'manage_tabs',
]

describe('team permissions matrix', () => {
  it('every canonical role has a label', () => {
    for (const role of ROLES) {
      expect(TEAM_ROLE_LABELS[role]).toBeDefined()
      expect(TEAM_ROLE_LABELS[role].label).not.toBe('')
    }
  })

  it('owner has every permission', () => {
    for (const action of ACTIONS) {
      expect(canManageTeam('owner', action)).toBe(true)
    }
  })

  it('tester only has view_dashboard and view_stats', () => {
    expect(canManageTeam('tester', 'view_dashboard')).toBe(true)
    expect(canManageTeam('tester', 'view_stats')).toBe(true)
    expect(canManageTeam('tester', 'edit_mod')).toBe(false)
    expect(canManageTeam('tester', 'invite')).toBe(false)
  })

  it('member only has view_dashboard and view_stats', () => {
    expect(canManageTeam('member', 'view_dashboard')).toBe(true)
    expect(canManageTeam('member', 'view_stats')).toBe(true)
    expect(canManageTeam('member', 'manage_members')).toBe(false)
  })

  it('moderator can edit mods and view stats but not transfer ownership', () => {
    expect(canManageTeam('moderator', 'edit_mod')).toBe(true)
    expect(canManageTeam('moderator', 'view_stats')).toBe(true)
    expect(canManageTeam('moderator', 'transfer_ownership')).toBe(false)
    expect(canManageTeam('moderator', 'manage_settings')).toBe(false)
  })

  it('admin cannot transfer ownership', () => {
    expect(canManageTeam('admin', 'transfer_ownership')).toBe(false)
    expect(canManageTeam('admin', 'manage_members')).toBe(true)
  })

  it('translator can edit own mods but not delete mods', () => {
    expect(canManageTeam('translator', 'edit_mod')).toBe(true)
    expect(canManageTeam('translator', 'delete_mod')).toBe(false)
  })
})

describe('role hierarchy', () => {
  it('hasTeamRoleAtLeast compares by order index', () => {
    expect(hasTeamRoleAtLeast('owner', 'admin')).toBe(true)
    expect(hasTeamRoleAtLeast('admin', 'owner')).toBe(false)
    expect(hasTeamRoleAtLeast('moderator', 'moderator')).toBe(true)
    expect(hasTeamRoleAtLeast('member', 'owner')).toBe(false)
  })

  it('cannot act on an owner', () => {
    expect(canActOnTarget('admin', 'owner')).toBe(false)
    expect(canActOnTarget('owner', 'owner')).toBe(false)
  })

  it('can act on lower-or-equal non-owner roles', () => {
    expect(canActOnTarget('admin', 'member')).toBe(true)
    expect(canActOnTarget('moderator', 'moderator')).toBe(true)
    expect(canActOnTarget('member', 'moderator')).toBe(false)
  })
})
