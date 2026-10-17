/**
 * اختبارات /api/admin/social/publish-errors (GET قائمة + عدّادات) و
 * /[id]/resolve (409 للمحلول، audit عند الحل) — مرحلة 6.
 */

jest.mock('@/lib/db', () => ({
  db: {
    publishErrorEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'a1', role: 'admin' }),
  requireManager: jest.fn().mockResolvedValue({ id: 'm1', username: 'boss', role: 'manager' }),
}))

jest.mock('@/lib/social/publish-error-events', () => ({
  resolveEventManually: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolveEventManually } from '@/lib/social/publish-error-events'
import { POST as resolvePOST } from '../[id]/resolve/route'
import { GET as listGET } from '../route'

const mockDb = db as unknown as {
  publishErrorEvent: { findMany: jest.Mock; count: jest.Mock; updateMany: jest.Mock }
}
const mockAdmin = requireAdmin as jest.Mock
const mockManager = requireManager as jest.Mock
const mockResolve = resolveEventManually as jest.Mock

const makeReq = (url: string) => new NextRequest(url)

beforeEach(() => {
  jest.clearAllMocks()
  mockAdmin.mockResolvedValue({ id: 'a1', role: 'admin' })
  mockManager.mockResolvedValue({ id: 'm1', username: 'boss', role: 'manager' })
  mockDb.publishErrorEvent.findMany.mockResolvedValue([
    {
      id: 'ev-1',
      code: 'rate_limited',
      scope: 'post',
      refId: 'post-1',
      message: '429',
      causeAr: 'ب',
      fixAr: 'أ',
      retryable: true,
      attempt: 2,
      notifiedAt: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date('2026-10-17T10:00:00Z'),
    },
  ])
  mockDb.publishErrorEvent.count
    .mockResolvedValueOnce(5) // open
    .mockResolvedValueOnce(2) // last24h
  mockResolve.mockResolvedValue({ ok: true })
})

describe('GET /api/admin/social/publish-errors', () => {
  it('يرفض غير الإدارة (401/403)', async () => {
    mockAdmin.mockRejectedValue({ status: 401 })

    const res = await listGET(makeReq('http://localhost/api/admin/social/publish-errors'))

    expect(res.status).toBe(401)
    expect(mockDb.publishErrorEvent.findMany).not.toHaveBeenCalled()
  })

  it('الافتراضي open مع عدّادات، وكل القيود تمرّ', async () => {
    const res = await listGET(
      makeReq(
        'http://localhost/api/admin/social/publish-errors?status=all&scope=post&code=rate_limited&limit=10',
      ),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.counts).toEqual({ open: 5, last24h: 2 })
    const where = mockDb.publishErrorEvent.findMany.mock.calls[0][0].where
    expect(where.scope).toBe('post')
    expect(where.code).toBe('rate_limited')
    expect(where.resolvedAt).toBeUndefined() // status=all — بلا تصفية محلول
    expect(mockDb.publishErrorEvent.findMany.mock.calls[0][0].take).toBe(10)
  })

  it('status=open ← resolvedAt: null', async () => {
    await listGET(makeReq('http://localhost/api/admin/social/publish-errors'))

    const where = mockDb.publishErrorEvent.findMany.mock.calls[0][0].where
    expect(where.resolvedAt).toEqual(null)
  })
})

describe('POST /[id]/resolve', () => {
  it('حل يدوي ناجح → resolved:true (المسؤول داخل resolveEventManually)', async () => {
    const res = await resolvePOST(
      makeReq('http://localhost/api/admin/social/publish-errors/ev-1/resolve'),
      { params: Promise.resolve({ id: 'ev-1' }) },
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ resolved: true })
    expect(mockResolve).toHaveBeenCalledWith('ev-1', { id: 'm1', username: 'boss' })
  })

  it('محلول سابقاً → 409', async () => {
    mockResolve.mockResolvedValue({ ok: false, already: true })

    const res = await resolvePOST(
      makeReq('http://localhost/api/admin/social/publish-errors/ev-1/resolve'),
      { params: Promise.resolve({ id: 'ev-1' }) },
    )

    expect(res.status).toBe(409)
  })

  it('غير manager → 401/403', async () => {
    mockManager.mockRejectedValue({ status: 403 })

    const res = await resolvePOST(
      makeReq('http://localhost/api/admin/social/publish-errors/ev-1/resolve'),
      { params: Promise.resolve({ id: 'ev-1' }) },
    )

    expect(res.status).toBe(403)
    expect(mockResolve).not.toHaveBeenCalled()
  })
})
