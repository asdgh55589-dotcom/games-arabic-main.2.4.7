/**
 * @jest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { ModFormHeader } from '@/components/creator/mod-form/header'

afterEach(() => cleanup())

const base = {
  breadcrumbHref: '/creator/mods',
  breadcrumbLabel: 'تعريب',
  currentLabel: 'تعريب جديد',
  dir: 'rtl',
  isEdit: false,
  step: 2,
  platform: 'PS4',
  saving: false,
  loadError: null,
  onSave: jest.fn(),
  saveLabel: 'نشر التعريب',
  cancelHref: '/creator/mods',
  cancelLabel: 'إلغاء',
}

describe('ModFormHeader (unified creator + admin)', () => {
  it('renders breadcrumb + all action buttons when platform chosen', () => {
    render(<ModFormHeader {...base} />)
    expect(screen.getByText('تعريب')).toBeTruthy()
    expect(screen.getByText('تعريب جديد')).toBeTruthy()
    expect(screen.getByText('نشر التعريب')).toBeTruthy()
    expect(screen.getByText('تعبئة ذكية').closest('a')?.getAttribute('href')).toBe(
      '/creator/ai-fill?platform=PS4',
    )
    expect(screen.getByText('تحسين نصوص ذكية').closest('a')?.getAttribute('href')).toBe(
      '/creator/polish',
    )
    expect(screen.getByText('إلغاء')).toBeTruthy()
  })

  it('hides smart-fill until a platform is chosen; polish always visible', () => {
    const { unmount } = render(<ModFormHeader {...base} platform="" step={1} />)
    expect(screen.queryByText('تعبئة ذكية')).toBeNull()
    expect(screen.getByText('تحسين نصوص ذكية')).toBeTruthy()
    expect(screen.queryByText('نشر التعريب')).toBeNull()
    unmount()
  })

  it('shows change-platform only when handler provided (creator new flow)', () => {
    const { unmount } = render(<ModFormHeader {...base} />)
    expect(screen.queryByText('تغيير المنصة')).toBeNull()
    unmount()
    render(<ModFormHeader {...base} onBackToStep1={jest.fn()} />)
    expect(screen.getByText('تغيير المنصة')).toBeTruthy()
  })
})
