/**
 * Audit D.2 fail-open stacking: in-memory TTL fallback when Redis is down,
 * fail-CLOSED tv check for admin/MFA tiers on cache miss, fail-open only
 * for member pages, circuit opens after 5 Redis failures/60s → local mode
 * 5 minutes.
 */
// The repo-wide __mocks__/jose returns a fixed tv-less payload and the real
// jose is ESM-only (unparseable under this CJS jest setup) — so verify is
// overridden with a payload decoder and tokens are hand-crafted
// (header.payload.sig). Tier tests control tv/mfa/ob claims directly;
// signature crypto is jose's own responsibility, not this unit's.
jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  jwtVerify: async (token: string) => {
    const part = String(token).split('.')[1] || ''
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    return { payload, protectedHeader: { alg: 'HS256' } }
  },
}))

function tokenFor(claims: Record<string, unknown>): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`
}

const mockTvGet = jest.fn()
jest.mock('@/lib/token-version-cache', () => ({
  getTokenVersionCache: (...a: Array<never>) => mockTvGet(...a),
  setTokenVersionCache: jest.fn(),
}))

import {
  isCircuitOpen,
  resetCircuitState,
  withRedisCircuit,
} from '@/lib/redis-circuit-breaker'

// proxy.ts requires JWT_SECRET at import — set before the lazy require.
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getRoleFromCookie } = require('@/proxy') as typeof import('@/proxy')

const JWT = 'test-jwt-secret-32-chars-minimum!!'

function cookieReq(tv: number): { cookies: { get: (n: string) => { value: string } | undefined } } {
  const token = tokenFor({ userId: 'u-1', role: 'admin', tv })
  return { cookies: { get: (n: string) => (n === 'ga_admin_role' ? { value: token } : undefined) } }
}

beforeEach(() => {
  jest.clearAllMocks()
  resetCircuitState()
  mockTvGet.mockResolvedValue(null)
})

describe('circuit breaker (5 fails/60s → local 5min)', () => {
  it('opens after 5 failures and serves fallback', async () => {
    jest.useFakeTimers()
    try {
      const fail = () => Promise.reject(new Error('redis down'))
      for (let i = 0; i < 5; i++) {
        await expect(withRedisCircuit(fail, async () => 'fb')).resolves.toBe('fb')
      }
      expect(isCircuitOpen()).toBe(true)
      // open circuit: operation NOT attempted
      const op = jest.fn().mockResolvedValue('live')
      await expect(withRedisCircuit(op, async () => 'fb')).resolves.toBe('fb')
      expect(op).not.toHaveBeenCalled()
      // still open before 5 minutes
      await jest.advanceTimersByTimeAsync(4 * 60 * 1000)
      expect(isCircuitOpen()).toBe(true)
      // after 5 minutes: half-open, success closes
      await jest.advanceTimersByTimeAsync(60 * 1000 + 1)
      await expect(withRedisCircuit(op, async () => 'fb')).resolves.toBe('live')
      expect(isCircuitOpen()).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it('failures spread beyond the 60s window do not trip the breaker', async () => {
    jest.useFakeTimers()
    try {
      const fail = () => Promise.reject(new Error('x'))
      for (let i = 0; i < 4; i++) {
        await expect(withRedisCircuit(fail, async () => 'fb')).resolves.toBe('fb')
        await jest.advanceTimersByTimeAsync(61 * 1000)
      }
      expect(isCircuitOpen()).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('tiered tv verification', () => {
  it('admin tier (strict): cache miss with tv present → NOT verified', async () => {
    const payload = await getRoleFromCookie(cookieReq(3) as never, { strictTv: true })
    expect(payload?.tvVerified).toBe(false)
  })

  it('member tier (default): identical miss → verified (fail-open preserved)', async () => {
    const payload = await getRoleFromCookie(cookieReq(3) as never)
    expect(payload?.tvVerified).toBe(true)
  })

  it('confirmed mismatch still rejects in both tiers', async () => {
    mockTvGet.mockResolvedValue(99)
    expect(await getRoleFromCookie(cookieReq(3) as never, { strictTv: true })).toBeNull()
    expect(await getRoleFromCookie(cookieReq(3) as never)).toBeNull()
  })
})
