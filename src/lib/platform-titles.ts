/**
 * Per-platform mod detail titles (owner-approved, LOCKED).
 *
 * Shared 7 titles (every platform, fixed order):
 *  1. العنوان  2. العنوان بالعربي  3. طريقة التعريب  4. نوع التعريب
 *  5. محتوى التعريب  6. تاريخ إصدار التعريب  7. حجم التعريب
 *
 * PC inserts "توافق التعريب" between تاريخ الإصدار and الحجم (spec order:
 * العنوان، العنوان بالعربي، طريقة التعريب، نوع التعريب، محتوى التعريب،
 * تاريخ إصدار التعريب، توافق التعريب، حجم التعريب).
 *
 * Platform-specific extras render ONLY for their platform, in spec order.
 * Empty/null values are skipped (except always-shown fallbacks).
 */

export type PlatformKey =
  | 'PC'
  | 'PS1'
  | 'PS2'
  | 'PS3'
  | 'PS4'
  | 'PS5'
  | 'NS'
  | 'X360'
  | 'ANDROID'
  | 'OTHER'

export interface TitleItem {
  key: string
  label: string
  value: string
}

/** Minimal mod shape needed for title resolution (subset of ModDetail). */
export interface PlatformMod {
  game: { name: string; platform: string }
  arabicTitle?: string | null
  translationMethod?: string | null
  translationType?: string | null
  translationScope?: string | null
  releaseDate: string | Date
  fileSize?: string | null
  fileFormat?: string | null
  compatibility?: string | null
  platformGameId?: string | null
  cusaId?: string | null
  ppsaId?: string | null
  titleId?: string | null
  mediaId?: string | null
  supportedFormat?: string | null
  systemFirmware?: string | null
  gameUpdateVersion?: string | null
  deviceModel?: string | null
  installType?: string | null
  cpuArch?: string | null
  gameVersion?: string | null
  minAndroidVersion?: string | null
}

export function getPlatformKey(platform?: string | null): PlatformKey {
  const p = (platform || '').toUpperCase()
  if (
    p === 'PC' ||
    p === 'PS1' ||
    p === 'PS2' ||
    p === 'PS3' ||
    p === 'PS4' ||
    p === 'PS5' ||
    p === 'NS' ||
    p === 'X360' ||
    p === 'ANDROID'
  ) {
    return p
  }
  return 'OTHER'
}

function nonEmpty(v?: string | null): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

/**
 * Returns the ORDERED list of {key,label,value} titles for a mod.
 * formatDate formats releaseDate (caller passes formatArabicDate).
 */
export function getModTitles(
  mod: PlatformMod,
  formatDate: (d: string | Date) => string,
): TitleItem[] {
  const items: TitleItem[] = []
  const push = (key: string, label: string, value: string) => {
    items.push({ key, label, value })
  }
  const pushIf = (key: string, label: string, v?: string | null) => {
    if (nonEmpty(v)) push(key, label, (v as string).trim())
  }

  // ---- 7 shared titles (fixed order) ----
  push('title', 'العنوان', mod.game.name)
  pushIf('titleAr', 'العنوان بالعربي', mod.arabicTitle)
  push(
    'method',
    'طريقة التعريب',
    nonEmpty(mod.translationMethod) ? (mod.translationMethod as string).trim() : 'غير محدد',
  )
  push(
    'type',
    'نوع التعريب',
    nonEmpty(mod.translationType) ? (mod.translationType as string).trim() : 'غير محدد',
  )
  pushIf('content', 'محتوى التعريب', mod.translationScope)
  push('releaseDate', 'تاريخ إصدار التعريب', formatDate(mod.releaseDate))
  // حجم التعريب — يُعرض أخيراً دائماً، لكن في PC يأتي بعد "توافق التعريب"
  // حسب الترتيب المعتمد (تاريخ الإصدار ← التوافق ← الحجم).
  const platform = getPlatformKey(mod.game.platform)
  let sizeStr: string | null = null
  if (nonEmpty(mod.fileSize)) {
    const size = (mod.fileSize as string).trim()
    const fmt = nonEmpty(mod.fileFormat) ? ` .${(mod.fileFormat as string).trim()}` : ''
    sizeStr = `${size}${fmt}`
  }
  if (platform !== 'PC' && sizeStr) {
    push('size', 'حجم التعريب', sizeStr)
  }

  // ---- platform-specific extras (spec order, skip when empty) ----
  switch (platform) {
    case 'PS1':
    case 'PS2':
      pushIf('gameId', 'معرّف اللعبة (Game ID)', mod.platformGameId)
      break
    case 'PS3':
      pushIf('gameId', 'معرّف اللعبة', mod.platformGameId)
      pushIf('gameUpdate', 'رقم تحديث اللعبة المتوافق', mod.gameUpdateVersion)
      break
    case 'PS4':
      pushIf('cusa', 'معرّف اللعبة (CUSA)', mod.cusaId)
      pushIf('firmware', 'تحديث النظام المتوافق', mod.systemFirmware)
      pushIf('gameUpdate', 'رقم تحديث اللعبة المتوافق', mod.gameUpdateVersion)
      break
    case 'PS5':
      pushIf('ppsa', 'معرّف اللعبة (PPSA)', mod.ppsaId)
      pushIf('firmware', 'تحديث النظام المتوافق', mod.systemFirmware)
      pushIf('gameUpdate', 'رقم تحديث اللعبة المتوافق', mod.gameUpdateVersion)
      break
    case 'NS':
      pushIf('titleId', 'إصدار اللعبة', mod.titleId)
      pushIf('device', 'الجهاز', mod.deviceModel)
      pushIf('gameUpdate', 'رقم التحديث المتوافق', mod.gameUpdateVersion)
      break
    case 'X360':
      pushIf('titleId', 'معرّف اللعبة (Title ID)', mod.titleId)
      pushIf('mediaId', 'معرّف الوسائط (Media ID)', mod.mediaId)
      pushIf('format', 'صيغة اللعبة المدعومة', mod.supportedFormat)
      pushIf('compat', 'التوافق', mod.compatibility)
      break
    case 'ANDROID':
      pushIf('installType', 'نوع ملف التثبيت', mod.installType)
      pushIf('cpu', 'بنية المعالج المتوافقة', mod.cpuArch)
      pushIf('gameVersion', 'رقم إصدار اللعبة المتوافق', mod.gameVersion)
      pushIf('minAndroid', 'الحد الأدنى لنظام الأندرويد', mod.minAndroidVersion)
      break
    case 'PC':
      pushIf('compat', 'توافق التعريب', mod.compatibility)
      if (sizeStr) push('size', 'حجم التعريب', sizeStr)
      break
    case 'OTHER':
    default:
      break
  }

  return items
}
