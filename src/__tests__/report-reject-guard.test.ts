jest.mock('@/lib/db', () => ({
  db: {
    report: { findUnique: jest.fn(), updateMany: jest.fn() },
    reportStatusHistory: { create: jest.fn() },
  },
}))
jest.mock('@/lib/auth', () => ({ requireModerator: jest.fn() }))
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/reports/trust-score', () => ({
  recalculateTrustScore: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/reports/reporter-strike', () => ({
  checkReporterStrikes: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: jest.fn(() => ({
    sendReportRejected: { execute: jest.fn().mockResolvedValue(undefined) },
  })),
}))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST as rejectPOST } from '@/app/api/admin/reports/[id]/reject/route'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

const dbm = db as any
const params = { params: Promise.resolve({ id: 'r1' }) }
const req = { json: async () => ({ resolution: 'not valid' }) } as any

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireModerator as jest.Mock).mockResolvedValue({ id: 'mod1', username: 'mod' })
  dbm.reportStatusHistory.create.mockResolvedValue({ id: 'h1' })
})

describe('report reject transition guard', () => {
  it('rejects a terminal report before writing', async () => {
    dbm.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'confirmed',
      reporterId: 'u1',
      targetType: 'mod',
      reason: 'spam',
    })

    const res = await rejectPOST(req, params)

    expect(res.status).toBe(422)
    expect(dbm.report.updateMany).not.toHaveBeenCalled()
  })

  it('returns 409 when another moderator changed the status first', async () => {
    dbm.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'under_review',
      reporterId: 'u1',
      targetType: 'mod',
      reason: 'spam',
    })
    dbm.report.updateMany.mockResolvedValue({ count: 0 })

    const res = await rejectPOST(req, params)

    expect(res.status).toBe(409)
    expect(dbm.reportStatusHistory.create).not.toHaveBeenCalled()
  })

  it('rejects with a compare-and-set on the previously read status', async () => {
    dbm.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'under_review',
      reporterId: 'u1',
      targetType: 'mod',
      reason: 'spam',
    })
    dbm.report.updateMany.mockResolvedValue({ count: 1 })

    const res = await rejectPOST(req, params)

    expect(res.status).toBe(200)
    expect(dbm.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1', status: 'under_review' } }),
    )
  })
})
