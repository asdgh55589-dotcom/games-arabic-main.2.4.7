/**
 * lib/social/platforms.ts — سجل منصات Social Hub.
 *
 * المنصات تُعرَّف في الكود لا في قاعدة البيانات (قرار D1): لا يوجد كيان
 * منصة يحتاج تعديلاً وقت التشغيل، والتعريف في الكود يبسّط الصلاحيات
 * والترجمة. فيسبوك/يوتيوب تبقى `coming_soon` حتى تنفيذهما فعلياً.
 *
 * لا علاقة لهذا الملف بـ `lib/social-platforms.ts` القديم (روابط بروفايل
 * المستخدم X/IG/TikTok/…) — أسماء متقاربة عمدًا لتفادي التصادم.
 */

export const SOCIAL_PLATFORM_KEYS = ['telegram', 'facebook', 'youtube'] as const
export type SocialPlatformKey = (typeof SOCIAL_PLATFORM_KEYS)[number]

export interface SocialPlatformCapabilities {
  posts: boolean
  templates: boolean
  notifications: boolean
  scheduling: boolean
}

export interface SocialPlatformDef {
  key: SocialPlatformKey
  labelAr: string
  status: 'active' | 'coming_soon'
  href: string | null
  /** لون العلامة — يُستخدم في بطاقة المنصة. */
  color: string
  capabilities: SocialPlatformCapabilities
}

export const SOCIAL_PLATFORMS: readonly SocialPlatformDef[] = [
  {
    key: 'telegram',
    labelAr: 'تليجرام',
    status: 'active',
    href: '/admin/social/telegram',
    color: '#229ED9',
    capabilities: { posts: true, templates: true, notifications: true, scheduling: true },
  },
  {
    key: 'facebook',
    labelAr: 'فيسبوك',
    status: 'coming_soon',
    href: null,
    color: '#1877F2',
    capabilities: { posts: false, templates: false, notifications: false, scheduling: false },
  },
  {
    key: 'youtube',
    labelAr: 'يوتيوب',
    status: 'coming_soon',
    href: null,
    color: '#FF0000',
    capabilities: { posts: false, templates: false, notifications: false, scheduling: false },
  },
] as const

/** مفتاح منصة معروف؟ */
export function isSocialPlatformKey(value: unknown): value is SocialPlatformKey {
  return typeof value === 'string' && (SOCIAL_PLATFORM_KEYS as readonly string[]).includes(value)
}

/** تعريف منصة بالمفتاح — `undefined` لمفتاح غير معروف. */
export function getSocialPlatform(key: string): SocialPlatformDef | undefined {
  return SOCIAL_PLATFORMS.find((platform) => platform.key === key)
}

/** المنصات النشطة فقط (تليجرام حالياً). */
export function getActiveSocialPlatforms(): SocialPlatformDef[] {
  return SOCIAL_PLATFORMS.filter((platform) => platform.status === 'active')
}
