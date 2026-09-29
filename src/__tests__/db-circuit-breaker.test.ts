/**
 * Phase 3 — DbCircuitBreaker: CLOSED → OPEN → HALF_OPEN → CLOSED transitions,
 * fail-open (non-critical) vs fail-closed (critical).
 */
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

import { DbCircuitBreaker } from '@/lib/observability/db-circuit-breaker'

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('DbCircuitBreaker', () => {
  it('passes operations through while CLOSED', async () => {
    const cb = new DbCircuitBreaker(3, 1000)
    await expect(cb.execute(async () => 'ok')).resolves.toBe('ok')
    expect(cb.getState()).toEqual({ state: 'CLOSED', failureCount: 0 })
  })

  it('opens after threshold consecutive failures, fail-open returns null', async () => {
    const cb = new DbCircuitBreaker(2, 10_000)
    const boom = async (): Promise<string> => {
      throw new Error('db down')
    }
    await expect(cb.execute(boom)).resolves.toBeNull()
    expect(cb.getState().state).toBe('CLOSED')
    await expect(cb.execute(boom)).resolves.toBeNull()
    expect(cb.getState()).toEqual({ state: 'OPEN', failureCount: 2 })
    // OPEN rejects without running the operation
    const spy = jest.fn(async () => 'never')
    await expect(cb.execute(spy)).resolves.toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('fail-closed: critical operations throw while OPEN', async () => {
    const cb = new DbCircuitBreaker(1, 10_000)
    await expect(
      cb.execute(async () => {
        throw new Error('db down')
      }),
    ).resolves.toBeNull()
    expect(cb.getState().state).toBe('OPEN')
    // OPEN short-circuits: the operation never runs, critical callers get the breaker error
    const spy = jest.fn(async () => 'never runs')
    await expect(cb.execute(spy, true)).rejects.toThrow('DB circuit breaker open')
    expect(spy).not.toHaveBeenCalled()
  })

  it('half-opens after cooldown and closes on success', async () => {
    const cb = new DbCircuitBreaker(1, 30)
    await cb.execute(async () => {
      throw new Error('db down')
    })
    expect(cb.getState().state).toBe('OPEN')
    await tick(50)
    await expect(cb.execute(async () => 'recovered')).resolves.toBe('recovered')
    expect(cb.getState()).toEqual({ state: 'CLOSED', failureCount: 0 })
  })

  it('success resets the consecutive failure count', async () => {
    const cb = new DbCircuitBreaker(3, 1000)
    await cb.execute(async () => {
      throw new Error('flaky')
    })
    await cb.execute(async () => 'ok')
    expect(cb.getState()).toEqual({ state: 'CLOSED', failureCount: 0 })
  })
})
