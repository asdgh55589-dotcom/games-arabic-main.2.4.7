import {
  ADMIN_PAGES_FLAT,
  apiPathToAdminPath,
  findPageForPath,
  roleSeesPageByDefault,
} from '@/lib/admin-pages'

/**
 * B0 — تسجيل صفحات مركز السوشيال ميديا في السجل المركزي.
 *
 * الخطر المتكرر (خطة §1.1): تُضاف صفحة للقائمة الجانبية بلا سجل، فينكسر فحص
 * proxy أو تنزلق الصلاحيات. هذه الاختبارات تثبّت المفاتيح والرتب الدنيا وتؤكد
 * أن مسارات الـ API تُنسب للصفحة الصحيحة.
 *
 * ملاحظة: صفحتا منشورات/قوالب تيليجرام (W3) مُسجَّلتان برتبة manager بعد هبوط
 * مساراتهما — فحص «صفحة موجودة فعلاً» ما زال مطبّقاً: أي صفحة تُضاف للسجل
 * لازم يكون لها route في الشجرة قبل التسجيل.
 */

function page(key: string) {
  const def = ADMIN_PAGES_FLAT.find((d) => d.key === key)
  if (!def) throw new Error(`صفحة مفقودة: ${key}`)
  return def
}

describe('سجل صفحات السوشيال ميديا', () => {
  it('يسجّل صفحات اللمحة/المركز برتبة admin', () => {
    expect(page('social').href).toBe('/admin/social')
    expect(page('social').minRole).toBe('admin')
    expect(page('social-channels').href).toBe('/admin/social/channels')
    expect(page('social-channels').minRole).toBe('admin')
    expect(page('social-telegram').href).toBe('/admin/social/telegram')
    expect(page('social-telegram').minRole).toBe('admin')
  })

  it('يسجّل صفحات منشورات/قوالب تيليجرام برتبة manager بعد هبوط W3', () => {
    expect(page('social-telegram-posts').href).toBe('/admin/social/telegram/posts')
    expect(page('social-telegram-posts').minRole).toBe('manager')
    expect(page('social-telegram-templates').href).toBe('/admin/social/telegram/templates')
    expect(page('social-telegram-templates').minRole).toBe('manager')
  })

  it('يضعها داخل مجموعة السوشيال ميديا', () => {
    const group = ADMIN_PAGES_FLAT.filter((d) => d.key.startsWith('social'))
    // 5 صفحات مسجّلة فعلاً: لمحة + قنوات + تيليجرام + منشورات + قوالب
    expect(group.length).toBe(5)
  })
})

describe('findPageForPath على شجرة السوشيال', () => {
  it('ينسب المسارات المتداخلة لأطول بادئة مُسجَّلة', () => {
    expect(findPageForPath('/admin/social')?.key).toBe('social')
    expect(findPageForPath('/admin/social/channels')?.key).toBe('social-channels')
    expect(findPageForPath('/admin/social/telegram')?.key).toBe('social-telegram')
    // صفحات W3 مُسجَّلة الآن ⇒ مسار المنشورات/القوالب نفسه يذهب لصفحته.
    expect(findPageForPath('/admin/social/telegram/posts')?.key).toBe('social-telegram-posts')
    expect(findPageForPath('/admin/social/telegram/templates')?.key).toBe(
      'social-telegram-templates',
    )
  })

  it('ينسب الصفحات الفرعية غير المسجّلة لأطول بادئة', () => {
    expect(findPageForPath('/admin/social/telegram/posts/new')?.key).toBe('social-telegram-posts')
    expect(findPageForPath('/admin/social/telegram/posts/abc123')?.key).toBe(
      'social-telegram-posts',
    )
    // مسار تيليجرام غير مُسجَّل يبقى تحت صفحة المركز.
    expect(findPageForPath('/admin/social/telegram/other')?.key).toBe('social-telegram')
  })

  it('ينسب مسارات الـ API لصفحتها المناظرة', () => {
    const toPage = (api: string) => {
      const adminPath = apiPathToAdminPath(api)
      return adminPath ? findPageForPath(adminPath)?.key : null
    }
    expect(toPage('/api/admin/social/overview')).toBe('social')
    expect(toPage('/api/admin/social/stats')).toBe('social')
    // مسارات W3 تذهب لصفحتيها (manager) لا لصفحة المركز.
    expect(toPage('/api/admin/social/telegram/posts')).toBe('social-telegram-posts')
    expect(toPage('/api/admin/social/telegram/posts/abc123')).toBe('social-telegram-posts')
    expect(toPage('/api/admin/social/telegram/templates')).toBe('social-telegram-templates')
  })
})

describe('roleSeesPageByDefault', () => {
  it('يمنح admin صفحات اللمحة/المركز', () => {
    expect(roleSeesPageByDefault('admin', page('social'))).toBe(true)
    expect(roleSeesPageByDefault('admin', page('social-channels'))).toBe(true)
    expect(roleSeesPageByDefault('admin', page('social-telegram'))).toBe(true)
  })

  it('يمنح manager خمس صفحات السوشيال (المركز + منشورات + قوالب)', () => {
    for (const key of [
      'social',
      'social-channels',
      'social-telegram',
      'social-telegram-posts',
      'social-telegram-templates',
    ]) {
      expect(roleSeesPageByDefault('manager', page(key))).toBe(true)
    }
  })

  it('لا يمنح admin صفحتي المنشورات/القوالب (minRole manager)', () => {
    expect(roleSeesPageByDefault('admin', page('social-telegram-posts'))).toBe(false)
    expect(roleSeesPageByDefault('admin', page('social-telegram-templates'))).toBe(false)
  })

  it('لا يمنح moderator أي صفحة من المركز', () => {
    for (const key of [
      'social',
      'social-channels',
      'social-telegram',
      'social-telegram-posts',
      'social-telegram-templates',
    ]) {
      expect(roleSeesPageByDefault('moderator', page(key))).toBe(false)
    }
  })
})
