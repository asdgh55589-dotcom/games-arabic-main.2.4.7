/**
 * Phase 3 — P2024 detection + Sentry alerting inside withRetry.
 */
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
const mockReportError = jest.fn()
jest.mock('@/lib/error-reporting', () => ({ reportError: (...a: unknown[]) => mockReportError(...a) }))

import { isPoolExhaustedError, withRetry } from '@/lib/db'

const noSleep = { sleepFn: jest.fn().mockResolvedValue(undefined) }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('isPoolExhaustedError', () => {
  it('detects Prisma P2024 by code', () => {
    expect(isPoolExhaustedError({ code: 'P2024' })).toBe(true)
  })

  it('detects pool timeout by message', () => {
    expect(
      isPoolExhaustedError(new Error('Timed out fetching a new connection from the connection pool')),
    ).toBe(true)
  })

  it('ignores unrelated errors and non-objects', () => {
    expect(isPoolExhaustedError(new Error('P1001 unreachable'))).toBe(false)
    expect(isPoolExhaustedError(null)).toBe(false)
    expect(isPoolExhaustedError('P2024')).toBe(false)
  })
})

describe('withRetry P2024 alerting', () => {
  it('reports pool exhaustion to Sentry on every attempt, then rethrows', async () => {
    const p2024 = Object.assign(new Error('pool timeout P2024'), { code: 'P2024' })
    const fn = jest.fn().mockRejectedValue(p2024)
    await expect(withRetry(fn, { maxAttempts: 2, ...noSleep })).rejects.toBe(p2024)
    expect(mockReportError).toHaveBeenCalledTimes(2)
    expect(mockReportError.mock.calls[0][1]).toMatchObject({ route: 'db-pool' })
  })

  it('does not report non-pool errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('plain failure'))
    await expect(withRetry(fn, { maxAttempts: 2, ...noSleep })).rejects.toThrow('plain failure')
    expect(mockReportError).not.toHaveBeenCalled()
  })
})
