/**
 * Fix 4 (Phase 4B): POST /api/admin/users/[id]/recover — admin-assisted
 * recovery for inbox-less (Telegram-only) accounts.
 *
 * - non-staff → 403, nothing written
 * - unknown user → 404
 * - self-recovery → 403
 * - valid → 200 + one-time temp password; stored value is its bcrypt hash
 *   (plaintext never persisted/logged); sessions killed; audited
 * - owner target by non-owner admin → 403
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest-4b'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockRequireAdmin = jest.fn()
const mockInvalidate = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireAdmin: (...a: Array<never>) => mockRequireAdmin(...a),
  invalidateUserSessions: (...a: Array<never>) => mockInvalidate(...a),
  hashPassword: jest.requireActual('@/lib/auth').hashPassword,
}))

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { user: { findUnique: (...a: Array<never>) => mockFindUnique(...a), update: (...a: Array<never>) => mockUpdate(...a) } },
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))
const { logAction } = jest.requireMock('@/lib/audit') as { logAction: jest.Mock }

import bcrypt from 'bcryptjs'
import { POST as recoverPOST } from '@/app/api/admin/users/[id]/recover/route'

function authError(message: string, status: number) {
  const e = new Error(message) as Error & { status: number }
  e.name = 'AuthError'
  e.status = status
  return e
}

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ip = 300
function adminReq() {
  ip += 1
  return new NextRequest('http://x/api/admin/users/u-tg/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.62.0.${ip}` },
    body: JSON.stringify({}),
  })
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })

const ADMIN = { id: 'u-admin', username: 'boss', role: 'admin' }
const TARGET = { id: 'u-tg', username: 'tguser', email: 'telegram_5@telegram.local', role: 'member' }

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue(ADMIN)
  mockFindUnique.mockResolvedValue(TARGET)
  mockUpdate.mockResolvedValue({ id: 'u-tg' })
  mockInvalidate.mockResolvedValue(1)
})

describe('POST /api/admin/users/[id]/recover', () => {
  it('rejects non-staff (403, nothing written)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(authError('Forbidden — admin access required', 403))
    const res = await recoverPOST(adminReq(), params('u-tg'))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(logAction).not.toHaveBeenCalled()
  })

  it('returns 404 for unknown users', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await recoverPOST(adminReq(), params('u-nope'))
    expect(res.status).toBe(404)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('forbids self-recovery', async () => {
    const res = await recoverPOST(adminReq(), params('u-admin'))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('issues a one-time temp password: hash stored, sessions killed, audited', async () => {
    const res = await recoverPOST(adminReq(), params('u-tg'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const temp = body.data.tempPassword as string
    expect(typeof temp).toBe('string')
    expect(temp.length).toBeGreaterThanOrEqual(10)
    expect(body.data.username).toBe('tguser')

    // Stored value is the bcrypt hash of the returned secret — and the
    // plaintext appears nowhere in the persisted payload.
    const stored = mockUpdate.mock.calls[0][0].data.password as string
    expect(await bcrypt.compare(temp, stored)).toBe(true)
    expect(JSON.stringify(mockUpdate.mock.calls[0][0])).not.toContain(temp.slice(0, 8))

    expect(mockInvalidate).toHaveBeenCalledWith('u-tg')
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_account_recovery', userId: 'u-admin', entityId: 'u-tg' }),
    )
  })

  it('forbids non-owner admins from recovering owners', async () => {
    mockFindUnique.mockResolvedValue({ ...TARGET, id: 'u-owner', role: 'owner' })
    const res = await recoverPOST(adminReq(), params('u-owner'))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
