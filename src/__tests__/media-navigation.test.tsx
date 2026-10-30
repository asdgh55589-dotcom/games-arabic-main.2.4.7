import { ADMIN_PAGE_GROUPS, ADMIN_PAGES_FLAT, roleSeesPageByDefault } from '@/lib/admin-pages'

describe('navigation: إدارة الميديا group', () => {
  it('registers the 5-item media group', () => {
    const group = ADMIN_PAGE_GROUPS.find((g) => g.label === 'إدارة الميديا')
    expect(group).toBeDefined()
    expect(group!.pages).toHaveLength(5)
    expect(group!.pages.map((p) => p.href)).toEqual([
      '/admin/media',
      '/admin/media/assets',
      '/admin/media/channels',
      '/admin/media/publish',
      '/admin/media/reports',
    ])
    expect(group!.pages.map((p) => p.key)).toEqual([
      'media',
      'media-assets',
      'media-channels',
      'media-publish',
      'media-reports',
    ])
  })

  it('sets minRole correctly', () => {
    const byHref = (h: string) => ADMIN_PAGES_FLAT.find((p) => p.href === h)!
    expect(byHref('/admin/media').minRole).toBe('admin')
    expect(byHref('/admin/media/assets').minRole).toBe('manager')
    expect(byHref('/admin/media/channels').minRole).toBe('admin')
    expect(byHref('/admin/media/publish').minRole).toBe('manager')
    expect(byHref('/admin/media/reports').minRole).toBe('admin')
  })

  it('removed old groups', () => {
    const labels = ADMIN_PAGE_GROUPS.map((g) => g.label)
    expect(labels).not.toContain('السوشيال ميديا')
    expect(labels).not.toContain('النشر المجدول')
  })

  it('role visibility', () => {
    const page = (k: string) => ADMIN_PAGES_FLAT.find((p) => p.key === k)!
    expect(roleSeesPageByDefault('admin', page('media'))).toBe(true)
    expect(roleSeesPageByDefault('moderator', page('media'))).toBe(false)
  })
})
