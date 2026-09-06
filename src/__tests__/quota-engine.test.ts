/**
 * Phase 2 Task 2 — quota engine unit tests (mocked DB, no network).
 * Covers: override precedence, daily reset by date key, Arabic deny
 * reasons (per-file / daily / total), invalid input.
 */
import { BUILTIN_QUOTAS, checkUploadQuota, formatQuotaBytes, getEffectiveQuota, todayKey } from '@/lib/quota'

const GB = 1024 ** 3

const mockOverrideFind = jest.fn()
const mockPolicyFind = jest.fn()
const mockDailyFind = jest.fn()
const mockStorageFind = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    quotaOverride: { findUnique: (...a: unknown[]) => mockOverrideFind(...a) },
    quotaPolicy: { findUnique: (...a: unknown[]) => mockPolicyFind(...a) },
    uploadUsageDaily: { findUnique: (...a: unknown[]) => mockDailyFind(...a) },
    creatorStorage: { findUnique: (...a: unknown[]) => mockStorageFind(...a) },
  },
}))

beforeEach(() => {
  mockOverrideFind.mockReset().mockResolvedValue(null)
  mockPolicyFind.mockReset().mockResolvedValue(null)
  mockDailyFind.mockReset().mockResolvedValue(null)
  mockStorageFind.mockReset().mockResolvedValue(null)
})

describe('todayKey', () => {
  it('formats UTC date as YYYY-MM-DD (daily reset boundary)', () => {
    expect(todayKey(new Date('2026-09-06T23:59:59Z'))).toBe('2026-09-06')
    expect(todayKey(new Date('2026-09-07T00:00:01Z'))).toBe('2026-09-07')
  })
})

describe('formatQuotaBytes', () => {
  it('renders GB/MB/B units', () => {
    expect(formatQuotaBytes(2 * GB)).toBe('2GB')
    expect(formatQuotaBytes(20 * GB)).toBe('20GB')
    expect(formatQuotaBytes(64 * 1024 ** 2)).toBe('64MB')
  })
})

describe('getEffectiveQuota precedence', () => {
  it('falls back to builtins (creator 10/day, 2GB/file, 20GB)', async () => {
    const q = await getEffectiveQuota('u1', 'creator')
    expect(q).toEqual({ ...BUILTIN_QUOTAS.creator, source: 'builtin' })
  })

  it('policy beats builtin', async () => {
    mockPolicyFind.mockResolvedValue({
      uploadsPerDay: 30, maxFileBytes: BigInt(GB), totalBytes: BigInt(5 * GB),
    })
    const q = await getEffectiveQuota('u1', 'creator')
    expect(q.uploadsPerDay).toBe(30)
    expect(q.source).toBe('policy')
  })

  it('override beats policy; null override field inherits policy', async () => {
    mockPolicyFind.mockResolvedValue({
      uploadsPerDay: 30, maxFileBytes: BigInt(GB), totalBytes: BigInt(5 * GB),
    })
    mockOverrideFind.mockResolvedValue({
      uploadsPerDay: 100, maxFileBytes: null, totalBytes: null,
    })
    const q = await getEffectiveQuota('u1', 'creator')
    expect(q.uploadsPerDay).toBe(100)
    expect(q.maxFileBytes).toBe(GB) // inherited from policy
    expect(q.source).toBe('override')
  })
})

describe('checkUploadQuota', () => {
  it('allows a normal upload with zero usage', async () => {
    const r = await checkUploadQuota('u1', 'creator', 100 * 1024 ** 2)
    expect(r.allowed).toBe(true)
    expect(r.usedToday).toBe(0)
  })

  it('denies oversize file with Arabic reason mentioning the cap', async () => {
    const r = await checkUploadQuota('u1', 'creator', 3 * GB)
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/الحد الأقصى/)
    expect(r.reason).toMatch(/2GB/)
  })

  it('denies when daily limit reached (Arabic reason)', async () => {
    mockDailyFind.mockResolvedValue({ count: 10, bytes: BigInt(GB) })
    const r = await checkUploadQuota('u1', 'creator', 1024)
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/اليومي/)
  })

  it('counts only today — yesterday usage does not block (daily reset)', async () => {
    // findUnique queries userId+today composite; a null result = fresh day
    mockDailyFind.mockResolvedValue(null)
    const r = await checkUploadQuota('u1', 'creator', 1024)
    expect(r.allowed).toBe(true)
    expect(mockDailyFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({}) }),
    )
    const where = mockDailyFind.mock.calls[0][0].where.userId_date
    expect(where.userId).toBe('u1')
    expect(where.date).toBe(todayKey())
  })

  it('denies when total storage would overflow (Arabic reason)', async () => {
    mockStorageFind.mockResolvedValue({ totalBytes: BigInt(20 * GB) - BigInt(1024) })
    const r = await checkUploadQuota('u1', 'creator', 2048)
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/مساحتك التخزينية/)
  })

  it('denies invalid byte sizes', async () => {
    for (const bad of [0, -5, NaN]) {
      const r = await checkUploadQuota('u1', 'creator', bad)
      expect(r.allowed).toBe(false)
      expect(r.reason).toMatch(/غير صالح/)
    }
  })
})
