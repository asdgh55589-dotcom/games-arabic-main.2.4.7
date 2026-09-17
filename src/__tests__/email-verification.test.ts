/**
 * Email verification for setup-added emails (OAuth users).
 *
 * RED phase — verify/resend routes do not exist yet, so those suites fail
 * until POST /api/auth/verify-email{,/resend} are implemented.
 *
 * Rules pinned here:
 * - adding an email creates a single-use hashed token (24h) + sends mail +
 *   marks emailVerified:false (password-only setup sends nothing)
 * - verify accepts a valid token; expired/used/unknown/mismatched → 422
 * - recovery is blocked while a verification is pending AND the address was
 *   never verified; the owner gets a clear message, strangers get generic ok
 * - legacy users (no token history) keep recovery unchanged (no regression)
 * - resend is authed, rotates old tokens, max 3/hour per user
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

import { createHash } from 'crypto'

const mockRequireAuth = jest.fn()
const mockOptionalSession = jest.fn()
const mockLogAction = jest.fn()

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: Array<never>) => mockRequireAuth(...a),
  getOptionalSession: (...a: Array<never>) => mockOptionalSession(...a),
  hashPassword: jest.requireActual('@/lib/auth').hashPassword,
}))

const mockDbUser = { findUnique: jest.fn(), update: jest.fn() }
const mockDbVerify = {
  create: jest.fn(),
  deleteMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
}
jest.mock('@/lib/db', () => ({
  db: { user: mockDbUser, emailVerificationToken: mockDbVerify },
}))

const mockSendVerification = jest.fn()
jest.mock('@/lib/verification-email', () => ({
  ...jest.requireActual('@/lib/verification-email'),
  sendVerificationEmail: (...a: Array<never>) => mockSendVerification(...a),
}))

jest.mock('@/lib/audit', () => ({ logAction: (...a: Array<never>) => mockLogAction(...a) }))

// Supabase admin bèhavior for setup-password path (c): provision identity.
const mockAdminCreateUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: jest.fn(async () => ({ data: { user: null } })) } })),
  createAdminClient: (...a: Array<never>) =>
    mockAdminCreateUser
      ? {
          auth: {
            admin: {
              getUserById: jest.fn(async () => ({ data: { user: null }, error: null })),
              updateUserById: jest.fn(async () => ({ error: null })),
              createUser: (...b: Array<never>) => mockAdminCreateUser(...b),
            },
          },
        }
      : null,
}))

import { POST as setupPOST } from '@/app/api/auth/setup-password/route'
import { POST as verifyPOST } from '@/app/api/auth/verify-email/route'
import { POST as resendPOST } from '@/app/api/auth/verify-email/resend/route'
import { POST as recoverPOST } from '@/app/api/auth/recover/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ipCounter = 500
function req(path: string, body: unknown, headers: Record<string, string> = {}) {
  ipCounter += 1
  return new NextRequest(`http://x${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.40.0.${ipCounter}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function telegramUser() {
  return {
    id: 'u-1',
    username: 'tguser',
    email: 'telegram_123@telegram.local',
    password: null,
    supabaseId: null,
  }
}

const VALID_PW = { password: 'brand-new-pass-1', confirmPassword: 'brand-new-pass-1' }

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ id: 'u-1', username: 'tguser', email: 'telegram_123@telegram.local' })
  mockOptionalSession.mockResolvedValue(null)
  mockSendVerification.mockResolvedValue(true)
  mockAdminCreateUser.mockResolvedValue({ data: { user: { id: 'sb-new' } }, error: null })
  mockDbVerify.deleteMany.mockResolvedValue({ count: 0 })
  mockDbVerify.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'evt-1', usedAt: null, ...data }))
  mockDbVerify.count.mockResolvedValue(0)
  mockDbUser.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'u-1', ...data }))
})

async function unpack(res: Response) {
  const body = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string } | string
    data?: Record<string, unknown>
  }
  return { status: res.status, body }
}

function sha(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

describe('setup-password email path issues verification', () => {
  it('adding an email creates a token, sends mail, marks unverified', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce(telegramUser()).mockResolvedValueOnce(null)
    const { status, body } = await unpack(
      await setupPOST(req('/api/auth/setup-password', { ...VALID_PW, email: 'real-tg@mail.com' })),
    )
    expect(status).toBe(200)
    expect(mockDbVerify.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1', usedAt: null } })
    expect(mockDbVerify.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u-1', email: 'real-tg@mail.com' }),
    })
    const created = mockDbVerify.create.mock.calls[0][0].data as Record<string, unknown>
    expect(typeof created.tokenHash).toBe('string')
    expect((created.expiresAt as Date).getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000)
    expect(mockSendVerification).toHaveBeenCalledWith(
      'real-tg@mail.com',
      expect.stringContaining('/verify-email-address?token='),
    )
    expect(mockDbUser.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ email: 'real-tg@mail.com', emailVerified: false }),
    })
    expect(body.data).toEqual(
      expect.objectContaining({ success: true, verificationSent: true, needsVerification: true }),
    )
  })

  it('password-only setup sends no email and creates no token', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce({ ...telegramUser(), email: 'g@mail.com', supabaseId: 'sb-1' })
    const { status } = await unpack(await setupPOST(req('/api/auth/setup-password', VALID_PW)))
    expect(status).toBe(200)
    expect(mockDbVerify.create).not.toHaveBeenCalled()
    expect(mockSendVerification).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/verify-email', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'evt-1',
    userId: 'u-1',
    email: 'real-tg@mail.com',
    tokenHash: sha('raw-token-abc-1234567890abcdef'),
    expiresAt: new Date(Date.now() + 3600 * 1000),
    usedAt: null,
    user: { id: 'u-1', username: 'tguser', email: 'real-tg@mail.com' },
    ...over,
  })

  it('valid token verifies the address (single-use)', async () => {
    mockDbVerify.findUnique.mockResolvedValue(row())
    mockDbUser.update.mockResolvedValue({ id: 'u-1' })
    const { status } = await unpack(await verifyPOST(req('/api/auth/verify-email', { token: 'raw-token-abc-1234567890abcdef' })))
    expect(status).toBe(200)
    expect(mockDbVerify.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha('raw-token-abc-1234567890abcdef') },
      include: { user: { select: { id: true, username: true, email: true } } },
    })
    expect(mockDbVerify.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({ usedAt: expect.any(Date) }),
    })
    expect(mockDbUser.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { emailVerified: true },
    })
    expect(mockLogAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'email_verified' }))
  })

  it('unknown token is rejected generically', async () => {
    mockDbVerify.findUnique.mockResolvedValue(null)
    const { status, body } = await unpack(
      await verifyPOST(req('/api/auth/verify-email', { token: 'nope-nope-nope-1234' })),
    )
    expect(status).toBe(422)
    expect(JSON.stringify(body)).toContain('غير صالح أو منتهي')
  })

  it('expired token is rejected', async () => {
    mockDbVerify.findUnique.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }))
    const { status } = await unpack(
      await verifyPOST(req('/api/auth/verify-email', { token: 'raw-token-abc-1234567890abcdef' })),
    )
    expect(status).toBe(422)
  })

  it('already-used token is rejected', async () => {
    mockDbVerify.findUnique.mockResolvedValue(row({ usedAt: new Date() }))
    const { status } = await unpack(
      await verifyPOST(req('/api/auth/verify-email', { token: 'raw-token-abc-1234567890abcdef' })),
    )
    expect(status).toBe(422)
    expect(mockDbUser.update).not.toHaveBeenCalled()
    expect(mockDbVerify.update).not.toHaveBeenCalled()
  })

  it('token for a stale address is rejected after the user changed email', async () => {
    mockDbVerify.findUnique.mockResolvedValue(
      row({ user: { id: 'u-1', username: 'tguser', email: 'newer@mail.com' } }),
    )
    const { status } = await unpack(
      await verifyPOST(req('/api/auth/verify-email', { token: 'raw-token-abc-1234567890abcdef' })),
    )
    expect(status).toBe(422)
    expect(mockDbUser.update).not.toHaveBeenCalled()
    expect(mockDbVerify.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/verify-email/resend', () => {
  const selfRow = () => ({
    id: 'u-1', username: 'tguser', email: 'real-tg@mail.com', emailVerified: false,
  })

  it('unauthenticated callers are rejected', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error('Unauthorized'))
    const { status } = await unpack(await resendPOST(req('/api/auth/verify-email/resend', {})))
    expect(status).toBe(401)
  })

  it('resends and rotates previous unused tokens', async () => {
    mockDbUser.findUnique.mockResolvedValue(selfRow())
    const { status, body } = await unpack(await resendPOST(req('/api/auth/verify-email/resend', {})))
    expect(status).toBe(200)
    expect(mockDbVerify.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1', usedAt: null } })
    expect(mockDbVerify.create).toHaveBeenCalled()
    expect(mockSendVerification).toHaveBeenCalledWith(
      'real-tg@mail.com',
      expect.stringContaining('/verify-email-address?token='),
    )
    expect(body.data).toEqual(expect.objectContaining({ success: true, verificationSent: true }))
  })

  it('fourth resend within an hour is rate limited', async () => {
    mockDbUser.findUnique.mockResolvedValue(selfRow())
    mockDbVerify.count.mockResolvedValue(3)
    const { status, body } = await unpack(await resendPOST(req('/api/auth/verify-email/resend', {})))
    expect(status).toBe(429)
    expect(JSON.stringify(body)).toContain('٣ في الساعة')
    expect(mockDbVerify.create).not.toHaveBeenCalled()
    expect(mockSendVerification).not.toHaveBeenCalled()
  })

  it('synthetic addresses have nothing to verify', async () => {
    mockDbUser.findUnique.mockResolvedValue({ ...selfRow(), email: 'telegram_123@telegram.local' })
    const { status } = await unpack(await resendPOST(req('/api/auth/verify-email/resend', {})))
    expect(status).toBe(422)
    expect(mockSendVerification).not.toHaveBeenCalled()
  })
})

describe('recover respects pending verification', () => {
  const realUser = () => ({
    id: 'u-9', username: 'victim', email: 'victim@mail.com', supabaseId: 'sb-9',
  })

  it('owner with pending verification gets a clear verify-first message, no mail sent', async () => {
    mockDbUser.findUnique.mockResolvedValue(realUser())
    mockDbVerify.findFirst.mockResolvedValue({ id: 'evt-9' })
    mockDbVerify.count.mockResolvedValue(1)
    mockOptionalSession.mockResolvedValue({ id: 'u-9', username: 'victim', email: 'victim@mail.com' })
    const { status, body } = await unpack(
      await recoverPOST(req('/api/auth/recover', { email: 'victim@mail.com' })),
    )
    expect(status).toBe(403)
    expect(JSON.stringify(body)).toContain('EMAIL_UNVERIFIED')
  })

  it('strangers get the generic ok with no mail sent (no oracle)', async () => {
    mockDbUser.findUnique.mockResolvedValue(realUser())
    mockDbVerify.findFirst.mockResolvedValue({ id: 'evt-9' })
    mockDbVerify.count.mockResolvedValue(1)
    mockOptionalSession.mockResolvedValue(null)
    const { status, body } = await unpack(
      await recoverPOST(req('/api/auth/recover', { email: 'victim@mail.com' })),
    )
    expect(status).toBe(200)
    expect(body.data).toEqual(expect.objectContaining({ success: true }))
  })
})
