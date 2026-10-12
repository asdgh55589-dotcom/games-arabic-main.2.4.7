import {
  ADMIN_SOCIAL_PLATFORMS,
  getAdminSocialPlatform,
  isPlatformActive,
  platformStatusLabel,
} from '@/components/admin/social/platform-card'

describe('platform-card registry', () => {
  it('ينشئ مرآة عرض للمنصات الثلاث المخططة', () => {
    expect(ADMIN_SOCIAL_PLATFORMS.map((p) => p.key).sort()).toEqual([
      'facebook',
      'telegram',
      'youtube',
    ])
  })

  it('تيليجرام نشطة وتملك رابط إدارة، ولا روابط ميتة للمنصات القادمة', () => {
    const telegram = getAdminSocialPlatform('telegram')
    expect(telegram?.status).toBe('active')
    expect(telegram?.href).toBe('/admin/social/telegram')
    expect(telegram && isPlatformActive(telegram)).toBe(true)

    for (const key of ['facebook', 'youtube']) {
      const platform = getAdminSocialPlatform(key)
      expect(platform?.status).toBe('coming_soon')
      expect(platform?.href).toBeNull()
      expect(platform && isPlatformActive(platform)).toBe(false)
    }
  })

  it('تُرجع undefined لمفتاح غير معروف وتُنسّق الحالة بالعربية', () => {
    expect(getAdminSocialPlatform('nope')).toBeUndefined()
    expect(platformStatusLabel('active')).toBe('مفعّل')
    expect(platformStatusLabel('coming_soon')).toBe('قريباً')
  })
})
