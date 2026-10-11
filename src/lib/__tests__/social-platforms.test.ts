/**
 * Social Hub A0 — سجل المنصات.
 *
 * يقفل: 3 منصات، تليجرام active، فيسبوك/يوتيوب coming_soon،
 * أفاتار المفاتيح، والاقتدار (capabilities) بلا قدرات على منصة قادمة.
 */
import {
  SOCIAL_PLATFORM_KEYS,
  SOCIAL_PLATFORMS,
  getActiveSocialPlatforms,
  getSocialPlatform,
  isSocialPlatformKey,
  type SocialPlatformKey,
} from '../social/platforms'

describe('social platform registry', () => {
  it('declares exactly three platforms', () => {
    expect(SOCIAL_PLATFORMS).toHaveLength(3)
    expect(SOCIAL_PLATFORM_KEYS).toEqual(['telegram', 'facebook', 'youtube'])
  })

  it('marks telegram active and the rest coming_soon', () => {
    expect(getSocialPlatform('telegram')?.status).toBe('active')
    expect(getSocialPlatform('facebook')?.status).toBe('coming_soon')
    expect(getSocialPlatform('youtube')?.status).toBe('coming_soon')
  })

  it('gives only telegram a working href', () => {
    expect(getSocialPlatform('telegram')?.href).toBe('/admin/social/telegram')
    expect(getSocialPlatform('facebook')?.href).toBeNull()
    expect(getSocialPlatform('youtube')?.href).toBeNull()
  })

  it('gates every capability on the platform status', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const expected = platform.status === 'active'
      expect(platform.capabilities.posts).toBe(expected)
      expect(platform.capabilities.templates).toBe(expected)
      expect(platform.capabilities.notifications).toBe(expected)
      expect(platform.capabilities.scheduling).toBe(expected)
    }
  })

  it('isSocialPlatformKey accepts known keys only', () => {
    expect(isSocialPlatformKey('telegram')).toBe(true)
    expect(isSocialPlatformKey('facebook')).toBe(true)
    expect(isSocialPlatformKey('youtube')).toBe(true)
    expect(isSocialPlatformKey('x')).toBe(false)
    expect(isSocialPlatformKey('')).toBe(false)
    expect(isSocialPlatformKey(null)).toBe(false)
    expect(isSocialPlatformKey(undefined)).toBe(false)
    expect(isSocialPlatformKey(42)).toBe(false)
  })

  it('narrows the type for known keys', () => {
    const value: unknown = 'telegram'
    if (isSocialPlatformKey(value)) {
      const key: SocialPlatformKey = value
      expect(key).toBe('telegram')
    } else {
      throw new Error('expected telegram to narrow')
    }
  })

  it('getSocialPlatform returns undefined for unknown keys', () => {
    expect(getSocialPlatform('nope')).toBeUndefined()
  })

  it('getActiveSocialPlatforms returns telegram only', () => {
    const active = getActiveSocialPlatforms()
    expect(active.map((platform) => platform.key)).toEqual(['telegram'])
  })

  it('every platform has an Arabic label and a brand colour', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(platform.labelAr.length).toBeGreaterThan(0)
      expect(platform.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
