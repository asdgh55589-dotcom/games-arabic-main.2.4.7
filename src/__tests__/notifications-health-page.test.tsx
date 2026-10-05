/**
 * @jest-environment jsdom
 *
 * اختبارات صفحة `/admin/notifications-health` على مستوى المكوّن.
 *
 * الاختبارات تتحقق من **القيم المعروضة** وأخطاء الشبكة، لا من الـ markup أو
 * أصناف CSS — حتى لا تنكسر مع أي تغيير تخطيط لاحق.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()

// `waitFor` الافتراضي (1s) لا يكفي هنا: أول تشغيل للصفحات يتضمّن تجميع
// ts-jest للملفات بالتوازي مع بقية المجموعات، فتزداد المهلة تحت ضغط CI.
const WAIT = { timeout: 5000 }

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => cleanup())

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as Response)
}

function renderPage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Page = require('@/app/admin/notifications-health/page').default
  return render(<Page />)
}

describe('/admin/notifications-health', () => {
  it('shows a loader and nothing else while the request is in flight', async () => {
    const release = jest.fn()
    global.fetch = jest.fn(
      () => new Promise<Response>((resolve) => release.mockImplementation(resolve)),
    ) as never

    renderPage()

    // لا جدول قبل وصول البيانات
    expect(screen.queryByText('المقاييس')).toBeNull()

    release({ ok: true, json: () => Promise.resolve({ data: { database: emptyDb() } }) } as never)
    await waitFor(() => expect(screen.getByText('المقاييس')).toBeTruthy(), WAIT)
  })

  it('requests the health endpoint', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: { database: emptyDb() } }))
    renderPage()

    await waitFor(
      () => expect(mockFetch).toHaveBeenCalledWith('/api/admin/notifications-health'),
      WAIT,
    )
  })

  it('renders the real database counters, not placeholder metrics', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        data: {
          database: {
            totalNotifications: 12_345,
            unreadCount: 678,
            deadLetterJobs: 42,
            recentFailures: [],
          },
        },
      }),
    )

    renderPage()

    // الإجمالي والمهام الميتة يظهران مرتين (بطاقة + صف جدول)؛ غير المقروء
    // مرّة واحدة (صف الجدول فقط) — مطابقة لشكل العرض الحالي.
    await waitFor(() => expect(screen.getAllByText('12,345')).toHaveLength(2), WAIT)
    expect(screen.getAllByText('678')).toHaveLength(1)
    expect(screen.getAllByText('42')).toHaveLength(2)
  })

  it('highlights a non-zero dead-letter count', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        data: {
          database: {
            totalNotifications: 1,
            unreadCount: 0,
            deadLetterJobs: 7,
            recentFailures: [],
          },
        },
      }),
    )

    renderPage()

    await waitFor(() => expect(screen.getAllByText('7')).toHaveLength(2), WAIT)
    expect(screen.getByText('مهام في الحالة الميتة')).toBeTruthy()
  })

  it('says so explicitly when there are no recent failures', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: { database: emptyDb() } }))

    renderPage()

    await waitFor(() => expect(screen.getByText('لا توجد فشلات حديثة')).toBeTruthy(), WAIT)
  })

  it('lists each recent failure with its channel, attempts and error', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        data: {
          database: {
            totalNotifications: 5,
            unreadCount: 0,
            deadLetterJobs: 0,
            recentFailures: [
              {
                id: 'job-0123456789ab',
                channel: 'email',
                status: 'failed',
                attempts: 5,
                lastError: 'SMTP timeout after 30s',
                updatedAt: '2026-04-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('SMTP timeout after 30s')).toBeTruthy(), WAIT)
    expect(screen.getByText('email')).toBeTruthy()
  })

  it('surfaces the API error message when the response carries one', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ error: { message: 'غير مصرح — هذه الصفحة للمديرين فقط' } }),
    )

    renderPage()

    await waitFor(
      () => expect(screen.getByText('غير مصرح — هذه الصفحة للمديرين فقط')).toBeTruthy(),
      WAIT,
    )
  })

  it('shows a load-failure message when the network call throws', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('offline')))

    renderPage()

    await waitFor(() => expect(screen.getByText('Failed to load health data')).toBeTruthy(), WAIT)
  })

  it('keeps the retry button disabled while no queue worker exists', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        data: {
          database: {
            totalNotifications: 1,
            unreadCount: 0,
            deadLetterJobs: 1,
            recentFailures: [
              {
                id: 'job-0123456789ab',
                channel: 'telegram',
                status: 'failed',
                attempts: 5,
                lastError: 'bot 401',
                updatedAt: '2026-04-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('bot 401')).toBeTruthy(), WAIT)
    const retry = screen.getByRole('button', { name: /إعادة الإرسال/ })
    expect((retry as HTMLButtonElement).disabled).toBe(true)
  })
})

function emptyDb() {
  return { totalNotifications: 0, unreadCount: 0, deadLetterJobs: 0, recentFailures: [] }
}
