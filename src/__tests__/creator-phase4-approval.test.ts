/**
 * PHASE 4 Task 5 — track-based approval: role mapping, approveNote, email.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  approveCreatorRequest,
  roleForTrack,
  trackLabel,
} from '@/lib/creator-requests'

jest.mock('@/lib/db', () => ({
  db: {
    user: { update: jest.fn(), findUnique: jest.fn() },
    creatorRequest: { update: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(async (fn: any) =>
      fn({ user: { update: jest.fn() }, creatorRequest: { update: jest.fn() } }),
    ),
  },
}))
jest.mock('@/lib/notifications/email-service', () => ({
  sendCreatorApprovalEmail: jest.fn(),
}))
jest.mock('@/lib/auth', () => ({
  invalidateUserSessions: jest.fn().mockResolvedValue(0),
}))

import { db } from '@/lib/db'
import { sendCreatorApprovalEmail } from '@/lib/notifications/email-service'

const root = process.cwd()

describe('roleForTrack', () => {
  it('publisher → publisher, everything else → creator', () => {
    expect(roleForTrack('publisher')).toBe('publisher')
    expect(roleForTrack('translator')).toBe('creator')
    expect(roleForTrack(null)).toBe('creator')
    expect(roleForTrack(undefined)).toBe('creator')
    expect(roleForTrack('admin')).toBe('creator')
  })

  it('labels are Arabic', () => {
    expect(trackLabel('publisher')).toBe('ناشر')
    expect(trackLabel('translator')).toBe('معرّب')
  })
})

describe('approveCreatorRequest', () => {
  const txUserUpdate = jest.fn()
  const txRequestUpdate = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    ;(db.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn({ user: { update: txUserUpdate }, creatorRequest: { update: txRequestUpdate } }),
    )
    ;(db.user.findUnique as jest.Mock).mockResolvedValue({
      email: 'ali@example.com',
      username: 'ali',
    })
  })

  it('assigns publisher role for publisher track + stores note + emails', async () => {
    await approveCreatorRequest(
      { id: 'r1', userId: 'u1', status: 'pending', track: 'publisher' },
      'admin1',
      { approveNote: 'أهلاً بك' },
    )
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'publisher' },
    })
    expect(txRequestUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ status: 'approved', approveNote: 'أهلاً بك' }),
    })
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: expect.stringContaining('ناشر'),
        data: expect.objectContaining({ track: 'publisher', approveNote: 'أهلاً بك' }),
      }),
    })
    expect(sendCreatorApprovalEmail).toHaveBeenCalledWith(
      'ali@example.com',
      expect.objectContaining({ track: 'publisher', approveNote: 'أهلاً بك' }),
    )
  })

  it('assigns creator role for translator track', async () => {
    await approveCreatorRequest(
      { id: 'r2', userId: 'u2', status: 'pending', track: 'translator' },
      'admin1',
    )
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { role: 'creator' },
    })
    expect(txRequestUpdate).toHaveBeenCalledWith({
      where: { id: 'r2' },
      data: expect.objectContaining({ approveNote: null }),
    })
    expect(sendCreatorApprovalEmail).toHaveBeenCalledWith(
      'ali@example.com',
      expect.objectContaining({ track: 'translator' }),
    )
  })

  it('skips email when user has no email, still approves', async () => {
    ;(db.user.findUnique as jest.Mock).mockResolvedValue({ email: null, username: 'x' })
    await approveCreatorRequest({ id: 'r3', userId: 'u3', status: 'pending' }, 'admin1')
    expect(txUserUpdate).toHaveBeenCalled()
    expect(sendCreatorApprovalEmail).not.toHaveBeenCalled()
  })
})

describe('approveNote migration + UI (static)', () => {
  it('schema + additive migration carry approveNote', () => {
    const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
    expect(schema).toContain('approveNote')
    const sql = fs.readFileSync(
      path.join(
        root,
        'prisma/migrations/20260907080000_add_creator_approve_note/migration.sql',
      ),
      'utf8',
    )
    expect(sql).toContain('"approveNote"')
    expect(sql).not.toMatch(/DROP/i)
  })

  it('admin UI collects an applicant-visible approve note', () => {
    const page = fs.readFileSync(
      path.join(root, 'src/app/admin/creators/requests/page.tsx'),
      'utf8',
    )
    expect(page).toContain('ملاحظة للمقبول (اختياري — تظهر له)')
    expect(page).toContain('approveNote:')
  })

  it('single + bulk routes forward approveNote', () => {
    const single = fs.readFileSync(
      path.join(root, 'src/app/api/admin/creator-requests/[id]/route.ts'),
      'utf8',
    )
    const bulk = fs.readFileSync(
      path.join(root, 'src/app/api/admin/creator-requests/bulk/route.ts'),
      'utf8',
    )
    expect(single).toContain('{ approveNote }')
    expect(bulk).toContain('{ approveNote }')
  })
})
