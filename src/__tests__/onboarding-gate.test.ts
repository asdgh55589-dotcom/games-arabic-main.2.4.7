/**
 * Tests for the onboarding gate (D.6-a).
 *
 * Edge middleware cannot read the DB, so login flows stamp an `ob`
 * (onboarded) boolean claim into ga_admin_role; the proxy funnels
 * member&&!ob traffic to /onboarding. Missing claim = fail-open (legacy
 * cookies keep working); server-side DB flag remains source of truth.
 */

process.env.JWT_SECRET = 'test-secret-key-for-jest'

const mockCookieSet = jest.fn()
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ set: mockCookieSet, get: jest.fn() })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockSupabaseGetUser = jest.fn()
const mockDbFindFirst = jest.fn()

// NOTE: requireOnboarded → requireAuth → getSession live in one module, so
// same-module mocking can't intercept getSession. Mock the layer below
// (Supabase client + db), mirroring auth-require-admin.test.ts.
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/token-version-cache', () => ({
  setTokenVersionCache: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: { user: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) } },
}))

import { SignJWT } from 'jose'
import { AuthError, requireOnboarded, setRoleCookie } from '@/lib/auth'
import { getOnboardingGate } from '@/lib/onboarding'

describe('getOnboardingGate', () => {
  it('redirects non-onboarded members on pages', () => {
    expect(getOnboardingGate('member', false, '/')).toBe('redirect')
    expect(getOnboardingGate('member', false, '/mods/some-mod')).toBe('redirect')
    expect(getOnboardingGate('member', false, '/become-creator')).toBe('redirect')
  })

  it('returns json-gate (not redirect) for API paths', () => {
    expect(getOnboardingGate('member', false, '/api/mods')).toBe('json')
    expect(getOnboardingGate('member', false, '/api/creator/mods')).toBe('json')
  })

  it('allows onboarded members everywhere', () => {
    expect(getOnboardingGate('member', true, '/')).toBe('allow')
    expect(getOnboardingGate('member', true, '/api/mods')).toBe('allow')
  })

  it('fail-open: missing claim (legacy cookies) is allowed', () => {
    expect(getOnboardingGate('member', undefined, '/')).toBe('allow')
    expect(getOnboardingGate('member', undefined, '/api/mods')).toBe('allow')
  })

  it('staff roles skip the gate even when not onboarded', () => {
    for (const role of ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']) {
      expect(getOnboardingGate(role, false, '/')).toBe('allow')
    }
  })

  it('allows the onboarding funnel itself', () => {
    expect(getOnboardingGate('member', false, '/onboarding')).toBe('allow')
    expect(getOnboardingGate('member', false, '/login')).toBe('allow')
    expect(getOnboardingGate('member', false, '/verify-email')).toBe('allow')
  })

  it('allows auth/session/link endpoints needed to finish onboarding', () => {
    const allowed = [
      '/api/auth/me',
      '/api/auth/callback',
      '/api/auth/logout',
      '/api/auth/session-ledger',
      '/api/auth/register-ledger',
      '/api/auth/ledger-check',
      '/api/auth/telegram',
      '/api/auth/telegram/poll?token=abc',
      '/api/auth/telegram-bridge',
      '/api/auth/onboarding',
      '/api/auth/recover',
      '/api/auth/reset-password',
      '/api/auth/send-verification-email',
      '/api/settings/link-account',
      '/api/settings/unlink-account',
      '/api/settings/linked-accounts',
      '/api/users/someone/link-telegram',
    ]
    for (const path of allowed) {
      expect(getOnboardingGate('member', false, path)).toBe('allow')
    }
  })
})

describe('requireOnboarded (server source of truth)', () => {
  const neonUser = (completed: boolean, role = 'member') => ({
    id: 'u1',
    username: 'u',
    email: 'u@x.com',
    role,
    avatarUrl: null,
    banStatus: 'active',
    bannedUntil: null,
    banReason: null,
    tokenVersion: 0,
    onboardingCompleted: completed,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
    mockCreateClient.mockResolvedValue({
      auth: { getUser: mockSupabaseGetUser },
    } as never)
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: 'supa-u1', email: 'u@x.com' } },
    })
  })

  it('returns the user when onboarding is complete', async () => {
    mockDbFindFirst.mockResolvedValue(neonUser(true))
    await expect(requireOnboarded()).resolves.toMatchObject({ id: 'u1' })
  })

  it('throws 403 for incomplete members', async () => {
    mockDbFindFirst.mockResolvedValue(neonUser(false))
    const err = await requireOnboarded().catch((e) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.status).toBe(403)
  })

  it('skips non-member roles even when incomplete', async () => {
    mockDbFindFirst.mockResolvedValue(neonUser(false, 'moderator'))
    await expect(requireOnboarded()).resolves.toMatchObject({ role: 'moderator' })
  })

  it('throws 401 when unauthenticated', async () => {
    mockSupabaseGetUser.mockResolvedValue({ data: { user: null } })
    const err = await requireOnboarded().catch((e) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.status).toBe(401)
  })
})
describe('setRoleCookie ob claim', () => {
  // NOTE: root __mocks__/jose.js auto-mocks jose (ESM-only, unparsable under
  // ts-jest CJS), so instead of verifying a real JWT we assert the exact
  // payload object our code hands to SignJWT.
  const MockSignJWT = SignJWT as unknown as jest.Mock

  beforeEach(() => {
    mockCookieSet.mockClear()
    MockSignJWT.mockClear()
  })

  it('stamps ob=false for non-onboarded users', async () => {
    await setRoleCookie('user-1', 'member' as never, 0, false, false)

    expect(MockSignJWT).toHaveBeenCalledTimes(1)
    expect(MockSignJWT).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'member',
      tv: 0,
      ob: false,
    })
    expect(mockCookieSet).toHaveBeenCalledTimes(1)
  })

  it('stamps ob=true for onboarded users', async () => {
    await setRoleCookie('user-1', 'member' as never, 0, false, true)

    expect(MockSignJWT).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', ob: true }),
    )
  })

  it('defaults to onboarded (fail-open for callers that do not pass the flag)', async () => {
    await setRoleCookie('user-1', 'member' as never, 0)

    expect(MockSignJWT).toHaveBeenCalledWith(expect.objectContaining({ ob: true }))
  })
})
