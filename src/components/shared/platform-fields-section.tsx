// PlatformFieldsSection — shared component for admin + creator mod forms.
// Shows translationMethod (all platforms) + conditional platform-specific fields.

import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { PLATFORMS } from '@/lib/constants'
import { PLATFORM_ARABIC } from '@/lib/constants'
import { Field, Section } from '@/components/creator/mod-form/primitives'

export interface PlatformFieldsValues {
  platform: string
  setPlatform: (v: string) => void
  translationMethod: string
  setTranslationMethod: (v: string) => void
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
    <Section title="حقول المنصة">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {p.hidePlatformSelect ? (
            <>المنصة: <span className="font-bold text-foreground">{PLATFORM_ARABIC[pl] || pl}</span></>
          ) : (
            <>اختر المنصة لرؤية الحقول المطلوبة.
            <Link
              href="/creator/docs"
              className="me-1 text-primary underline-offset-2 hover:underline"
            >
              اقرأ الدليل الكامل
            </Link></>
          )}
        </p>
      </div>

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

      {/* طريقة التعريب — كل المنصات */}
      <Field label="طريقة التعريب" hint="بشري / آلي / مختلط">
        <select
          value={p.translationMethod}
          onChange={(e) => p.setTranslationMethod(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">— اختر الطريقة —</option>
          <option value="بشري">بشري</option>
          <option value="آلي">آلي</option>
          <option value="مختلط">مختلط</option>
        </select>
      </Field>

      {/* ===== PS1 / PS2 ===== */}
      {(pl === 'PS1' || pl === 'PS2') && (
        <Field label="معرّف اللعبة">
          <Input
            value={p.platformGameId}
            onChange={(e) => p.setPlatformGameId(e.target.value)}
            placeholder="مثال: SCUS-94426"
          />
        </Field>
      )}

      {/* ===== PS3 ===== */}
      {pl === 'PS3' && (
        <>
          <Field label="معرّف اللعبة">
            <Input
              value={p.platformGameId}
              onChange={(e) => p.setPlatformGameId(e.target.value)}
              placeholder="مثال: BCES-01719"
            />
          </Field>
          <Field label="رقم تحديث اللعبة">
            <Input
              value={p.gameUpdateVersion}
              onChange={(e) => p.setGameUpdateVersion(e.target.value)}
              placeholder="مثال: 1.02"
            />
          </Field>
        </>
      )}

      {/* ===== PS4 ===== */}
      {pl === 'PS4' && (
        <>
          <Field label="معرّف اللعبة">
            <Input
              value={p.cusaId}
              onChange={(e) => p.setCusaId(e.target.value)}
              placeholder="مثال: CUSA-00123"
            />
          </Field>
          <Field label="تحديث النظام">
            <Input
              value={p.systemFirmware}
              onChange={(e) => p.setSystemFirmware(e.target.value)}
              placeholder="مثال: 11.00"
            />
          </Field>
          <Field label="رقم تحديث اللعبة">
            <Input
              value={p.gameUpdateVersion}
              onChange={(e) => p.setGameUpdateVersion(e.target.value)}
              placeholder="مثال: 1.02"
            />
          </Field>
        </>
      )}

      {/* ===== PS5 ===== */}
      {pl === 'PS5' && (
        <>
          <Field label="معرّف اللعبة">
            <Input
              value={p.ppsaId}
              onChange={(e) => p.setPpsaId(e.target.value)}
              placeholder="مثال: PPSA-00001"
            />
          </Field>
          <Field label="تحديث النظام">
            <Input
              value={p.systemFirmware}
              onChange={(e) => p.setSystemFirmware(e.target.value)}
              placeholder="مثال: 11.00"
            />
          </Field>
          <Field label="رقم تحديث اللعبة">
            <Input
              value={p.gameUpdateVersion}
              onChange={(e) => p.setGameUpdateVersion(e.target.value)}
              placeholder="مثال: 1.02"
            />
          </Field>
        </>
      )}

      {/* ===== Switch ===== */}
      {pl === 'NS' && (
        <>
          <Field label="إصدار اللعبة">
            <Input
              value={p.titleId}
              onChange={(e) => p.setTitleId(e.target.value)}
              placeholder="مثال: 010042D00D900000"
            />
          </Field>
          <Field label="الجهاز">
            <Input
              value={p.deviceModel}
              onChange={(e) => p.setDeviceModel(e.target.value)}
              placeholder="مثال: NS1"
            />
          </Field>
          <Field label="رقم التحديث">
            <Input
              value={p.gameUpdateVersion}
              onChange={(e) => p.setGameUpdateVersion(e.target.value)}
              placeholder="مثال: 1.0.2"
            />
          </Field>
        </>
      )}

      {/* ===== Xbox 360 ===== */}
      {pl === 'X360' && (
        <>
          <Field label="معرّف اللعبة">
            <Input
              value={p.titleId}
              onChange={(e) => p.setTitleId(e.target.value)}
              placeholder="مثال: 584111F7"
            />
          </Field>
          <Field label="معرّف الوسائط">
            <Input
              value={p.mediaId}
              onChange={(e) => p.setMediaId(e.target.value)}
              placeholder="مثال: D06D12ED"
            />
          </Field>
          <Field label="الصيغة">
            <select
              value={p.supportedFormat}
              onChange={(e) => p.setSupportedFormat(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— اختر الصيغة —</option>
              {XBOX_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="التوافق">
            <Input
              value={p.compatibility}
              onChange={(e) => p.setCompatibility(e.target.value)}
              placeholder="مثال: JTAG, RGH"
            />
          </Field>
        </>
      )}

      {/* ===== Android ===== */}
      {pl === 'ANDROID' && (
        <>
          <Field label="نوع التثبيت">
            <select
              value={p.installType}
              onChange={(e) => p.setInstallType(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— اختر النوع —</option>
              {ANDROID_INSTALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="بنية المعالج">
            <select
              value={p.cpuArch}
              onChange={(e) => p.setCpuArch(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— اختر البنية —</option>
              {ANDROID_CPU_ARCHS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="إصدار اللعبة">
            <Input
              value={p.gameVersion}
              onChange={(e) => p.setGameVersion(e.target.value)}
              placeholder="مثال: 2.5.1"
            />
          </Field>
          <Field label="الحد الأدنى للأندرويد">
            <Input
              value={p.minAndroidVersion}
              onChange={(e) => p.setMinAndroidVersion(e.target.value)}
              placeholder="مثال: 8.0"
            />
          </Field>
        </>
      )}
    </Section>
  )
}
