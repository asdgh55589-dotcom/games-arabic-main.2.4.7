/**
 * @jest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import TelegramPostsPage from '@/app/admin/social/telegram/posts/page'

const missing = () =>
  Promise.resolve({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: { get: () => 'text/plain' },
    json: () => Promise.resolve(null),
  } as unknown as Response)

const realFetch = global.fetch

afterEach(() => {
  cleanup()
  global.fetch = realFetch
})

describe('صفحة قائمة منشورات تليجرام (C1)', () => {
  it('تعرض رأس الجدول بالعربية وعناوين المنشورات من مخزن المحاكاة', async () => {
    global.fetch = jest.fn().mockImplementation(() => missing()) as unknown as typeof fetch

    render(<TelegramPostsPage />)

    await waitFor(() => expect(screen.getByText('تحديث جديد للعبة المفضلة')).toBeTruthy())

    for (const head of ['العنوان', 'الحالة', 'الموعد', 'المنصة', 'الوجهة', 'الإجراءات']) {
      expect(screen.getAllByText(head).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('تذكير بموعد الإطلاق')).toBeTruthy()
    expect(screen.getByText('منشور ملغى')).toBeTruthy()
  })

  it('تعرض بطاقة الفلاتر (الحالة والمنصة والتواريخ)', async () => {
    global.fetch = jest.fn().mockImplementation(() => missing()) as unknown as typeof fetch

    render(<TelegramPostsPage />)

    // محتوى القائمة المنسدلة داخل بورتال radix ولا يظهر قبل الفتح —
    // لذا نتحقق من بطاقته وبطاقته الفرعية لا من عناصر القائمة.
    await waitFor(() => expect(screen.getByText('الفلاتر')).toBeTruthy())
    expect(screen.getByText('صفِّ النتائج حسب الحالة والمنصة والفترة الزمنية.')).toBeTruthy()
    expect(screen.getAllByText('الحالة').length).toBeGreaterThan(0)
    expect(screen.getAllByText('المنصة').length).toBeGreaterThan(0)
    expect(screen.getByText('من تاريخ')).toBeTruthy()
    expect(screen.getByText('إلى تاريخ')).toBeTruthy()
  })

  it('زر «منشور جديد» يظهر عند تجاوز فحص الصلاحية (fail-open)', async () => {
    global.fetch = jest.fn().mockImplementation(() => missing()) as unknown as typeof fetch

    render(<TelegramPostsPage />)

    await waitFor(() => expect(screen.getByText('منشور جديد')).toBeTruthy())
  })

  it('رسالة الخطأ تظهر بالعربية عند فشل الخادم بدل شاشة بيضاء', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ error: { message: 'Internal server error' } }),
      } as unknown as Response),
    ) as unknown as typeof fetch

    render(<TelegramPostsPage />)

    await waitFor(() => expect(screen.getByText('إعادة المحاولة')).toBeTruthy())
    // رسائل الخادم المألوفة تُترجم للعربية ولا تُسقَط نصوصاً إنجليزية خاماً على المستخدم
    expect(screen.getByText('خطأ في الخادم — حاول مرة أخرى')).toBeTruthy()
    expect(screen.queryByText('Internal server error')).toBeNull()
  })
})
