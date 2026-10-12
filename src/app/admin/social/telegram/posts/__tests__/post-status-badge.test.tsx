/**
 * @jest-environment jsdom
 *
 * اختبار شارة حالة المنشور (C1) — درس P4: الشارة لا تطبع `undefined` أبداً
 * حتى مع status غائب أو قيم غير معروفة.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { PostStatusBadge } from '@/components/admin/social/post-status-badge'

afterEach(cleanup)

describe('PostStatusBadge', () => {
  it('يعرض التسمية العربية للحالات المعروفة', () => {
    render(<PostStatusBadge status="draft" />)
    expect(screen.getByText('مسودة')).toBeTruthy()
  })

  it('يعرض «منشور» للحالة المنشورة', () => {
    render(<PostStatusBadge status="published" />)
    expect(screen.getByText('منشور')).toBeTruthy()
  })

  it('status=undefined لا يطبع undefined أبداً', () => {
    const { container } = render(<PostStatusBadge />)
    const text = container.textContent || ''
    expect(text).not.toContain('undefined')
    expect(text.trim().length).toBeGreaterThan(0)
  })

  it('status=null لا يطبع null أبداً', () => {
    const { container } = render(<PostStatusBadge status={null} />)
    const text = container.textContent || ''
    expect(text).not.toContain('null')
    expect(text).not.toContain('undefined')
  })

  it('قيمة مجهولة تعرض نفسها بدل الفراغ', () => {
    render(<PostStatusBadge status="pending_review" />)
    expect(screen.getByText('pending_review')).toBeTruthy()
  })

  it('جميع الحالات الست تطبع نصاً غير فارغ', () => {
    for (const status of ['draft', 'scheduled', 'publishing', 'published', 'failed', 'canceled']) {
      const { container, unmount } = render(<PostStatusBadge status={status} />)
      const text = (container.textContent || '').trim()
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toContain('undefined')
      unmount()
    }
  })
})
