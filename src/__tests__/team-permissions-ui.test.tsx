/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { useTeamPermissions } from '@/hooks/use-team-permissions'

describe('useTeamPermissions', () => {
  it('owner sees all permissions', () => {
    const { result } = renderHook(() => useTeamPermissions('owner'))
    expect(result.current.canInvite).toBe(true)
    expect(result.current.canRemove).toBe(true)
    expect(result.current.canChangeRole).toBe(true)
    expect(result.current.canEditContacts).toBe(true)
    expect(result.current.canEditTabs).toBe(true)
    expect(result.current.canEditSettings).toBe(true)
    expect(result.current.canLinkMods).toBe(true)
    expect(result.current.canTransfer).toBe(true)
    expect(result.current.isOwner).toBe(true)
  })

  it('admin cannot transfer ownership', () => {
    const { result } = renderHook(() => useTeamPermissions('admin'))
    expect(result.current.canInvite).toBe(true)
    expect(result.current.canTransfer).toBe(false)
    expect(result.current.isOwner).toBe(false)
  })

  it('moderator cannot change role or edit settings', () => {
    const { result } = renderHook(() => useTeamPermissions('moderator'))
    expect(result.current.canInvite).toBe(true)
    expect(result.current.canChangeRole).toBe(false)
    expect(result.current.canEditSettings).toBe(false)
  })

  it('translator can view but not manage', () => {
    const { result } = renderHook(() => useTeamPermissions('translator'))
    expect(result.current.canInvite).toBe(false)
    expect(result.current.canRemove).toBe(false)
    expect(result.current.canEditContacts).toBe(false)
    expect(result.current.canEditTabs).toBe(false)
  })

  it('member/tester are view-only', () => {
    const { result: m } = renderHook(() => useTeamPermissions('member'))
    expect(m.current.canInvite).toBe(false)
    expect(m.current.canRemove).toBe(false)
    const { result: t } = renderHook(() => useTeamPermissions('tester'))
    expect(t.current.canInvite).toBe(false)
  })

  it('undefined role defaults to member (view-only)', () => {
    const { result } = renderHook(() => useTeamPermissions(undefined))
    expect(result.current.canInvite).toBe(false)
    expect(result.current.isOwner).toBe(false)
  })

  it('canArchive uses manage_settings', () => {
    const { result: owner } = renderHook(() => useTeamPermissions('owner'))
    expect(owner.current.canArchive).toBe(true)
    const { result: member } = renderHook(() => useTeamPermissions('member'))
    expect(member.current.canArchive).toBe(false)
  })

  it('returns teamRole', () => {
    const { result } = renderHook(() => useTeamPermissions('admin'))
    expect(result.current.teamRole).toBe('admin')
  })
})
