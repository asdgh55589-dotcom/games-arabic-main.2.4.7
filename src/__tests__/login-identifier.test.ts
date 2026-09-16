/**
 * POST /api/auth/login-identifier — username-or-email + password login.
 *
 * RED phase — the route does not exist yet.
 *
 * Contract:
 * - generic 401 for unknown identifier / missing hash / wrong password
 *   (identical bodies → no enumeration, incl. username vs email paths)
 * - banned users get 403 (same as staff login)
 * - success issues role cookie + ledger cookie, bumps login counters,
 *   never returns the password hash
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

const mockCompare = jest.fn()
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: (...a: Array<never>) => mockCompare(...a) },
  compare: (...a: Array<never>) => mockCompare(...a),
}))

const mockDbUser = { findUnique: jest.fn(), update: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: { user: mockDbUser },
}))

const mockSetRoleCookie = jest.fn()
jest.mock('@/lib/auth', () => ({
  setRoleCookie: (...a: Array<never>) => mockSetRoleCookie(...a),
  getBanStatus: jest.requireActual('@/lib/auth').getBanStatus,
}))

const mockLogAction = jest.fn()
jest.mock('@/lib/audit', () => ({ logAction: (...a: Array<never>) => mockLogAction(...a) }))

const mockCreateLedger = jest.fn()
jest.mock('@/lib/session-ledger', () => ({
  createSessionLedger: (...a: Array<never>) => mockCreateLedger(...a),
}))

import { POST as identifierPOST } from '@/app/api/auth/login-identifier/route'
import type { NextResponse } from 'next/server'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ipCounter = 200
function idReq(body: unknown) {
  ipCounter += 1
  return new NextRequest('http://x/api/auth/login-identifier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.99.0.${ipCounter}` },
    body: JSON.stringify(body),
  })
}

function memberUser() {
  return {
    id: 'u-7',
    username: 'tguser',
    email: 'real-tg@mail.com',
    password: 'neon-bcrypt-hash',
    role: 'member',
    avatarUrl: null,
    tokenVersion: 3,
    onboardingCompleted: true,
    banStatus: 'active',
    bannedUntil: null,
    banReason: null,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCompare.mockResolvedValue(false)
  // Route looks up by email when identifier contains '@', else by username.
  mockDbUser.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
    const u = memberUser()
    if (where.email) return where.email === u.email ? u : null
    if (where.username) return where.username === u.username ? u : null
    return null
  })
  mockDbUser.update.mockResolvedValue(memberUser())
  mockCreateLedger.mockResolvedValue({
    token: 'led-tok-1',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  })
})

async function unpack(res: NextResponse) {
  const body = (await res.json().catch(() => ({}))) as { error?: string; data?: unknown }
  return { status: res.status, body, res }
}

describe('login-identifier (no enumeration)', () => {
  it('unknown username, hash-less user, and wrong password share one generic 401', async () => {
    const bodies: unknown[] = []

    // 1. unknown username
    mockDbUser.findUnique.mockResolvedValueOnce(null)
    bodies.push((await unpack(await identifierPOST(idReq({ identifier: 'ghost', password: 'x'.repeat(12) })))).body)

    // 2. user without a password hash
    mockDbUser.findUnique.mockResolvedValueOnce({ ...memberUser(), password: null })
    bodies.push(
      (await unpack(await identifierPOST(idReq({ identifier: 'tguser', password: 'x'.repeat(12) })))).body,
    )

    // 3. wrong password (bcrypt mocked false)
    bodies.push(
      (await unpack(await identifierPOST(idReq({ identifier: 'tguser', password: 'x'.repeat(12) })))).body,
    )

    const statuses = bodies.map(() => 401)
    expect(statuses).toEqual([401, 401, 401])
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1)
    expect(JSON.stringify(bodies[0])).toContain('بيانات الدخول غير صحيحة')
    expect(mockCompare).toHaveBeenCalledTimes(1) // only case 3 reaches bcrypt
  })

  it('banned users get 403', async () => {
    mockCompare.mockResolvedValueOnce(true)
    mockDbUser.findUnique.mockResolvedValueOnce({ ...memberUser(), banStatus: 'banned_perm' })
    const { status } = await unpack(
      await identifierPOST(idReq({ identifier: 'tguser', password: 'x'.repeat(12) })),
    )
    expect(status).toBe(403)
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
  })
})

describe('login-identifier success', () => {
  it('username + password issues session without leaking the hash', async () => {
    mockCompare.mockResolvedValueOnce(true)
    const { status, body, res } = await unpack(
      await identifierPOST(idReq({ identifier: 'tguser', password: 'correct-horse-1' })),
    )
    expect(status).toBe(200)
    expect(mockSetRoleCookie).toHaveBeenCalledWith('u-7', 'member', 3, false, true)
    expect(mockCreateLedger).toHaveBeenCalledWith('u-7', expect.objectContaining({ ip: expect.any(String) }))
    expect(JSON.stringify(body)).not.toContain('neon-bcrypt-hash')
    expect((body.data as { user: { username: string } }).user.username).toBe('tguser')
    // Ledger cookie set on the response
    expect(res.cookies.get('ga_session_ledger')?.value).toBe('led-tok-1')
    expect(mockLogAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'login' }))
  })

  it('email + password works through the same endpoint', async () => {
    mockCompare.mockResolvedValueOnce(true)
    const { status, body } = await unpack(
      await identifierPOST(idReq({ identifier: 'real-tg@mail.com', password: 'correct-horse-1' })),
    )
    expect(status).toBe(200)
    expect((body.data as { user: { id: string } }).user.id).toBe('u-7')
  })

  it('ignores smuggled role upgrades (role comes from DB, never the body)', async () => {
    mockCompare.mockResolvedValueOnce(true)
    const { status } = await unpack(
      await identifierPOST(
        idReq({ identifier: 'tguser', password: 'correct-horse-1', role: 'admin' }),
      ),
    )
    expect(status).toBe(200)
    expect(mockSetRoleCookie).toHaveBeenCalledWith('u-7', 'member', 3, false, true)
  })
})
