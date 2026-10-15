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
 * ملاحظة: صفحات منشورات/قوالب تيليجرام تُسجَّل مع هبوط مسارات W3 فقط — لا
 * نُسجّل صفحات غير موجودة (كانت روابط ميتة تصل للـ 404 ومنح صلاحية لصفحة
 * مفقودة). هذه الاختبارات تثبّت الحالة الفعلية المُشحَنة.
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

  it('لا يسجّل صفحات منشورات/قوالب تيليجرام قبل وجود مساراتها (لا صفحات ميتة)', () => {
    expect(ADMIN_PAGES_FLAT.find((d) => d.key === 'social-telegram-posts')).toBeUndefined()
    expect(ADMIN_PAGES_FLAT.find((d) => d.key === 'social-telegram-templates')).toBeUndefined()
  })

  it('يضعها داخل مجموعة السوشيال ميديا', () => {
    const group = ADMIN_PAGES_FLAT.filter((d) => d.key.startsWith('social'))
    // 3 صفحات مسجّلة فعلاً: لمحة + قنوات + تيليجرام
    expect(group.length).toBe(3)
  })
})

describe('findPageForPath على شجرة السوشيال', () => {
  it('ينسب المسارات المتداخلة لأطول بادئة مُسجَّلة', () => {
    expect(findPageForPath('/admin/social')?.key).toBe('social')
    expect(findPageForPath('/admin/social/channels')?.key).toBe('social-channels')
    expect(findPageForPath('/admin/social/telegram')?.key).toBe('social-telegram')
    // لا صفحة منشورات/قوالب مُسجَّلة بعد ⇒ تُنسب لصفحة المركز (أطول بادئة).
    expect(findPageForPath('/admin/social/telegram/posts')?.key).toBe('social-telegram')
  })

  it('ينسب الصفحات الفرعية غير المسجّلة لصفحة المركز', () => {
    expect(findPageForPath('/admin/social/telegram/posts/new')?.key).toBe('social-telegram')
    expect(findPageForPath('/admin/social/telegram/posts/abc123')?.key).toBe('social-telegram')
    expect(findPageForPath('/admin/social/telegram/templates')?.key).toBe('social-telegram')
  })

  it('ينسب مسارات الـ API لصفحتها المناظرة', () => {
    const toPage = (api: string) => {
      const adminPath = apiPathToAdminPath(api)
      return adminPath ? findPageForPath(adminPath)?.key : null
    }
    expect(toPage('/api/admin/social/overview')).toBe('social')
    expect(toPage('/api/admin/social/stats')).toBe('social')
    // مسارات منشورات/قوالب تُنسب لصفحة المركز حتى تُسجّل صفحاتها مع W3.
    expect(toPage('/api/admin/social/telegram/posts')).toBe('social-telegram')
    expect(toPage('/api/admin/social/telegram/templates')).toBe('social-telegram')
  })
})

describe('roleSeesPageByDefault', () => {
  it('يمنح admin صفحات اللمحة/المركز', () => {
    expect(roleSeesPageByDefault('admin', page('social'))).toBe(true)
    expect(roleSeesPageByDefault('admin', page('social-channels'))).toBe(true)
    expect(roleSeesPageByDefault('admin', page('social-telegram'))).toBe(true)
  })

  it('لا يمنح moderator أي صفحة من المركز', () => {
    for (const key of ['social', 'social-channels', 'social-telegram']) {
      expect(roleSeesPageByDefault('moderator', page(key))).toBe(false)
    }
  })
})
