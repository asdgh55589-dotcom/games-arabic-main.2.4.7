/**
 * اختبارات مسار المنشور المفرد + إجراءاته — (W1/A2–A4).
 *
 *  - /posts/[id]            GET/PATCH/DELETE مع بوابات الحالة.
 *  - /posts/[id]/validate   تحقق بلا كتابة (200/422).
 *  - /posts/[id]/preview    معاينة دائماً 200 بلا كتابة.
 *  - /posts/[id]/publish    نشر فوري (المسار الوحيد عبر publishSocialPost).
 *  - /posts/[id]/schedule   جدولة مستقبلية فقط.
 *  - /posts/[id]/cancel     إلغاء منشور مجدول/فاشل فقط.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPost: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    telegramDestination: { findUnique: jest.fn() },
    socialPostTemplate: { findUnique: jest.fn() },
    socialTelegramBot: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' }),
  requireManager: jest
    .fn()
    .mockResolvedValue({ id: 'manager-1', username: 'mgr', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))

// tg-rich-messages حزمة ESM-only لا يحمّلها Jest/CJS. كما توثّق طبقة
// tg-rich.ts نفسها، تُستبدل هنا بمزوّد مطابق. المسارات المُختبرة كلاسيكية
// (richDocument=null) فلا تُستدعى دوال الغني إطلاقاً.
jest.mock('@/lib/social/tg-rich', () => {
  class RichDocument {}
  const noop = jest.fn()
  return {
    RichDocument,
    doc: noop,
    p: noop,
    paragraph: noop,
    bold: noop,
    italic: noop,
    underline: noop,
    strike: noop,
    code: noop,
    pre: noop,
    spoiler: noop,
    sub: noop,
    sup: noop,
    link: noop,
    br: noop,
    heading: noop,
    divider: noop,
    blockquote: noop,
    details: noop,
    footer: noop,
    list: noop,
    table: noop,
    photo: noop,
    video: noop,
    audio: noop,
    document: noop,
    fmtRich: noop,
  }
})
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))
jest.mock('@/lib/social/publish', () => ({ publishSocialPost: jest.fn() }))

import { NextRequest } from 'next/server'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { publishSocialPost } from '@/lib/social/publish'
import { POST as cancelPOST } from '../cancel/route'
import { POST as previewPOST } from '../preview/route'
import { POST as publishPOST } from '../publish/route'
import { DELETE, GET, PATCH } from '../route'
import { POST as schedulePOST } from '../schedule/route'
import { POST as validatePOST } from '../validate/route'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockRequireManager = requireManager as jest.Mock
const mockPublish = publishSocialPost as jest.Mock
const mockDb = db as unknown as {
  socialPost: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock }
  telegramDestination: { findUnique: jest.Mock }
  socialPostTemplate: { findUnique: jest.Mock }
  socialTelegramBot: { findUnique: jest.Mock }
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function makeReq(url: string, body?: unknown, method = 'POST') {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

const baseRow = (over: Record<string, unknown> = {}) => ({
  id: 'post-1',
  platform: 'telegram',
  status: 'draft',
  title: 'عنوان',
  body: 'متن المنشور',
  parseMode: null,
  richDocument: null,
  mediaUrl: null,
  destinationId: null,
  botId: null,
  templateId: null,
  scheduledFor: null,
  publishedAt: null,
  externalId: null,
  attempts: 0,
  maxAttempts: 3,
  lastError: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' })
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' })
})

describe('/posts/[id] — GET/PATCH/DELETE', () => {
  it('GET غير موجود → 404', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null)
    const res = await GET(makeReq('http://x/posts/nope', undefined, 'GET'), ctx('nope'))
    expect(res.status).toBe(404)
  })

  it('PATCH منشور منشور مسبقاً → 409 بلا كتابة', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow({ status: 'published' }))
    const res = await PATCH(makeReq('http://x/posts/post-1', { body: 'x' }, 'PATCH'), ctx('post-1'))
    expect(res.status).toBe(409)
    expect(mockDb.socialPost.update).not.toHaveBeenCalled()
  })

  it('PATCH مسودة بحقول فارغة → 422', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow())
    const res = await PATCH(makeReq('http://x/posts/post-1', {}, 'PATCH'), ctx('post-1'))
    expect(res.status).toBe(422)
    expect(mockDb.socialPost.update).not.toHaveBeenCalled()
  })

  it('DELETE منشور منشور مسبقاً → 409 بلا حذف', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow({ status: 'published' }))
    const res = await DELETE(makeReq('http://x/posts/post-1', undefined, 'DELETE'), ctx('post-1'))
    expect(res.status).toBe(409)
    expect(mockDb.socialPost.delete).not.toHaveBeenCalled()
  })

  it('DELETE مسودة → 200 ويحذف', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow())
    mockDb.socialPost.delete.mockResolvedValue({})
    const res = await DELETE(makeReq('http://x/posts/post-1', undefined, 'DELETE'), ctx('post-1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.deleted).toBe(true)
    expect(mockDb.socialPost.delete).toHaveBeenCalled()
  })
})

describe('/posts/[id]/publish — نشر فوري', () => {
  it('منشور غير موجود → 404 بلا نشر', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null)
    const res = await publishPOST(makeReq('http://x/p1/publish'), ctx('p1'))
    expect(res.status).toBe(404)
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('نجاح → 200 status=published مع externalId', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 'p1' })
    mockPublish.mockResolvedValue({ ok: true, status: 'published', externalId: 'tg-9' })
    const res = await publishPOST(makeReq('http://x/p1/publish'), ctx('p1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data).toEqual({ status: 'published', externalId: 'tg-9' })
  })

  it('فشل تليجرام → 422 مع reason (لا 500)', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 'p1' })
    mockPublish.mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'chat not found',
      reason: 'no_destination',
    })
    const res = await publishPOST(makeReq('http://x/p1/publish'), ctx('p1'))
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.code).toBe('PUBLISH_FAILED')
    expect(data.error.details.reason).toBe('no_destination')
  })

  it('النشر idempotent: skipped لا يتحوّل إلى فشل', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 'p1' })
    mockPublish.mockResolvedValue({
      ok: true,
      status: 'skipped',
      reason: 'already_published',
      externalId: 'tg-1',
    })
    const res = await publishPOST(makeReq('http://x/p1/publish'), ctx('p1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.status).toBe('skipped')
  })
})

describe('/posts/[id]/schedule — جدولة مستقبلية', () => {
  it('ماضٍ → 422 بلا تحديث', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow())
    const past = new Date(Date.now() - 3_600_000).toISOString()
    const res = await schedulePOST(
      makeReq('http://x/p1/schedule', { scheduledFor: past }),
      ctx('p1'),
    )
    expect(res.status).toBe(422)
    expect(mockDb.socialPost.update).not.toHaveBeenCalled()
  })

  it('تاريخ غير صالح → 422', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow())
    const res = await schedulePOST(
      makeReq('http://x/p1/schedule', { scheduledFor: 'not-a-date' }),
      ctx('p1'),
    )
    expect(res.status).toBe(422)
  })

  it('منشور منشور مسبقاً → 409', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow({ status: 'published' }))
    const future = new Date(Date.now() + 3_600_000).toISOString()
    const res = await schedulePOST(
      makeReq('http://x/p1/schedule', { scheduledFor: future }),
      ctx('p1'),
    )
    expect(res.status).toBe(409)
  })

  it('مستقبلي صالح → 200 status=scheduled', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow())
    const future = new Date(Date.now() + 3_600_000)
    mockDb.socialPost.update.mockResolvedValue(
      baseRow({ status: 'scheduled', scheduledFor: future }),
    )
    const res = await schedulePOST(
      makeReq('http://x/p1/schedule', { scheduledFor: future.toISOString() }),
      ctx('p1'),
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.status).toBe('scheduled')
  })
})

describe('/posts/[id]/cancel — إلغاء الجدولة', () => {
  it('مسودة بلا جدولة → 409', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow({ status: 'draft' }))
    const res = await cancelPOST(makeReq('http://x/p1/cancel'), ctx('p1'))
    expect(res.status).toBe(409)
    expect(mockDb.socialPost.update).not.toHaveBeenCalled()
  })

  it('مجدول → 200 status=canceled وبلا موعد', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow({ status: 'scheduled' }))
    mockDb.socialPost.update.mockResolvedValue(baseRow({ status: 'canceled', scheduledFor: null }))
    const res = await cancelPOST(makeReq('http://x/p1/cancel'), ctx('p1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.status).toBe('canceled')
    expect(data.data.scheduledFor).toBeNull()
  })
})

describe('/posts/[id]/validate + preview — بلا كتابة', () => {
  it('validate نص صالح → 200 ok:true بمقاييس', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow())
    const res = await validatePOST(makeReq('http://x/p1/validate', {}), ctx('p1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.ok).toBe(true)
    expect(data.data.metrics.renderedLength).toBeGreaterThan(0)
  })

  it('validate HTML بوسم ممنوع → 422 مع issues', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow({ parseMode: 'HTML' }))
    const res = await validatePOST(
      makeReq('http://x/p1/validate', { body: '<script>alert(1)</script>' }),
      ctx('p1'),
    )
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.details.ok).toBe(false)
    expect(data.error.details.issues.length).toBeGreaterThan(0)
  })

  it('preview يعيد النص دائماً بلا كتابة', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(baseRow())
    const res = await previewPOST(makeReq('http://x/p1/preview', {}), ctx('p1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.text).toContain('متن المنشور')
    expect(mockDb.socialPost.update).not.toHaveBeenCalled()
  })

  it('preview غير مسجّل الدخول → 401', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await previewPOST(makeReq('http://x/p1/preview', {}), ctx('p1'))
    expect(res.status).toBe(401)
    expect(mockDb.socialPost.findUnique).not.toHaveBeenCalled()
  })
})
