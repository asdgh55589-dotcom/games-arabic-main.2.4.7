/**
 * @jest-environment jsdom
 *
 * اختبارات صفحة `/admin/notifications/history` على مستوى المكوّن.
 *
 * التركيز على العقد مع الخادم: URL المطلوب، المرشّحات، والترقيم. لاAssertions
 * على الـ markup أو أصناف CSS.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()

// `waitFor` الافتراضي (1s) لا يكفي هنا: أول تشغيل للصفحات يتضمّن تجميع
// ts-jest للملفات بالتوازي مع بقية المجموعات، فتزداد المهلة تحت ضغط CI.
const WAIT = { timeout: 5000 }

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => cleanup())

function jsonResponse(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response)
}

function renderPage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Page = require('@/app/admin/notifications/history/page').default
  return render(<Page />)
}

function log(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    channel: 'in_app',
    status: 'sent',
    createdAt: '2026-04-01T00:00:00.000Z',
    notification: {
      type: 'comment_reply',
      title: 'رد على تعليقك',
      message: 'نص',
      user: { username: 'ali' },
    },
    ...overrides,
  }
}

function body(logs: unknown[], totalPages = 1) {
  return { data: { logs, pagination: { totalPages } } }
}

/** ينتظر انتهاء التحميل — شريط الأدوات لا يُركَّب أثناء الطلب. */
async function waitForLoaded() {
  await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2), WAIT)
}

/**
 * يغيّر مرشّحًا ثم ينتظر الطلب **و** عودة شريط الأدوات: كل تغيير يعيد الصفحة
 * إلى حالة `loading` التي تفكّك المرشّحات وزر التصدير.
 */
async function changeSelect(displayValue: string, value: string, expectedCalls: number) {
  fireEvent.change(screen.getByDisplayValue(displayValue), { target: { value } })
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(expectedCalls), WAIT)
  await waitForLoaded()
}

/** يُرجع عنوان آخر طلب (fetch URL). */
function lastUrl(): string {
  return String(mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0])
}

describe('/admin/notifications/history', () => {
  it('requests page 1 with a 20-row limit', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([])))
    renderPage()

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1), WAIT)
    expect(lastUrl()).toBe('/api/admin/notifications?page=1&limit=20')
  })

  it('renders one row per log with type, title, recipient, channel and status', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()])))

    renderPage()

    await waitFor(() => expect(screen.getByText('رد على تعليقك')).toBeTruthy(), WAIT)
    expect(screen.getByText('ali')).toBeTruthy()
    // اسم القناة يظهر في خيارات المرشّح أيضاً، فيُطابَق بكل تطابقات
    expect(screen.getAllByText('داخل التطبيق').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('مرسل').length).toBeGreaterThanOrEqual(2)
  })

  it('shows an empty state instead of a blank table when there are no logs', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([])))

    renderPage()

    await waitFor(() => expect(screen.getByText('لا توجد سجلات')).toBeTruthy(), WAIT)
  })

  it('falls back to an empty list when the payload has no data envelope', async () => {
    mockFetch.mockReturnValue(jsonResponse({}))

    renderPage()

    await waitFor(() => expect(screen.getByText('لا توجد سجلات')).toBeTruthy(), WAIT)
  })

  it('shows the page number out of the total returned by the server', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()], 7)))

    renderPage()

    await waitFor(() => expect(screen.getByText('صفحة 1 من 7')).toBeTruthy(), WAIT)
  })

  it('re-requests with the channel filter and resets to page 1', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()])))
    renderPage()
    await waitForLoaded()

    await changeSelect('كل القنوات', 'email', 2)
    expect(lastUrl()).toContain('channel=email')
    expect(lastUrl()).toContain('page=1')
  })

  it('re-requests with the status filter', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()])))
    renderPage()
    await waitForLoaded()

    await changeSelect('كل الحالات', 'failed', 2)
    expect(lastUrl()).toContain('status=failed')
  })

  it('combines both filters in one request', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()])))
    renderPage()
    await waitForLoaded()

    await changeSelect('كل القنوات', 'telegram', 2)
    await changeSelect('كل الحالات', 'sent', 3)
    expect(lastUrl()).toContain('channel=telegram')
    expect(lastUrl()).toContain('status=sent')
  })

  it('advances to the next page', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()], 3)))
    renderPage()
    await waitFor(() => expect(screen.getByText('صفحة 1 من 3')).toBeTruthy(), WAIT)

    fireEvent.click(screen.getByText('التالي'))

    await waitFor(() => expect(lastUrl()).toContain('page=2'), WAIT)
  })

  it('disables "previous" on the first page and "next" on the last page', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()], 1)))
    renderPage()

    await waitFor(() => expect(screen.getByText('صفحة 1 من 1')).toBeTruthy(), WAIT)
    expect((screen.getByText('السابق').closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText('التالي').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('opens the CSV export with the active filters applied', async () => {
    mockFetch.mockReturnValue(jsonResponse(body([log()])))
    renderPage()
    await waitFor(() => expect(screen.getByText('رد على تعليقك')).toBeTruthy(), WAIT)

    await changeSelect('كل القنوات', 'email', 2)

    const open = jest.fn()
    ;(window as unknown as { open: jest.Mock }).open = open

    fireEvent.click(screen.getByText('تصدير CSV'))

    expect(open).toHaveBeenCalledWith('/api/admin/notifications/export?channel=email', '_blank')
  })

  it('renders what it has when the request fails instead of crashing', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('offline')))
    jest.spyOn(console, 'error').mockImplementation(() => {
      // الخرج مسموع في Jest فقط؛ نكتمه حتى لا يغرق سجل التشغيل.
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('لا توجد سجلات')).toBeTruthy(), WAIT)
  })
})
