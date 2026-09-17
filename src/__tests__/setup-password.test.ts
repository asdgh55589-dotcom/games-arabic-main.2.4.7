/**
 * P0: setup-password for OAuth-only users (Telegram / Google).
 *
 * RED phase — the route does not exist yet, so every test here fails
 * until POST /api/auth/setup-password is implemented.
 *
 * Rules pinned by these tests:
 * - self only (session user is the target; no userId parameter exists)
 * - no current-password requirement when no password exists yet
 * - 409 when a password credential already exists (Neon hash OR Supabase email identity)
 * - strict password policy (10..128, no whitespace-only, != username/email, confirm match)
 * - bcrypt hash stored, never plaintext
 * - OAuth methods untouched (no role/tokenVersion/OAuthAccount changes)
 * - audit event emitted
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

import bcrypt from 'bcryptjs'

const mockRequireAuth = jest.fn()
const mockLogAction = jest.fn()

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: Array<never>) => mockRequireAuth(...a),
  hashPassword: jest.requireActual('@/lib/auth').hashPassword,
}))

const mockDbUser = { findUnique: jest.fn(), update: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: {
    user: mockDbUser,
    emailVerificationToken: { create: jest.fn(), deleteMany: jest.fn() },
  },
}))

jest.mock('@/lib/verification-email', () => ({
  ...jest.requireActual('@/lib/verification-email'),
  sendVerificationEmail: jest.fn(async () => true),
}))

const mockGetUser = jest.fn()
const mockUpdateUser = jest.fn()
const mockAdminGetUserById = jest.fn()
const mockAdminUpdateUserById = jest.fn()
const mockAdminCreateUser = jest.fn()
const mockCreateAdminClient = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser, updateUser: mockUpdateUser },
  })),
  createAdminClient: (...a: Array<never>) => mockCreateAdminClient(...a),
}))

jest.mock('@/lib/audit', () => ({ logAction: (...a: Array<never>) => mockLogAction(...a) }))

import { POST as setupPOST } from '@/app/api/auth/setup-password/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ipCounter = 100
function setupReq(body: unknown) {
  ipCounter += 1
  return new NextRequest('http://x/api/auth/setup-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.20.30.${ipCounter}` },
    body: JSON.stringify(body),
  })
}

const SESSION = { id: 'u-1', username: 'tguser', email: 'telegram_123@telegram.local' }

function telegramUser() {
  return {
    id: 'u-1',
    username: 'tguser',
    email: 'telegram_123@telegram.local',
    password: null,
    supabaseId: null,
  }
}

function googleUser() {
  return {
    id: 'u-2',
    username: 'guser',
    email: 'guser@mail.com',
    password: null,
    supabaseId: 'sb-123',
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue(SESSION)
  mockGetUser.mockResolvedValue({ data: { user: null } })
  mockCreateAdminClient.mockReturnValue({
    auth: {
      admin: {
        getUserById: mockAdminGetUserById,
        updateUserById: mockAdminUpdateUserById,
        createUser: mockAdminCreateUser,
      },
    },
  })
  mockAdminGetUserById.mockResolvedValue({
    data: { user: { identities: [{ provider: 'google' }], app_metadata: { providers: ['google'] } } },
    error: null,
  })
  mockAdminUpdateUserById.mockResolvedValue({ error: null })
  mockAdminCreateUser.mockResolvedValue({ data: { user: { id: 'sb-new' } }, error: null })
  mockDbUser.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'u-x',
    ...data,
  }))
})

async function unpack(res: Response) {
  const body = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string } | string
    data?: unknown
  }
  return { status: res.status, body }
}

describe('setup-password auth gate', () => {
  it('unauthenticated user cannot access the endpoint', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error('Unauthorized'))
    const { status } = await unpack(await setupPOST(setupReq({ password: 'x'.repeat(12), confirmPassword: 'x'.repeat(12) })))
    expect(status).toBe(401)
  })

  it('user with an existing Neon password cannot use setup (must use change-password)', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce({ ...telegramUser(), password: 'already-hashed' })
    const { status, body } = await unpack(
      await setupPOST(setupReq({ password: 'brand-new-pass-1', confirmPassword: 'brand-new-pass-1' })),
    )
    expect(status).toBe(409)
    expect(typeof body.error === 'object' && body.error?.code).toBe('PASSWORD_ALREADY_SET')
    expect(mockDbUser.update).not.toHaveBeenCalled()
  })

  it('user with an existing Supabase email credential cannot use setup', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce(googleUser())
    mockAdminGetUserById.mockResolvedValueOnce({
      data: { user: { identities: [{ provider: 'email' }], app_metadata: { providers: ['email'] } } },
      error: null,
    })
    const { status } = await unpack(
      await setupPOST(setupReq({ password: 'brand-new-pass-1', confirmPassword: 'brand-new-pass-1' })),
    )
    expect(status).toBe(409)
    expect(mockAdminUpdateUserById).not.toHaveBeenCalled()
    expect(mockDbUser.update).not.toHaveBeenCalled()
  })
})

describe('setup-password validation', () => {
  beforeEach(() => {
    mockDbUser.findUnique.mockResolvedValue(telegramUser())
  })

  it('rejects weak (too short) password', async () => {
    const { status } = await unpack(await setupPOST(setupReq({ password: 'short-1', confirmPassword: 'short-1' })))
    expect(status).toBe(422)
  })

  it('rejects whitespace-only password', async () => {
    const { status } = await unpack(
      await setupPOST(setupReq({ password: ' '.repeat(12), confirmPassword: ' '.repeat(12) })),
    )
    expect(status).toBe(422)
  })

  it('rejects too-long password', async () => {
    const pw = 'a'.repeat(129)
    const { status } = await unpack(await setupPOST(setupReq({ password: pw, confirmPassword: pw })))
    expect(status).toBe(422)
  })

  it('rejects mismatched confirmation', async () => {
    const { status } = await unpack(
      await setupPOST(setupReq({ password: 'valid-pass-123', confirmPassword: 'different-456' })),
    )
    expect(status).toBe(422)
  })

  it('rejects password equal to username or email', async () => {
    const r1 = await unpack(
      await setupPOST(setupReq({ password: 'tguserXXXX', confirmPassword: 'tguserXXXX' })),
    )
    expect(r1.status).toBe(422)
    const r2 = await unpack(
      await setupPOST(
        setupReq({
          password: 'telegram_123@telegram.localA1',
          confirmPassword: 'telegram_123@telegram.localA1',
        }),
      ),
    )
    expect(r2.status).toBe(422)
  })
})

describe('setup-password success paths', () => {
  it('Google user sets password via Supabase admin, hash stored (never plaintext)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ id: 'u-2', username: 'guser', email: 'guser@mail.com' })
    mockDbUser.findUnique.mockResolvedValueOnce(googleUser())
    const plain = 'google-fallback-99'
    const { status } = await unpack(await setupPOST(setupReq({ password: plain, confirmPassword: plain })))
    expect(status).toBe(200)

    expect(mockAdminUpdateUserById).toHaveBeenCalledWith('sb-123', { password: plain })

    expect(mockDbUser.update).toHaveBeenCalledTimes(1)
    const updateData = mockDbUser.update.mock.calls[0][0].data as Record<string, unknown>
    expect(typeof updateData.password).toBe('string')
    expect(updateData.password).not.toBe(plain)
    expect(await bcrypt.compare(plain, updateData.password as string)).toBe(true)
    // OAuth methods untouched: no role / tokenVersion / OAuthAccount changes
    expect(updateData).not.toHaveProperty('role')
    expect(updateData).not.toHaveProperty('tokenVersion')

    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'password_setup', entityId: 'u-2' }),
    )
  })

  it('Telegram user without a real email is told to add one first', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce(telegramUser())
    const { status } = await unpack(
      await setupPOST(setupReq({ password: 'telegram-fallback-1', confirmPassword: 'telegram-fallback-1' })),
    )
    expect(status).toBe(422)
    expect(mockAdminCreateUser).not.toHaveBeenCalled()
    expect(mockDbUser.update).not.toHaveBeenCalled()
  })

  it('Telegram user with a real email gets a Supabase identity + linked supabaseId', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce(telegramUser())
    const plain = 'telegram-fallback-1'
    const { status } = await unpack(
      await setupPOST(
        setupReq({ password: plain, confirmPassword: plain, email: 'real-tg@mail.com' }),
      ),
    )
    expect(status).toBe(200)
    expect(mockAdminCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'real-tg@mail.com', email_confirm: true }),
    )
    const updateData = mockDbUser.update.mock.calls[0][0].data as Record<string, unknown>
    expect(updateData.supabaseId).toBe('sb-new')
    expect(await bcrypt.compare(plain, updateData.password as string)).toBe(true)
  })

  it('rejects an email already taken by another user', async () => {
    mockDbUser.findUnique
      .mockResolvedValueOnce(telegramUser())
      .mockResolvedValueOnce({ id: 'u-other' })
    const { status } = await unpack(
      await setupPOST(
        setupReq({ password: 'telegram-fallback-1', confirmPassword: 'telegram-fallback-1', email: 'taken@mail.com' }),
      ),
    )
    expect(status).toBe(422)
    expect(mockDbUser.update).not.toHaveBeenCalled()
  })
})

describe('setup-password optional fields (flexible setup / skip-able)', () => {
  it('accepts email-only setup for a Telegram user (no password)', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce(telegramUser())
    const { status } = await unpack(await setupPOST(setupReq({ email: 'real-tg@mail.com' })))
    expect(status).toBe(200)
    const updateData = mockDbUser.update.mock.calls[0][0].data as Record<string, unknown>
    expect(updateData.email).toBe('real-tg@mail.com')
    expect(updateData).not.toHaveProperty('password')
    expect(updateData).not.toHaveProperty('supabaseId')
    expect(mockAdminCreateUser).not.toHaveBeenCalled()
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'email_setup', entityId: 'u-1' }),
    )
  })

  it('rejects an empty submission (neither password nor email)', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce(telegramUser())
    const { status } = await unpack(await setupPOST(setupReq({})))
    expect(status).toBe(422)
    expect(mockDbUser.update).not.toHaveBeenCalled()
  })

  it('user with a password can still add an email (email-only, no 409)', async () => {
    mockDbUser.findUnique.mockResolvedValueOnce({
      ...telegramUser(),
      password: 'already-hashed',
    })
    const { status } = await unpack(await setupPOST(setupReq({ email: 'real-tg@mail.com' })))
    expect(status).toBe(200)
    expect(mockDbUser.update).toHaveBeenCalled()
  })
})
