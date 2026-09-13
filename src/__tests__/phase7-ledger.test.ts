/**
 * phase7-ledger.test.ts — Tests for cron-ledger idempotency layer
 */

const mockScheduledJob = {
  upsert: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
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
    mockScheduledJob.upsert.mockResolvedValue({
      id: 'job-1',
      status: 'running',
    })

    const result = await claimRun('daily_cleanup', '2026-09-13')

    expect(result.alreadyRan).toBe(false)
    expect(result.jobId).toBe('job-1')
    expect(mockScheduledJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type_windowKey: { type: 'daily_cleanup', windowKey: '2026-09-13' } },
        create: expect.objectContaining({ type: 'daily_cleanup', windowKey: '2026-09-13', status: 'running' }),
        update: expect.objectContaining({ status: 'running' }),
      }),
    )
  })

  it('duplicate returns { alreadyRan: true } when status is completed', async () => {
    mockScheduledJob.upsert.mockResolvedValue({
      id: 'job-existing',
      status: 'completed',
    })

    const result = await claimRun('daily_cleanup', '2026-09-13')

    expect(result.alreadyRan).toBe(true)
    expect(result.jobId).toBeNull()
  })

  it('handles unique constraint violation as duplicate', async () => {
    mockScheduledJob.upsert.mockRejectedValue({ code: 'P2002' })

    const result = await claimRun('daily_cleanup', '2026-09-13')

    expect(result.alreadyRan).toBe(true)
    expect(result.jobId).toBeNull()
  })

  it('propagates unexpected errors', async () => {
    mockScheduledJob.upsert.mockRejectedValue(new Error('connection refused'))

    await expect(claimRun('daily_cleanup', '2026-09-13')).rejects.toThrow('connection refused')
  })

  it('treats null windowKey as empty string in upsert', async () => {
    mockScheduledJob.upsert.mockResolvedValue({ id: 'job-2', status: 'running' })

    const result = await claimRun('backup', null)

    expect(result.alreadyRan).toBe(false)
    expect(mockScheduledJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type_windowKey: { type: 'backup', windowKey: '' } },
      }),
    )
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
