/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { NotificationTemplate } from '@/app/admin/social/telegram/templates/templates-api'
import { NotificationTemplateActions } from '@/components/admin/social/notification-template-actions'

const template: NotificationTemplate = {
  id: 'tpl-1',
  type: 'MOD_APPROVED',
  channel: 'telegram',
  titleTemplate: 'تمت الموافقة على التعديل',
  bodyTemplate: 'مرحباً، تمت مراجعة طلبك.',
  variables: ['username', 'modTitle'],
  isActive: true,
  version: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
}

const okJson = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve({ data }),
  } as unknown as Response)

const errJson = (status: number, body: unknown) =>
  Promise.resolve({
    ok: false,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  } as unknown as Response)

const realFetch = global.fetch

afterEach(() => {
  cleanup()
  global.fetch = realFetch
})

describe('NotificationTemplateActions', () => {
  it('يعرض أزرار دورة الحياة بالعربية', () => {
    render(<NotificationTemplateActions template={template} destinations={[]} />)
    for (const label of [
      'نسخ',
      'تحقق',
      'معاينة',
      'إرسال تجريبي',
      'نشر وتفعيل',
      'إصدارات',
      'سجل',
      'تراجع',
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('زر «تحقق» يستدعي POST /validate ويعرض المشاكل العربية', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/validate')) {
        return errJson(422, {
          error: {
            message: 'تعذر التحقق',
            details: {
              issues: [
                { code: 'UNDEF_VAR', message: 'متغير {username} غير معرّف' },
                { code: 'TOO_LONG', message: 'المحتوى أطول من الحد المسموح' },
              ],
            },
          },
        })
      }
      return okJson(null)
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<NotificationTemplateActions template={template} destinations={[]} />)
    fireEvent.click(screen.getByText('تحقق'))

    await waitFor(() => expect(screen.getByText('نتيجة التحقق')).toBeTruthy())
    expect(screen.getByText('متغير {username} غير معرّف')).toBeTruthy()
    expect(screen.getByText('المحتوى أطول من الحد المسموح')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/templates/tpl-1/validate',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('زر «نسخ» يستدعي واجهة الاستنساخ ثم يبلّغ الصفحة', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementation(() => okJson({ ...template, id: 'tpl-2', version: 1, isActive: false }))
    global.fetch = fetchMock as unknown as typeof fetch
    const onChanged = jest.fn()

    render(
      <NotificationTemplateActions template={template} destinations={[]} onChanged={onChanged} />,
    )
    fireEvent.click(screen.getByText('نسخ'))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/templates/tpl-1/clone',
      expect.objectContaining({ method: 'POST' }),
    )
    // أزرار دورة الحياة تبقى متاحة بعد النجاح
    expect(screen.getByText('تحقق')).toBeTruthy()
  })

  it('فشل الشبكة يظهر رسالة عربية ولا يُسقط المكوّن', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('NetworkError')) as unknown as typeof fetch

    render(<NotificationTemplateActions template={template} destinations={[]} />)
    fireEvent.click(screen.getByText('معاينة'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent || '').toContain('تعذّر الاتصال')
    // ما زالت الأزرار موجودة بعد الفشل
    expect(screen.getByText('نشر وتفعيل')).toBeTruthy()
  })

  it('أخطاء غير عربية من الخادم تُترجم إلى رسالة عربية', async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(() =>
        errJson(500, { error: { message: 'Internal server error' } }),
      ) as unknown as typeof fetch

    render(<NotificationTemplateActions template={template} destinations={[]} />)
    fireEvent.click(screen.getByText('إصدارات'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect((screen.getByRole('alert').textContent || '').length).toBeGreaterThan(0)
    expect(screen.getByRole('alert').textContent || '').not.toContain('Internal server error')
  })
})
