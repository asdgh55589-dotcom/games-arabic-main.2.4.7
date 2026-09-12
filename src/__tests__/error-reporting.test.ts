import * as fs from 'fs'
import * as path from 'path'

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(() => 'mock-event-id'),
  init: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { clearDedup, maskId, reportError } from '@/lib/error-reporting'
import { sentryBeforeSend } from '@/lib/sentry-filters'
import {
  handleUncaughtException,
  handleUnhandledRejection,
} from '../../instrumentation'

const mockCapture = Sentry.captureException as jest.Mock
const mockLoggerError = logger.error as jest.Mock

const SAVED_DSN = process.env.SENTRY_DSN
const SAVED_PUBLIC_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

function clearDsnEnv() {
  delete process.env.SENTRY_DSN
  delete process.env.NEXT_PUBLIC_SENTRY_DSN
}

beforeEach(() => {
  clearDedup()
  jest.clearAllMocks()
  clearDsnEnv()
})

afterAll(() => {
  if (SAVED_DSN !== undefined) process.env.SENTRY_DSN = SAVED_DSN
  if (SAVED_PUBLIC_DSN !== undefined) process.env.NEXT_PUBLIC_SENTRY_DSN = SAVED_PUBLIC_DSN
})

describe('reportError — no DSN', () => {
  it('no-op بدون DSN: لا يستدعي Sentry ويعيد skipped', () => {
    expect(reportError(new Error('boom'), { route: 'GET /api/reports' })).toBe('skipped')
    expect(mockCapture).not.toHaveBeenCalled()
  })
})

describe('maskId', () => {
  it('يقنّع المعرف first4…last2', () => {
    expect(maskId('abcdef123456')).toBe('abcd…56')
  })
  it('يعيد فارغاً للمدخلات الفارغة و*** للقصيرة', () => {
    expect(maskId('')).toBe('')
    expect(maskId(null)).toBe('')
    expect(maskId('abc')).toBe('***')
  })
})

describe('reportError — dedup', () => {
  beforeEach(() => {
    process.env.SENTRY_DSN = 'https://test@sentry.io/1'
  })

  it('نفس الرسالة+المسار مرتين → capture واحد', () => {
    const r1 = reportError(new Error('boom'), { route: 'GET /api/reports' })
    const r2 = reportError(new Error('boom'), { route: 'GET /api/reports' })
    expect(r1).toBe('mock-event-id')
    expect(r2).toBe('deduped')
    expect(mockCapture).toHaveBeenCalledTimes(1)
  })

  it('مسار مختلف → capture ثانٍ', () => {
    reportError(new Error('boom'), { route: 'GET /api/reports' })
    reportError(new Error('boom'), { route: 'POST /api/reports' })
    expect(mockCapture).toHaveBeenCalledTimes(2)
  })

  it('يرسل tags + معرّف مقنّع فقط (لا أسرار خام)', () => {
    reportError(new Error('x'), {
      route: 'GET /api/admin/users',
      userId: 'abcdef123456',
      requestId: 'req-1',
      locale: 'ar',
    })
    expect(mockCapture).toHaveBeenCalledTimes(1)
    const [, ctx] = mockCapture.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(ctx['tags']).toEqual({ route: 'GET /api/admin/users', requestId: 'req-1', locale: 'ar' })
    expect(ctx['user']).toEqual({ id: 'abcd…56' })
    expect(JSON.stringify(ctx)).not.toContain('abcdef123456')
  })
})

describe('sentryBeforeSend', () => {
  it('يسقط envelope الـ 401', () => {
    const event = {
      contexts: { response: { status_code: 401 } },
      exception: { values: [{ type: 'Error', value: 'Unauthorized' }] },
    } as any
    expect(sentryBeforeSend(event)).toBeNull()
  })

  it('يسقط ZodError', () => {
    const event = {
      exception: { values: [{ type: 'ZodError', value: '[{"code":"invalid_type"}]' }] },
    } as any
    expect(sentryBeforeSend(event)).toBeNull()
  })

  it('يسقط quota-denied / rate-limit', () => {
    const quota = {
      exception: { values: [{ type: 'Error', value: 'RATE_LIMITED: too many requests' }] },
    } as any
    expect(sentryBeforeSend(quota)).toBeNull()
    const q429 = {
      exception: { values: [{ type: 'Error', value: 'failed with 429' }] },
    } as any
    expect(sentryBeforeSend(q429)).toBeNull()
  })

  it('يُبقي TypeError الحقيقي', () => {
    const event = {
      exception: { values: [{ type: 'TypeError', value: 'Cannot read properties of undefined' }] },
    } as any
    expect(sentryBeforeSend(event)).toBe(event)
  })
})

describe('global handlers', () => {
  it('مسار unhandledRejection يستدعي reportError (capture) + logger', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.io/1'
    expect(() => handleUnhandledRejection(new Error('boom-unhandled'))).not.toThrow()
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('مسار uncaughtException لا يرمي أبداً حتى بدون DSN', () => {
    expect(() => handleUncaughtException(new Error('fatal'))).not.toThrow()
    expect(mockCapture).not.toHaveBeenCalled()
  })
})

describe('Arabic response text unchanged', () => {
  it('ملف المسار المرّبط ما زال يحتوي النص العربي الأصلي', () => {
    const p = path.join(__dirname, '..', 'app', 'api', 'reports', 'route.ts')
    const src = fs.readFileSync(p, 'utf8')
    expect(src).toContain('فشل إرسال البلاغ')
    expect(src).toContain("reportError(err, { route: 'POST /api/reports' })")
  })
})
