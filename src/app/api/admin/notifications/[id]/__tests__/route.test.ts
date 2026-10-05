/**
 * Tests for PATCH /api/admin/notifications/[id] — تعديل إشعار موجود.
 *
 * ملاحظة سلوكية موثّقة هنا: المسار لا يفرّق 401 عن 403 — أي خطأ غير معروف
 * يصبح 500. الاختبار يثبّت السلوك الحالي بلا تجميل حتى لا يُقرأ كموافقة عليه،
 * ويقول صراحةً إن معالجة الأخطاء ناقصة.
 */

jest.mock('@/lib/db', () => ({
  db: {
    notification: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireModerator: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH } from '../route'

const mockRequireModerator = requireModerator as jest.Mock
const mockFindUnique = db.notification.findUnique as jest.Mock
const mockUpdate = db.notification.update as jest.Mock

const MOD = { id: 'mod-1', role: 'moderator', username: 'mod' }

function patch(id: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/admin/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) },
  )
}

describe('PATCH /api/admin/notifications/[id] — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
    mockFindUnique.mockResolvedValue({ id: 'n1' })
    mockUpdate.mockResolvedValue({ id: 'n1' })
  })

  it('updates and returns success', async () => {
    const res = await patch('n1', { title: 'عنوان جديد' })

    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ success: true })
  })

  it('writes only the fields present in the body', async () => {
    await patch('n1', { title: 'عنوان' })

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { title: 'عنوان' },
    })
  })

  it('updates type, title and message together', async () => {
    await patch('n1', { type: 'system_alert', title: 't', message: 'm' })

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { type: 'system_alert', title: 't', message: 'm' },
    })
  })

  it('rejects an empty patch with 422 instead of reporting a fake success', async () => {
    // P3: جسم بلا حقول قابلة للتعديل خطأ تحقّق — لا 200 ولا كتابة في القاعدة.
    const res = await patch('n1', {})

    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects an all-falsy patch with 422 instead of blanking a column', async () => {
    const res = await patch('n1', { title: '', message: null })

    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('scopes the update to the id from the route params', async () => {
    await patch('n-42', { title: 't' })

    // P3: يُقرأ السطر كاملاً (type/title/message) لتغذية سجل التدقيق before/after.
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'n-42' },
      select: { id: true, type: true, title: true, message: true },
    })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'n-42' } }))
  })
})

describe('PATCH /api/admin/notifications/[id] — not found', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
    mockFindUnique.mockResolvedValue(null)
  })

  it('returns 404 and writes nothing for an unknown id', async () => {
    const res = await patch('missing', { title: 't' })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/notifications/[id] — auth failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindUnique.mockResolvedValue({ id: 'n1' })
  })

  it('returns 403 (not 500) when the caller is not a moderator', async () => {
    // P3: catch يفحص `status` now — 403Forbidden لا ينقلب إلى 500.
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Forbidden — moderator access required'), { status: 403 }),
    )

    const res = await patch('n1', { title: 't' })

    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 401 (not 500) when the caller is not signed in', async () => {
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const res = await patch('n1', { title: 't' })

    expect(res.status).toBe(401)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('never touches the database before the auth check resolves', async () => {
    mockRequireModerator.mockRejectedValue(Object.assign(new Error('anything'), { status: 403 }))

    await patch('n1', { title: 't' })

    expect(mockFindUnique).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/notifications/[id] — failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
    mockFindUnique.mockResolvedValue({ id: 'n1' })
  })

  it('returns 500 without leaking the database error', async () => {
    mockUpdate.mockRejectedValue(new Error('deadlock detected'))

    const res = await patch('n1', { title: 't' })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('deadlock')
  })

  it('returns 422 for a malformed JSON body instead of crashing', async () => {
    // P3: جسم غير قابل للتحليل يُعامَل كجسم فارغ → 422 عبر حارس "لا حقول".
    const res = await PATCH(
      new NextRequest('http://localhost/api/admin/notifications/n1', {
        method: 'PATCH',
        body: '{oops',
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'n1' }) },
    )

    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
