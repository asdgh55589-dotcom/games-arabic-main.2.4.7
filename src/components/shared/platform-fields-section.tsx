// PlatformFieldsSection — shared component for admin + creator mod forms.
// Renders ONLY platform-specific ID fields (no section chrome, no title:
// the platform is already known from wizard step 1).
// طريقة التعريب + توافق التعريب live in the basic-info section for all platforms.

import { Input } from '@/components/ui/input'
import { PLATFORMS } from '@/lib/constants'
import { Field } from '@/components/creator/mod-form/primitives'

export interface PlatformFieldsValues {
  platform: string
  setPlatform: (v: string) => void
  platformGameId: string
  setPlatformGameId: (v: string) => void
  cusaId: string
  setCusaId: (v: string) => void
  ppsaId: string
  setPpsaId: (v: string) => void
  titleId: string
  setTitleId: (v: string) => void
  mediaId: string
  setMediaId: (v: string) => void
  supportedFormat: string
  setSupportedFormat: (v: string) => void
  systemFirmware: string
  setSystemFirmware: (v: string) => void
  gameUpdateVersion: string
  setGameUpdateVersion: (v: string) => void
  deviceModel: string
  setDeviceModel: (v: string) => void
  installType: string
  setInstallType: (v: string) => void
  cpuArch: string
  setCpuArch: (v: string) => void
  gameVersion: string
  setGameVersion: (v: string) => void
  minAndroidVersion: string
  setMinAndroidVersion: (v: string) => void
  compatibility: string
  setCompatibility: (v: string) => void
  /** When true, the platform dropdown is hidden (platform chosen in wizard step 1). */
  hidePlatformSelect?: boolean
}

const XBOX_FORMATS = ['GOD', 'JTAG', 'RGH', 'ISO', 'XEX']
const ANDROID_INSTALL_TYPES = ['APK مدمج', 'ملفات OBB', 'مجلد Data']
const ANDROID_CPU_ARCHS = ['ARM64', 'ARMv7', 'x86']

export function PlatformFieldsSection(p: PlatformFieldsValues) {
  const pl = p.platform

  return (
    <>
      {!p.hidePlatformSelect && (
        <Field label="المنصة" hint="اختر منصة اللعبة لإظهار الحقول المناسبة">
          <select
            value={p.platform}
            onChange={(e) => p.setPlatform(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">— اختر المنصة —</option>
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.arabicLabel}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* ===== PS1 / PS2: معرّف اللعبة يظهر في المعلومات الأساسية بدل توافق التعريب ===== */}

      {/* ===== PS3: حقوله في المعلومات الأساسية بدل توافق التعريب ===== */}

      {/* ===== PS4: حقوله في المعلومات الأساسية بدل توافق التعريب ===== */}

      {/* ===== PS5: حقوله في المعلومات الأساسية بدل توافق التعريب ===== */}

      {/* ===== NS: حقوله في المعلومات الأساسية بدل توافق التعريب ===== */}

      {/* ===== Android: حقوله في المعلومات الأساسية بدل توافق التعريب ===== */}
    </>
  )
}
