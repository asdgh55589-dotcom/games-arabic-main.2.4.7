/**
 * phase7-ledger.test.ts — Tests for cron-ledger idempotency layer
 */

const mockScheduledJob = {
  create: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
}

jest.mock('@/lib/db', () => ({
  db: { scheduledJob: mockScheduledJob },
}))

let claimRun: typeof import('@/lib/cron-ledger').claimRun
let completeRun: typeof import('@/lib/cron-ledger').completeRun
let failRun: typeof import('@/lib/cron-ledger').failRun
let needsCatchUp: typeof import('@/lib/cron-ledger').needsCatchUp
let windowKeyFor: typeof import('@/lib/cron-ledger').windowKeyFor

beforeAll(async () => {
  const ledger = await import('@/lib/cron-ledger')
  claimRun = ledger.claimRun
  completeRun = ledger.completeRun
  failRun = ledger.failRun
  needsCatchUp = ledger.needsCatchUp
  windowKeyFor = ledger.windowKeyFor
})

beforeEach(() => {
  jest.clearAllMocks()
})

// ── claimRun ──────────────────────────────────────────────

describe('claimRun', () => {
  it('first call returns { alreadyRan: false, jobId }', async () => {
    mockScheduledJob.findFirst
      .mockResolvedValueOnce(null) // no completed
      .mockResolvedValueOnce(null) // no pending
    mockScheduledJob.create.mockResolvedValue({
      id: 'job-1',
      status: 'running',
    })

    const result = await claimRun('daily_cleanup', '2026-09-13')

    expect(result.alreadyRan).toBe(false)
    expect(result.jobId).toBe('job-1')
    expect(mockScheduledJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'daily_cleanup',
          windowKey: '2026-09-13',
          status: 'running',
        }),
      }),
    )
  })

  it('duplicate returns { alreadyRan: true } when completed exists', async () => {
    mockScheduledJob.findFirst.mockResolvedValueOnce({
      id: 'job-existing',
      status: 'completed',
    })

    const result = await claimRun('daily_cleanup', '2026-09-13')

    expect(result.alreadyRan).toBe(true)
    expect(result.jobId).toBeNull()
    // فحص «المكتمل» مقيّد بالنافذة نفسها — لا يحجب نوافذ أخرى.
    expect(mockScheduledJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'daily_cleanup',
          windowKey: '2026-09-13',
          status: 'completed',
        }),
      }),
    )
    expect(mockScheduledJob.create).not.toHaveBeenCalled()
  })

  it('a completed row in another window does not block this window', async () => {
    // لا مكتمل ولا جارٍ لنافذة B → تُمنح المطالبة بمفتاح B مكتوباً.
    mockScheduledJob.findFirst
      .mockResolvedValueOnce(null) // no completed in window B
      .mockResolvedValueOnce(null) // no in-progress in window B
    mockScheduledJob.create.mockResolvedValue({ id: 'job-b', status: 'running' })

    const result = await claimRun('daily_cleanup', '2026-09-14')

    expect(result.alreadyRan).toBe(false)
    expect(result.jobId).toBe('job-b')
    expect(mockScheduledJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'daily_cleanup', windowKey: '2026-09-14' }),
      }),
    )
  })

  it('handles unique constraint violation as duplicate', async () => {
    mockScheduledJob.findFirst.mockResolvedValueOnce(null) // no completed
    mockScheduledJob.findFirst.mockResolvedValueOnce(null) // no pending
    mockScheduledJob.create.mockRejectedValue({ code: 'P2002' })

    const result = await claimRun('daily_cleanup', '2026-09-13')

    expect(result.alreadyRan).toBe(true)
    expect(result.jobId).toBeNull()
  })

  it('propagates unexpected errors', async () => {
    mockScheduledJob.findFirst.mockResolvedValueOnce(null)
    mockScheduledJob.findFirst.mockResolvedValueOnce(null)
    mockScheduledJob.create.mockRejectedValue(new Error('connection refused'))

    await expect(claimRun('daily_cleanup', '2026-09-13')).rejects.toThrow('connection refused')
  })

  it('treats an in-progress row in the same window as a duplicate', async () => {
    mockScheduledJob.findFirst.mockResolvedValueOnce(null) // no completed
    mockScheduledJob.findFirst.mockResolvedValueOnce({ id: 'running-1', status: 'running' }) // concurrent tick

    const result = await claimRun('social-publish:2026-10-15T14:00', '2026-10-15T14:00')

    // tick ثانٍ في الدقيقة نفسها يُتخطى — لا ينضم ليفريغ بالتوازي.
    expect(result.alreadyRan).toBe(true)
    expect(result.jobId).toBeNull()
    expect(mockScheduledJob.create).not.toHaveBeenCalled()
  })

  it('reaps same-window FAILED rows before claiming so the tick retries', async () => {
    mockScheduledJob.findFirst
      .mockResolvedValueOnce(null) // no completed
      .mockResolvedValueOnce(null) // no live in-progress
    mockScheduledJob.deleteMany.mockResolvedValueOnce({ count: 1 })
    mockScheduledJob.create.mockResolvedValue({ id: 'job-retry', status: 'running' })

    const result = await claimRun('weekly-backup', '2026-W42')

    expect(result.alreadyRan).toBe(false)
    expect(result.jobId).toBe('job-retry')
    // الإزاحة تشمل الفاشلة في النطاق نفسه — وإلا اصطدم الإنشاء بالقيد الفريد.
    expect(mockScheduledJob.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'weekly-backup',
          windowKey: '2026-W42',
          OR: expect.arrayContaining([expect.objectContaining({ status: 'failed' })]),
        }),
      }),
    )
    expect(mockScheduledJob.create).toHaveBeenCalled()
  })

  it('reaps stale running rows past the claim lease but keeps live ones', async () => {
    mockScheduledJob.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mockScheduledJob.deleteMany.mockResolvedValueOnce({ count: 1 })
    mockScheduledJob.create.mockResolvedValue({ id: 'job-fresh', status: 'running' })

    const before = Date.now()
    const result = await claimRun('backup-cleanup', '2026-10-15')

    expect(result.alreadyRan).toBe(false)
    const reapArg = mockScheduledJob.deleteMany.mock.calls[0][0]
    const orClauses = reapArg.where.OR as Array<Record<string, unknown>>
    const staleClause = orClauses.find(
      (c) => (c.status as Record<string, unknown>)?.in !== undefined,
    ) as { createdAt: { lt: Date } }
    // حد العقد ≈ 30 دقيقة خلت — يثبّت CLAIM_LEASE_MS ضد الانزلاق.
    const cutoff = staleClause.createdAt.lt.getTime()
    expect(cutoff).toBeLessThanOrEqual(before - 30 * 60_000 + 5_000)
    expect(cutoff).toBeGreaterThanOrEqual(before - 30 * 60_000 - 5_000)
  })
})

// ── completeRun / failRun ─────────────────────────────────

describe('completeRun', () => {
  it('updates status to completed with executedAt', async () => {
    mockScheduledJob.update.mockResolvedValue({})

    await completeRun('job-1')

    expect(mockScheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'completed', executedAt: expect.any(Date) },
    })
  })
})

describe('failRun', () => {
  it('updates status to failed with error message', async () => {
    mockScheduledJob.update.mockResolvedValue({})

    await failRun('job-2', new Error('timeout'))

    expect(mockScheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-2' },
      data: { status: 'failed', error: 'timeout' },
    })
  })

  it('stringifies non-Error values', async () => {
    mockScheduledJob.update.mockResolvedValue({})

    await failRun('job-3', 'string error')

    expect(mockScheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-3' },
      data: { status: 'failed', error: 'string error' },
    })
  })
})

// ── needsCatchUp ──────────────────────────────────────────

describe('needsCatchUp', () => {
  it('returns true when no completed runs exist', async () => {
    mockScheduledJob.findFirst.mockResolvedValue(null)

    const result = await needsCatchUp('daily_cleanup', 60_000)

    expect(result).toBe(true)
  })

  it('returns false when last run is within 2× interval', async () => {
    mockScheduledJob.findFirst.mockResolvedValue({
      executedAt: new Date(Date.now() - 30_000), // 30s ago, interval=60s → 2×=120s
    })

    const result = await needsCatchUp('daily_cleanup', 60_000)

    expect(result).toBe(false)
  })

  it('returns true when last run is older than 2× interval', async () => {
    mockScheduledJob.findFirst.mockResolvedValue({
      executedAt: new Date(Date.now() - 200_000), // 200s ago, interval=60s → 2×=120s
    })

    const result = await needsCatchUp('daily_cleanup', 60_000)

    expect(result).toBe(true)
  })
})

// ── windowKeyFor ──────────────────────────────────────────

describe('windowKeyFor', () => {
  it('daily produces YYYY-MM-DD', () => {
    const key = windowKeyFor('daily', new Date(2026, 8, 13)) // Sep 13 2026
    expect(key).toBe('2026-09-13')
  })

  it('weekly produces YYYY-Www', () => {
    const key = windowKeyFor('weekly', new Date(2026, 8, 13))
    expect(key).toMatch(/^2026-W\d{2}$/)
  })

  it('monthly produces YYYY-MM', () => {
    const key = windowKeyFor('monthly', new Date(2026, 8, 13))
    expect(key).toBe('2026-09')
  })

  it('uses current date when now is omitted', () => {
    const key = windowKeyFor('daily')
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(key).toBe(expected)
  })

  it('pads single-digit months and days', () => {
    const key = windowKeyFor('daily', new Date(2026, 0, 5)) // Jan 5
    expect(key).toBe('2026-01-05')
  })

  it('monthly pads single-digit months', () => {
    const key = windowKeyFor('monthly', new Date(2026, 0, 15)) // Jan
    expect(key).toBe('2026-01')
  })
})
