/**
 * P1: distributed login failure counters.
 *
 * Counters must live in the shared store layer (Redis via @/lib/redis),
 * never in module-local memory — so they survive process restarts and
 * are shared across instances.
 *
 * These tests pin the contract:
 * - key format: auth:fail:<sha256 hex> (no raw IP / username in the key)
 * - TTL passed to the store (15-minute window)
 * - record/get/clear roundtrip through the store layer
 * - state survives a module "restart" (resetModules + re-require)
 */

const mockStore = new Map<string, { value: string; expires: number }>()

jest.mock('@/lib/redis', () => ({
  redisIncr: jest.fn(async (key: string, ttlSeconds: number) => {
    const now = Date.now()
    const entry = mockStore.get(key)
    if (!entry || entry.expires < now) {
      mockStore.set(key, { value: '1', expires: now + ttlSeconds * 1000 })
      return 1
    }
    const count = parseInt(entry.value, 10) + 1
    entry.value = count.toString()
    mockStore.set(key, entry)
    return count
  }),
  redisGet: jest.fn(async (key: string) => {
    const entry = mockStore.get(key)
    if (!entry || entry.expires < Date.now()) return null
    try {
      return JSON.parse(entry.value) as unknown
    } catch {
      return null
    }
  }),
  redisDel: jest.fn(async (key: string) => {
    mockStore.delete(key)
  }),
}))

import { redisDel, redisGet, redisIncr } from '@/lib/redis'

describe('distributed failure counters', () => {
  beforeEach(() => {
    mockStore.clear()
    jest.clearAllMocks()
  })

  it('record/get/clear roundtrip goes through the shared store', async () => {
    const { recordLoginFailure, getLoginFailures, clearLoginFailures } =
      await import('@/lib/login-defense')
    const k = 'restart-proof-key-' + Date.now()

    expect(await getLoginFailures(k)).toBe(0)
    await recordLoginFailure(k)
    await recordLoginFailure(k)
    expect(await getLoginFailures(k)).toBe(2)
    expect(redisIncr).toHaveBeenCalled()
    expect(redisGet).toHaveBeenCalled()

    await clearLoginFailures(k)
    expect(await getLoginFailures(k)).toBe(0)
    expect(redisDel).toHaveBeenCalled()
  })

  it('store keys are namespaced and hashed (no raw identifier leaks)', async () => {
    const { recordLoginFailure, failureKey } = await import('@/lib/login-defense')
    const raw = failureKey('9.9.9.9', 'SomeUser')
    await recordLoginFailure(raw)

    const usedKey = (redisIncr as jest.Mock).mock.calls[0][0] as string
    expect(usedKey.startsWith('auth:fail:')).toBe(true)
    expect(usedKey).not.toContain('9.9.9.9')
    expect(usedKey).not.toContain('SomeUser')
    expect(usedKey).not.toContain('someuser')
  })

  it('failures expire after the 15-minute window', async () => {
    const { recordLoginFailure } = await import('@/lib/login-defense')
    await recordLoginFailure('ttl-key')
    const [, ttl] = (redisIncr as jest.Mock).mock.calls[0] as [string, number]
    expect(ttl).toBe(15 * 60)
  })

  it('counters survive a process restart (fresh module, same store)', async () => {
    const first = await import('@/lib/login-defense')
    await first.recordLoginFailure('persist-key')
    await first.recordLoginFailure('persist-key')
    expect(await first.getLoginFailures('persist-key')).toBe(2)

    // Simulate a restart: drop the module registry, keep the store.
    jest.resetModules()
    const second = await import('@/lib/login-defense')
    expect(await second.getLoginFailures('persist-key')).toBe(2)
  })

  it('failureKey normalizes identifiers (trim + lowercase username)', async () => {
    const { failureKey } = await import('@/lib/login-defense')
    expect(failureKey(' 1.2.3.4 ', '  Boss ')).toBe(failureKey('1.2.3.4', 'boss'))
  })
})
