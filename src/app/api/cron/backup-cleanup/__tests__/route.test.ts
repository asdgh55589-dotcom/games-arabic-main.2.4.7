/**
 * اختبارات /api/cron/backup-cleanup — عقد تحرير النافذة (متابعة PR#22).
 *
 * 1) نجاح التنظيف → completeRun(jobId) ولا failRun.
 * 2) رمي cleanupOldBackups → 500 + failRun(jobId) (تحرير نافذة اليوم).
 * 3) مطالبة مكررة → skipped بلا تنفيذ.
 */

jest.mock('@/lib/cron-auth', () => ({ requireCronAuth: jest.fn().mockResolvedValue(null) }))

jest.mock('@/lib/cron-ledger', () => ({
  claimRun: jest.fn(),
  completeRun: jest.fn().mockResolvedValue(undefined),
  failRun: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/backup', () => ({ cleanupOldBackups: jest.fn() }))

import { NextRequest } from 'next/server'
import { cleanupOldBackups } from '@/lib/backup'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { GET } from '../route'

const mockAuth = requireCronAuth as jest.Mock
const mockClaim = claimRun as jest.Mock
const mockComplete = completeRun as jest.Mock
const mockFail = failRun as jest.Mock
const mockCleanup = cleanupOldBackups as jest.Mock

const makeReq = () => new NextRequest('http://localhost/api/cron/backup-cleanup')

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue(null)
  mockClaim.mockResolvedValue({ alreadyRan: false, jobId: 'job-c1' })
  mockCleanup.mockResolvedValue(3)
})

describe('cron/backup-cleanup — عقد تحرير النافذة', () => {
  it('نجاح التنظيف → completeRun ولا failRun', async () => {
    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.deleted).toBe(3)
    expect(mockClaim).toHaveBeenCalledWith(
      'backup-cleanup',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    )
    expect(mockComplete).toHaveBeenCalledWith('job-c1')
    expect(mockFail).not.toHaveBeenCalled()
  })

  it('فشل التنظيف → 500 + failRun بنفس jobId (النافذة لا تُحجب)', async () => {
    mockCleanup.mockRejectedValue(new Error('disk gone'))

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBeTruthy()
    expect(mockFail).toHaveBeenCalledWith('job-c1', expect.any(Error))
    expect(mockComplete).not.toHaveBeenCalled()
  })

  it('مطالبة مكررة → skipped بلا تنفيذ ولا إغلاق سجل', async () => {
    mockClaim.mockResolvedValue({ alreadyRan: true, jobId: null })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipped).toBe('duplicate')
    expect(mockCleanup).not.toHaveBeenCalled()
    expect(mockComplete).not.toHaveBeenCalled()
    expect(mockFail).not.toHaveBeenCalled()
  })
})
