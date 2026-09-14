/**
 * Tests for platform-specific mod fields (SA-3).
 * Offline: validates CreateModSchema accepts the 14 new optional fields
 * and that serialize() passes them through (API returns full row, no whitelist).
 */
import { serialize } from '@/lib/api-utils'
import { CreateModSchema } from '@/lib/schemas'
import type { ModDetail } from '@/lib/types'

const BASE_MOD = {
  name: 'Test Mod',
  description: 'وصف كافٍ للاختبار هنا 12345',
  thumbnailUrl: 'https://example.com/t.jpg',
  imageUrl: 'https://example.com/b.jpg',
}

describe('platform-specific mod fields', () => {
  it('CreateModSchema accepts all 14 platform fields as optional strings', () => {
    const parsed = CreateModSchema.safeParse({
      ...BASE_MOD,
      translationMethod: 'بشري',
      platformGameId: 'SCUS-94426',
      cusaId: 'CUSA-00123',
      ppsaId: 'PPSA-00001',
      titleId: '010042D00D900000',
      mediaId: 'MEDIA-1',
      supportedFormat: 'GOD',
      systemFirmware: '11.00',
      gameUpdateVersion: '1.02',
      deviceModel: 'NS1',
      installType: 'APK',
      cpuArch: 'ARM64',
      gameVersion: '2.5.1',
      minAndroidVersion: '8.0',
    })
    expect(parsed.success).toBe(true)
  })

  it('CreateModSchema still passes without any platform fields', () => {
    expect(CreateModSchema.safeParse(BASE_MOD).success).toBe(true)
  })

  it('serialize() passes platform fields through (no API whitelist)', () => {
    const row = {
      id: 'm1',
      slug: 'test-mod',
      translationMethod: 'بشري',
      platformGameId: null,
      cusaId: 'CUSA-00123',
      ppsaId: null,
      titleId: null,
      mediaId: null,
      supportedFormat: null,
      systemFirmware: '9.00',
      gameUpdateVersion: '1.05',
      deviceModel: null,
      installType: null,
      cpuArch: null,
      gameVersion: null,
      minAndroidVersion: null,
      game: { name: 'Game', slug: 'game', platform: 'PS4' },
    }
    const out = serialize(row)
    expect(out.cusaId).toBe('CUSA-00123')
    expect(out.systemFirmware).toBe('9.00')
    expect(out.game.platform).toBe('PS4')
  })

  it('ModDetail type carries platform fields + game.platform', () => {
    const mod = {
      platformGameId: 'SCUS-94426',
      game: { platform: 'PS1' },
    } as Pick<ModDetail, 'platformGameId'> & { game: { platform: string } }
    expect(mod.platformGameId).toBe('SCUS-94426')
    expect(mod.game.platform).toBe('PS1')
  })
})
