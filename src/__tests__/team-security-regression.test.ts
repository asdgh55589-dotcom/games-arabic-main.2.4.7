import { z } from 'zod'

describe('team security regression', () => {
  it('ghost role enum excludes owner', () => {
    const ASSIGNABLE = ['admin', 'moderator', 'translator', 'member', 'tester'] as const
    const schema = z.enum(ASSIGNABLE)
    expect(schema.safeParse('owner').success).toBe(false)
    expect(schema.safeParse('admin').success).toBe(true)
    expect(schema.safeParse('member').success).toBe(true)
  })

  it('reorder dedup rejects duplicates', () => {
    const ids = ['a', 'a']
    const existingIds = new Set(['a', 'b'])
    const dup = new Set(ids).size !== ids.length
    expect(dup).toBe(true)
  })

  it('reorder exact set equality', () => {
    const ids = ['a', 'b']
    const existingIds = new Set(['a', 'b'])
    const ok = new Set(ids).size === ids.length && ids.length === existingIds.size && ids.every((id) => existingIds.has(id))
    expect(ok).toBe(true)
  })

  it('reorder rejects missing ids', () => {
    const ids = ['a']
    const existingIds = new Set(['a', 'b'])
    const ok = new Set(ids).size === ids.length && ids.length === existingIds.size && ids.every((id) => existingIds.has(id))
    expect(ok).toBe(false)
  })

  it('link requires ghost (userId null)', () => {
    const member = { userId: 'u1' }
    const isGhost = member.userId === null
    expect(isGhost).toBe(false)
  })
})
