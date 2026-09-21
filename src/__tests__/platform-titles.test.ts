/**
 * Per-platform mod detail titles (SA-4) — owner-approved lists.
 * Verifies exact label sets + order for all 9 platforms, empty-value
 * skipping, no cross-platform leakage, and unknown-platform fallback.
 */
import { getModTitles, getPlatformKey, type PlatformMod } from '@/lib/platform-titles'

const fmt = (d: string | Date) => `DATE:${typeof d === 'string' ? d : d.toISOString()}`

function fullMod(platform: string): PlatformMod {
  return {
    game: { name: 'Game EN', platform },
    arabicTitle: 'لعبة عربي',
    translationMethod: 'بشري',
    translationType: 'نصي',
    translationScope: 'قوائم، حوارات',
    releaseDate: '2026-01-01',
    fileSize: '200',
    fileFormat: 'zip',
    compatibility: 'JTAG',
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
  }
}

const SHARED = [
  'العنوان',
  'العنوان بالعربي',
  'طريقة التعريب',
  'نوع التعريب',
  'محتوى التعريب',
  'تاريخ إصدار التعريب',
  'حجم التعريب',
]

const labels = (platform: string) => getModTitles(fullMod(platform), fmt).map((t) => t.label)

describe('getPlatformKey', () => {
  it.each(['pc', 'Pc', 'PC'])('normalizes %s to PC', (p) => {
    expect(getPlatformKey(p)).toBe('PC')
  })
  it('returns OTHER for unknown platforms', () => {
    expect(getPlatformKey('PS9')).toBe('OTHER')
    expect(getPlatformKey(null)).toBe('OTHER')
    expect(getPlatformKey(undefined)).toBe('OTHER')
  })
})

describe('per-platform title lists', () => {
  it('PC adds توافق التعريب before size', () => {
    expect(labels('PC')).toEqual([
      'العنوان',
      'العنوان بالعربي',
      'طريقة التعريب',
      'نوع التعريب',
      'محتوى التعريب',
      'تاريخ إصدار التعريب',
      'توافق التعريب',
      'حجم التعريب',
    ])
  })
  it('PS1 and PS2 add معرّف اللعبة (Game ID)', () => {
    expect(labels('PS1')).toEqual([...SHARED, 'معرّف اللعبة (Game ID)'])
    expect(labels('PS2')).toEqual([...SHARED, 'معرّف اللعبة (Game ID)'])
  })
  it('PS3 adds Game ID + game update', () => {
    expect(labels('PS3')).toEqual([...SHARED, 'معرّف اللعبة', 'رقم تحديث اللعبة المتوافق'])
  })
  it('PS4 adds CUSA + firmware + game update', () => {
    expect(labels('PS4')).toEqual([
      ...SHARED,
      'معرّف اللعبة (CUSA)',
      'تحديث النظام المتوافق',
      'رقم تحديث اللعبة المتوافق',
    ])
  })
  it('PS5 adds PPSA + firmware + game update', () => {
    expect(labels('PS5')).toEqual([
      ...SHARED,
      'معرّف اللعبة (PPSA)',
      'تحديث النظام المتوافق',
      'رقم تحديث اللعبة المتوافق',
    ])
  })
  it('Switch adds Title ID + device + update number', () => {
    expect(labels('NS')).toEqual([
      ...SHARED,
      'إصدار اللعبة',
      'الجهاز',
      'رقم التحديث المتوافق',
    ])
  })
  it('Xbox 360 adds Title ID + Media ID + format + compat', () => {
    expect(labels('X360')).toEqual([
      ...SHARED,
      'معرّف اللعبة (Title ID)',
      'معرّف الوسائط (Media ID)',
      'صيغة اللعبة المدعومة',
      'التوافق',
    ])
  })
  it('Android adds install type + cpu + game version + min android', () => {
    expect(labels('ANDROID')).toEqual([
      ...SHARED,
      'نوع ملف التثبيت',
      'بنية المعالج المتوافقة',
      'رقم إصدار اللعبة المتوافق',
      'الحد الأدنى لنظام الأندرويد',
    ])
  })
  it('unknown platform falls back to 7 shared only', () => {
    expect(labels('PS9')).toEqual(SHARED)
  })
})

describe('values', () => {
  it('maps values from the correct fields', () => {
    const items = getModTitles(fullMod('PS4'), fmt)
    const byLabel = Object.fromEntries(items.map((t) => [t.label, t.value]))
    expect(byLabel['العنوان']).toBe('Game EN')
    expect(byLabel['العنوان بالعربي']).toBe('لعبة عربي')
    expect(byLabel['طريقة التعريب']).toBe('بشري')
    expect(byLabel['نوع التعريب']).toBe('نصي')
    expect(byLabel['محتوى التعريب']).toBe('قوائم، حوارات')
    expect(byLabel['تاريخ إصدار التعريب']).toBe('DATE:2026-01-01')
    expect(byLabel['حجم التعريب']).toBe('200 .zip')
    expect(byLabel['معرّف اللعبة (CUSA)']).toBe('CUSA-00123')
  })
  it('falls back to غير محدد for missing method/type', () => {
    const mod = fullMod('PC')
    delete (mod as Partial<PlatformMod>).translationMethod
    delete (mod as Partial<PlatformMod>).translationType
    const byLabel = Object.fromEntries(getModTitles(mod, fmt).map((t) => [t.label, t.value]))
    expect(byLabel['طريقة التعريب']).toBe('غير محدد')
    expect(byLabel['نوع التعريب']).toBe('غير محدد')
  })
})

describe('empty-value skipping', () => {
  it('skips optional shared + extras when empty', () => {
    const mod: PlatformMod = {
      game: { name: 'G', platform: 'PS5' },
      releaseDate: '2026-01-01',
      arabicTitle: '  ',
      translationScope: null,
      fileSize: '',
      ppsaId: null,
      systemFirmware: '   ',
      gameUpdateVersion: undefined,
    }
    expect(getModTitles(mod, fmt).map((t) => t.label)).toEqual([
      'العنوان',
      'طريقة التعريب',
      'نوع التعريب',
      'تاريخ إصدار التعريب',
    ])
  })
})

describe('no cross-platform leakage', () => {
  it('PS4 mod shows no Android/Switch/Xbox labels', () => {
    const l = labels('PS4')
    for (const bad of [
      'نوع ملف التثبيت',
      'بنية المعالج المتوافقة',
      'إصدار اللعبة',
      'الجهاز',
      'معرّف اللعبة (Title ID)',
      'معرّف اللعبة (PPSA)',
      'معرّف اللعبة',
    ]) {
      expect(l).not.toContain(bad)
    }
  })
  it('Android mod shows no console labels', () => {
    const l = labels('ANDROID')
    for (const bad of [
      'معرّف اللعبة (CUSA)',
      'معرّف اللعبة (PPSA)',
      'تحديث النظام المتوافق',
      'إصدار اللعبة',
      'التوافق',
    ]) {
      expect(l).not.toContain(bad)
    }
  })
})
