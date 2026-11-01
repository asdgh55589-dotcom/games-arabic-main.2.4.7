/**
 * fix/approved-publish-flow — sanity of the approve→publish two-step chain:
 * IN_REVIEW→APPROVED→PUBLISHED must be valid, and there is no skip path
 * (e.g. IN_REVIEW→PUBLISHED is NOT valid — publish happens only from APPROVED).
 */
import { canTransition, isValidTransition } from '@/lib/workflow'
import { canApproveMods } from '@/lib/permissions'

describe('approve→publish flow (fix for stuck APPROVED mods)', () => {
  it('IN_REVIEW→APPROVED is valid for admin', () => {
    expect(isValidTransition('IN_REVIEW', 'APPROVED')).toBe(true)
    expect(canTransition('admin', 'IN_REVIEW', 'APPROVED')).toBe(true)
  })

  it('APPROVED→PUBLISHED is valid for admin (the publish step)', () => {
    expect(isValidTransition('APPROVED', 'PUBLISHED')).toBe(true)
    expect(canTransition('admin', 'APPROVED', 'PUBLISHED')).toBe(true)
  })

  it('IN_REVIEW→PUBLISHED is NOT valid — cannot skip approval', () => {
    expect(isValidTransition('IN_REVIEW', 'PUBLISHED')).toBe(false)
  })

  it('approve is gated by canApproveMods (moderator+), publish is workflow-gated (admin+)', () => {
    // الموافقة: moderator+ أو دور reviewer الخاص
    expect(canApproveMods('moderator', null)).toBe(true)
    expect(canApproveMods('admin', null)).toBe(true)
    expect(canApproveMods('creator', null)).toBe(false)
    // النشر: state machine بيمنع أي انتقال APPROVED→PUBLISHED غير admin/manager/owner
    expect(canTransition('moderator', 'APPROVED', 'PUBLISHED')).toBe(false)
    expect(canTransition('admin', 'APPROVED', 'PUBLISHED')).toBe(true)
    expect(canTransition('manager', 'APPROVED', 'PUBLISHED')).toBe(true)
    expect(canTransition('owner', 'APPROVED', 'PUBLISHED')).toBe(true)
  })
})
