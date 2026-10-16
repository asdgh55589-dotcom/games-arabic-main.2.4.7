/**
 * اختبارات /api/cron/weekly-backup — عقد تحرير النافذة (متابعة PR#22).
 *
 * 1) نجاح النسخ → completeRun(jobId) ولا failRun.
 * 2) فشل pg_dump → 500 + failRun(jobId) (تحرير النافذة للأسبوع نفسه).
 * 3) مطالبة مكررة → skipped بلا تنفيذ.
 */

jest.mock('@/lib/cron-auth', () => ({ requireCronAuth: jest.fn().mockResolvedValue(null) }))

jest.mock('@/lib/cron-ledger', () => ({
  claimRun: jest.fn(),
  completeRun: jest.fn().mockResolvedValue(undefined),
  failRun: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn().mockReturnValue('x') }))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('child_process', () => ({ exec: jest.fn() }))

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  statSync: jest.fn(),
  writeFileSync: jest.fn(),
}))

import { exec } from 'child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { NextRequest } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { GET } from '../route'

const mockAuth = requireCronAuth as jest.Mock
const mockClaim = claimRun as jest.Mock
const mockComplete = completeRun as jest.Mock
const mockFail = failRun as jest.Mock
const mockExec = exec as unknown as jest.Mock
const mockExists = existsSync as jest.Mock
const mockStat = statSync as jest.Mock
const mockRead = readFileSync as jest.Mock
const mockWrite = writeFileSync as jest.Mock

const makeReq = () => new NextRequest('http://localhost/api/cron/weekly-backup')

const OLD_ENV = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, DATABASE_URL: 'postgres://test/test' }
  delete process.env.BACKUP_S3_ENDPOINT
  mockAuth.mockResolvedValue(null)
  mockClaim.mockResolvedValue({ alreadyRan: false, jobId: 'job-w1' })
  mockExists.mockReturnValue(true)
  mockStat.mockReturnValue({ size: 123 })
  mockRead.mockReturnValue(Buffer.from('dump'))
  mockExec.mockImplementation(
    (_cmd: unknown, _opts: unknown, cb: (e: unknown, out: unknown) => void) =>
      cb(null, { stdout: '', stderr: '' }),
  )
})

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('cron/weekly-backup — عقد تحرير النافذة', () => {
  it('نجاح النسخ → completeRun ولا failRun', async () => {
    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockClaim).toHaveBeenCalledWith('weekly-backup', expect.stringMatching(/^\d{4}-W\d{2}$/))
    expect(mockComplete).toHaveBeenCalledWith('job-w1')
    expect(mockFail).not.toHaveBeenCalled()
    expect(mockWrite).toHaveBeenCalled()
  })

  it('فشل pg_dump → 500 + failRun بنفس jobId (النافذة لا تُحجب)', async () => {
    mockExec.mockImplementation((_c: unknown, _o: unknown, cb: (e: unknown) => void) =>
      cb(new Error('pg_dump: connection refused')),
    )

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBeTruthy()
    expect(mockFail).toHaveBeenCalledWith('job-w1', expect.any(Error))
    expect(mockComplete).not.toHaveBeenCalled()
  })

  it('مطالبة مكررة → skipped بلا تنفيذ ولا إغلاق سجل', async () => {
    mockClaim.mockResolvedValue({ alreadyRan: true, jobId: null })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipped).toBe('duplicate')
    expect(mockExec).not.toHaveBeenCalled()
    expect(mockComplete).not.toHaveBeenCalled()
    expect(mockFail).not.toHaveBeenCalled()
  })
})
