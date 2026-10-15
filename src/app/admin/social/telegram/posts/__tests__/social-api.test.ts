/**
 * اختبارات طبقة الجلب المحلية (W3) — بلا DOM.
 *
 * تغطي قاعدة «لا ننتظر» من المهمة:
 *  - مسار W1 غير موجود (404 غير JSON) → مخزن محلي بنفس الأشكال.
 *  - خطأ حقيقي من الـ API (422/409) → SocialApiError برسالة عربية.
 *  - تدفّق create → schedule → publish.
 */

import {
  cancelPost,
  createPost,
  deletePost,
  getPost,
  listPosts,
  publishPost,
  resetSocialMocks,
  SocialApiError,
  schedulePost,
  updatePost,
} from '../social-api'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** محاكاة مسار Next غير المبني (W1 لم يسلّم) — 404 بجسم غير JSON. */
const missingRoute = (): Response =>
  new Response('<!DOCTYPE html><html><body>404</body></html>', {
    status: 404,
    headers: { 'content-type': 'text/html' },
  })

const fetchMock = jest.fn()

/** حقل datetime-local يُقرأ كوقت محلي — نبنيه محلياً لا عبر toISOString (UTC). */
function dtLocalFromNow(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

beforeEach(() => {
  jest.clearAllMocks()
  resetSocialMocks()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('السقوط للمخزن المحلي عند غياب مسار W1', () => {
  it('listPosts تُرجع منشورات عربية بدل الانهيار', async () => {
    fetchMock.mockResolvedValue(missingRoute())
    const res = await listPosts()
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0].body).toBeTruthy()
    expect(res.pagination.total).toBeGreaterThan(0)
  })

  it('فلترة الحالة تعمل محلياً', async () => {
    fetchMock.mockResolvedValue(missingRoute())
    const res = await listPosts({ status: 'draft' })
    expect(res.data.every((p) => p.status === 'draft')).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('getPost تجد منشوراً موجوداً في المخزن', async () => {
    fetchMock.mockResolvedValue(missingRoute())
    const post = await getPost('post-draft-1')
    expect(post.id).toBe('post-draft-1')
  })

  it('getPost غير موجودة → 404 برسالة عربية', async () => {
    fetchMock.mockResolvedValue(missingRoute())
    await expect(getPost('nope')).rejects.toMatchObject({ status: 404 })
    await expect(getPost('nope')).rejects.toThrow(/غير موجود/)
  })
})

describe('المسار الحقيقي — أخطاء الـ API تصل كما هي', () => {
  it('422 برسالة عربية من الـ API يُرمى كما هو', async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: { code: 'VALIDATION_ERROR', message: 'وقت الجدولة يجب أن يكون في المستقبل' } },
        422,
      ),
    )
    await expect(schedulePost('post-draft-1', '2030-01-01T10:00')).rejects.toMatchObject({
      status: 422,
      message: 'وقت الجدولة يجب أن يكون في المستقبل',
    })
  })

  it('409 من الـ API → SocialApiError برسالة عربية', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'CONFLICT', message: 'لا يمكن تعديل منشور منشور بالفعل' } }, 409),
    )
    await expect(updatePost('post-published-1', { body: 'x' })).rejects.toBeInstanceOf(
      SocialApiError,
    )
  })

  it('قائمة من الـ API تُقرأ مع pagination', async () => {
    fetchMock.mockResolvedValue(
      json({
        data: [{ id: 'p1', status: 'draft', body: 'hi' }],
        pagination: { page: 2, limit: 10, total: 30, totalPages: 3 },
      }),
    )
    const res = await listPosts({ page: 2 })
    expect(res.data).toHaveLength(1)
    expect(res.pagination).toEqual({ page: 2, limit: 10, total: 30, totalPages: 3 })
  })

  it('استجابة غير JSON مع فشل شبكة → لا ينهار (never block)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network failure'))
    const res = await listPosts()
    expect(res.data.length).toBeGreaterThan(0)
  })
})

describe('تدفّق create → schedule → publish على المخزن المحلي', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(missingRoute())
  })

  it('التدفّق الكامل يحرّك الحالة كما يتوقع المحرّر', async () => {
    // 1) إنشاء مسودة
    const created = await createPost({ body: 'منشور الاختبار', title: 'اختبار' })
    expect(created.status).toBe('draft')
    expect(created.id).toBeTruthy()

    // 2) جدولة مستقبلية
    const future = dtLocalFromNow(60 * 60 * 1000)
    const scheduled = await schedulePost(created.id, future)
    expect(scheduled.status).toBe('scheduled')
    expect(scheduled.scheduledFor).toBeTruthy()

    // 3) نشر فوري
    const published = await publishPost(created.id)
    expect(published.status).toBe('published')
    expect(published.publishedAt).toBeTruthy()
    expect(published.externalId).toBeTruthy()

    // 4) النشر مرة أخرى idempotent — لا يغيّر الحالة
    const again = await publishPost(created.id)
    expect(again.status).toBe('published')
    expect(again.externalId).toBe(published.externalId)
  })

  it('الجدولة في الماضي ممنوعة بـ 422 قبل أي طلب شبكة', async () => {
    const created = await createPost({ body: 'نص' })
    fetchMock.mockClear()
    const past = dtLocalFromNow(-60 * 60 * 1000)
    await expect(schedulePost(created.id, past)).rejects.toMatchObject({ status: 422 })
    // لم يصل الطلب أصلاً إلى الشبكة
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('حذف منشور منشور → 409 برسالة عربية', async () => {
    const created = await createPost({ body: 'نص' })
    await publishPost(created.id)
    await expect(deletePost(created.id)).rejects.toMatchObject({
      status: 409,
    })
    await expect(deletePost(created.id)).rejects.toThrow(/حذف/)
  })

  it('تعديل منشور منشور → 409', async () => {
    const created = await createPost({ body: 'نص' })
    await publishPost(created.id)
    await expect(updatePost(created.id, { body: 'آخر' })).rejects.toMatchObject({ status: 409 })
  })

  it('إلغاء جدولة يعيدها إلى canceled', async () => {
    const created = await createPost({ body: 'نص' })
    const future = dtLocalFromNow(60 * 60 * 1000)
    await schedulePost(created.id, future)
    const canceled = await cancelPost(created.id)
    expect(canceled.status).toBe('canceled')
    expect(canceled.scheduledFor).toBeNull()
  })
})
