import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildSendPayload,
  resolveRecipientCount,
  validateSendForm,
} from '@/app/admin/notifications/send/page'

/**
 * P4 — SEND page.
 *
 * jest here runs in the node environment with no jsdom, so the behavioural
 * rules are exported as pure functions and asserted directly; the file-level
 * assertions below cover the controls that cannot be exercised without a DOM.
 */

const PAGE = readFileSync(join(process.cwd(), 'src/app/admin/notifications/send/page.tsx'), 'utf8')

const VALID = {
  type: 'system_alert',
  title: 'صيانة',
  message: 'ستتوقف الخدمة قليلاً',
  channels: ['in_app'],
  target: 'all' as const,
  role: 'member',
  selectedUsers: [] as { id: string; username: string; displayName: string | null }[],
}

describe('recipient count', () => {
  it('is exact for the users target because we hold the ids', () => {
    const users = [
      { id: 'a', username: 'a', displayName: null },
      { id: 'b', username: 'b', displayName: 'ب' },
    ]
    expect(resolveRecipientCount('users', users, null)).toBe(2)
    expect(resolveRecipientCount('users', [], 9999)).toBe(0)
  })

  it('uses the server estimate for the broad targets', () => {
    expect(resolveRecipientCount('all', [], 2189)).toBe(2189)
    expect(resolveRecipientCount('role', [], 12)).toBe(12)
  })

  it('reports null instead of zero while the estimate is unknown', () => {
    // Zero is a real recipient count; null means "not known yet". Collapsing
    // them would let an operator confirm a send claiming nobody receives it.
    expect(resolveRecipientCount('all', [], null)).toBeNull()
  })
})

describe('send form validation', () => {
  it('accepts a complete form', () => {
    expect(validateSendForm(VALID)).toBeNull()
  })

  it('blocks an empty title or message', () => {
    expect(validateSendForm({ ...VALID, title: '   ' })).toBe('العنوان مطلوب')
    expect(validateSendForm({ ...VALID, message: '  ' })).toBe('الرسالة مطلوبة')
  })

  it('blocks a send with no channel selected', () => {
    expect(validateSendForm({ ...VALID, channels: [] })).toBeTruthy()
  })

  it('blocks the users target with nobody picked', () => {
    // Otherwise the route would fan out to an empty id list and report success.
    const problem = validateSendForm({ ...VALID, target: 'users' })
    expect(problem).toBeTruthy()
  })

  it('allows the users target once someone is picked', () => {
    expect(
      validateSendForm({
        ...VALID,
        target: 'users',
        selectedUsers: [{ id: 'a', username: 'a', displayName: null }],
      }),
    ).toBeNull()
  })
})

describe('send payload shape', () => {
  it('omits role and userIds for the all target', () => {
    const payload = buildSendPayload({ ...VALID, role: 'member', selectedUsers: [] })
    expect(payload.target).toBe('all')
    expect(payload).not.toHaveProperty('userIds')
    expect(payload).not.toHaveProperty('role')
  })

  it('sends the role only for the role target', () => {
    const payload = buildSendPayload({ ...VALID, target: 'role', role: 'owner' })
    expect(payload.role).toBe('owner')
    expect(payload).not.toHaveProperty('userIds')
  })

  it('sends userIds only for the users target', () => {
    const payload = buildSendPayload({
      ...VALID,
      target: 'users',
      selectedUsers: [
        { id: 'a', username: 'a', displayName: null },
        { id: 'b', username: 'b', displayName: 'ب' },
      ],
    })
    expect(payload.userIds).toEqual(['a', 'b'])
    expect(payload).not.toHaveProperty('role')
  })

  it('trims the title and message', () => {
    const payload = buildSendPayload({ ...VALID, title: '  x  ', message: '  y  ' })
    expect(payload.title).toBe('x')
    expect(payload.message).toBe('y')
  })
})

describe('controls present on the page', () => {
  it('offers the users target that the send route already supports', () => {
    // The route has had a `users` branch since before this page existed.
    expect(PAGE).toContain('<SelectItem value="users">')
  })

  it('renders the role list from the canonical module so owner is selectable', () => {
    expect(PAGE).toContain('ROLE_ORDER.map')
    expect(PAGE).toContain('ROLE_LABELS[r]')
  })

  it('opens a confirmation dialog before sending', () => {
    expect(PAGE).toContain('confirmOpen')
    expect(PAGE).toContain('<DialogTitle>تأكيد الإرسال</DialogTitle>')
  })

  it('renders channel buttons through the shared label map', () => {
    expect(PAGE).toContain('channelLabel(channel)')
    expect(PAGE).not.toMatch(/in_app\]/)
  })

  it('sends the test to the signed-in admin via auth/me', () => {
    expect(PAGE).toContain('/api/auth/me')
    expect(PAGE).toContain('اختبار إلى نفسي')
  })

  it('estimates recipients from the users API', () => {
    expect(PAGE).toContain('/api/admin/users?')
  })
})
