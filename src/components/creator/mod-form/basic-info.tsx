// ModFormBasicInfo — sections 1 (basic, unified order), install guide, changelog, tags.
// Presentational only; all state lives in the ModForm orchestrator.
// Unified order (all platforms): العنوان، العنوان بالعربي، محتوى التعريب،
// نوع التعريب، طريقة التعريب، توافق التعريب، الملخص، الوصف الكامل،
// طريقة التركيب، سجل التغييرات، الوسوم.

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { aiFillKey, parseAiFill } from '@/lib/ai/ai-fill'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import { normalizeTranslationType, TRANSLATION_TYPE_LABELS, type TranslationType } from '@/lib/schemas'
import { Field, Section, formatArabicTitle } from './primitives'

/** صيغ Xbox 360 المدعومة */
const XBOX_FORMATS = ['GOD', 'JTAG', 'RGH', 'ISO', 'XEX']

/** أنواع تثبيت أندرويد + بنيات المعالج */
const ANDROID_INSTALL_TYPES = ['APK مدمج', 'ملفات OBB', 'مجلد Data']
const ANDROID_CPU_ARCHS = ['ARM64', 'ARMv7', 'x86']

/** الحد الأقصى لعناصر محتوى التعريب المختارة من القائمة */
export const MAX_SCOPE_ITEMS = 10

/** إظهار قائمة الاختيار السريع لمحتوى التعريب — مخفية حالياً (false) والكود موجود لإعادة تفعيلها */
export const SHOW_SCOPE_PICKER = false

/** مجموعات محتوى التعريب للاختيار السريع (تُدمج في حقل النص) */
export const SCOPE_GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'القوائم والإعدادات',
    items: [
      'القائمة الرئيسية',
      'الإعدادات',
      'عناصر الواجهة والـ HUD',
      'شاشات التحميل والتحذيرات',
      'التنبيهات والرسائل المنبثقة',
      'الإنجازات والجوائز',
    ],
  },
  {
    title: 'الحوارات والنصوص المرئية',
    items: [
      'حوارات رئيسية',
      'حوارات جانبية',
      'مشاهد سينمائية',
      'المقاطع الصوتية / الفيديو',
    ],
  },
  {
    title: 'الأسلحة والمعدات',
    items: [
      'أسماء وأوصاف الأسلحة',
      'العتاد والدروع',
      'أدوات الصناعة والتطوير',
      'العناصر والمقتنيات',
    ],
  },
  {
    title: 'نصوص العالم والبيئة',
    items: [
      'أسماء الشخصيات',
      'أسماء الأماكن والمناطق',
      'اللوحات والإرشادات',
      'المستندات والمذكرات',
      'السجل والموسوعة',
    ],
  },
  {
    title: 'التعليمات والمهام',
    items: [
      'التعليمات والإرشادات',
      'الأهداف والمهام الرئيسية والجانبية',
      'شجرة المهارات والقدرات',
    ],
  },
]

function splitScope(v: string): string[] {
  return v
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** اختيار متعدد (chips) لقيم مفصولة بفواصل — يُخزن بصيغة "أ، ب" */
function MultiChips({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const selected = new Set(splitScope(value))
  const toggle = (opt: string) => {
    const next = splitScope(value)
    if (selected.has(opt)) {
      onChange(next.filter((s) => s !== opt).join('، '))
    } else {
      onChange([...next, opt].join('، '))
    }
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const checked = selected.has(opt)
        return (
          <label
            key={opt}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              checked
                ? 'border-primary bg-primary/10 font-bold text-primary'
                : 'hover:border-muted-foreground/40 hover:bg-accent'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            {opt}
          </label>
        )
      })}
    </div>
  )
}

interface Props {
  name: string
  setName: (v: string) => void
  headline: string
  setHeadline: (v: string) => void
  description: string
  setDescription: (v: string) => void
  changelog: string
  setChangelog: (v: string) => void
  installGuide: string
  setInstallGuide: (v: string) => void
  arabicTitle: string
  setArabicTitle: (v: string) => void
  translationScope: string
  setTranslationScope: (v: string) => void
  tags: string
  setTags: (v: string) => void
  translationType: TranslationType
  setTranslationType: (v: TranslationType) => void
  translationMethod: string
  setTranslationMethod: (v: string) => void
  compatibility: string
  setCompatibility: (v: string) => void
  platform: string
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
  supportedFormat: string
  setSupportedFormat: (v: string) => void
  systemFirmware: string
  setSystemFirmware: (v: string) => void
  gameUpdateVersion: string
  setGameUpdateVersion: (v: string) => void
  summary: string
  setSummary: (v: string) => void
  userRole: string
}

export function ModFormBasicInfo(p: Props) {
  const { dict } = useStudioLanguage()
  const t = dict.form
  const [aiFilled, setAiFilled] = useState(false)

  // AI fill handoff: the ai-fill tab stores approved values in
  // localStorage; applying them here keeps review in the form.
  useEffect(() => {
    if (p.platform === '') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== aiFillKey(p.platform)) return
      const values = parseAiFill(e.newValue)
      if (!values) return
      const setters: Record<string, (v: string) => void> = {
        headline: p.setHeadline,
        title: p.setName,
        arabicTitle: p.setArabicTitle,
        scope: p.setTranslationScope,
        compatibility: p.setCompatibility,
        installGuide: p.setInstallGuide,
        description: p.setDescription,
        platformGameId: p.setPlatformGameId,
        cusaId: p.setCusaId,
        ppsaId: p.setPpsaId,
        titleId: p.setTitleId,
        mediaId: p.setMediaId,
        supportedFormat: p.setSupportedFormat,
        systemFirmware: p.setSystemFirmware,
        gameUpdateVersion: p.setGameUpdateVersion,
        deviceModel: p.setDeviceModel,
        installType: p.setInstallType,
        cpuArch: p.setCpuArch,
        gameVersion: p.setGameVersion,
        minAndroidVersion: p.setMinAndroidVersion,
      }
      for (const [field, set] of Object.entries(setters)) {
        if (typeof values[field] === 'string' && values[field] !== '') set(values[field])
      }
      if (typeof values.summary === 'string' && values.summary !== '') {
        p.setSummary(values.summary.slice(0, 150))
      }
      setAiFilled(true)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.platform])

  return (
    <>
      {/* ===== 1. basic info (unified order) ===== */}
      <Section title={t.basicInfo}>
        {aiFilled && (
          <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs font-bold text-emerald-600">
            تمت تعبئة الحقول من التبويب الذكي — راجعها قبل الحفظ
          </p>
        )}
        <Field label="العنوان الرئيسي *" hint="يظهر بخط عريض في البطاقات وأعلى صفحة التعريب">
          <Input
            value={p.headline}
            onChange={(e) => p.setHeadline(e.target.value)}
            placeholder="مثال: التعريب العربي الكامل للعبة"
            dir="auto"
          />
        </Field>
        <Field label={t.modName} required hint={t.nameYearHint}>
          <Input
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            placeholder={t.namePh}
          />
        </Field>
        <Field label={t.arabicName}>
          <Input
            value={p.arabicTitle}
            onChange={(e) => p.setArabicTitle(e.target.value)}
            onBlur={(e) => {
              const formatted = formatArabicTitle(e.target.value)
              if (formatted && formatted !== e.target.value) p.setArabicTitle(formatted)
            }}
            placeholder={t.arabicNamePh}
            dir="auto"
          />
        </Field>
        <Field label={t.scope} hint={t.scopeHint}>
          <Input
            value={p.translationScope}
            onChange={(e) => p.setTranslationScope(e.target.value)}
            placeholder={t.scopePlaceholder}
            dir="auto"
          />
          {SHOW_SCOPE_PICKER && (
            <ScopePicker
              value={p.translationScope}
              onChange={p.setTranslationScope}
              pickedLabel={t.scopePicked}
              maxLabel={t.scopeMax}
            />
          )}
        </Field>
        <Field label={t.modType} hint={t.modTypeHint}>
          <Select
            value={normalizeTranslationType(p.translationType)}
            onValueChange={(v) => p.setTranslationType(normalizeTranslationType(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.modTypePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unofficial">{TRANSLATION_TYPE_LABELS.unofficial}</SelectItem>
              <SelectItem value="official">{TRANSLATION_TYPE_LABELS.official}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.modMethod} hint={t.modMethodHint}>
          <Select value={p.translationMethod} onValueChange={p.setTranslationMethod}>
            <SelectTrigger>
              <SelectValue placeholder={t.modMethodPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="بشري">{t.methodHuman}</SelectItem>
              <SelectItem value="آلي">{t.methodAi}</SelectItem>
              <SelectItem value="مختلط">{t.methodMixed}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {(p.platform === 'PS1' || p.platform === 'PS2') ? (
          <Field label="معرّف اللعبة (Game ID)">
            <Input
              value={p.platformGameId}
              onChange={(e) => p.setPlatformGameId(e.target.value)}
              placeholder="مثال: SCUS-94426"
              dir="ltr"
            />
          </Field>
        ) : p.platform === 'PS3' ? (
          <>
            <Field label="معرّف اللعبة (Game ID)">
              <Input
                value={p.platformGameId}
                onChange={(e) => p.setPlatformGameId(e.target.value)}
                placeholder="مثال: BCES-01719"
                dir="ltr"
              />
            </Field>
            <Field label="رقم تحديث اللعبة المتوافق">
              <Input
                value={p.gameUpdateVersion}
                onChange={(e) => p.setGameUpdateVersion(e.target.value)}
                placeholder="مثال: 1.02"
                dir="ltr"
              />
            </Field>
          </>
        ) : p.platform === 'PS4' ? (
          <>
            <Field label="معرّف اللعبة (CUSA)">
              <Input
                value={p.cusaId}
                onChange={(e) => p.setCusaId(e.target.value)}
                placeholder="مثال: CUSA-00123"
                dir="ltr"
              />
            </Field>
            <Field label="تحديث النظام المتوافق">
              <Input
                value={p.systemFirmware}
                onChange={(e) => p.setSystemFirmware(e.target.value)}
                placeholder="مثال: 11.00"
                dir="ltr"
              />
            </Field>
            <Field label="رقم تحديث اللعبة المتوافق">
              <Input
                value={p.gameUpdateVersion}
                onChange={(e) => p.setGameUpdateVersion(e.target.value)}
                placeholder="مثال: 1.02"
                dir="ltr"
              />
            </Field>
          </>
        ) : p.platform === 'PS5' ? (
          <>
            <Field label="معرّف اللعبة (PPSA)">
              <Input
                value={p.ppsaId}
                onChange={(e) => p.setPpsaId(e.target.value)}
                placeholder="مثال: PPSA-00001"
                dir="ltr"
              />
            </Field>
            <Field label="تحديث النظام المتوافق">
              <Input
                value={p.systemFirmware}
                onChange={(e) => p.setSystemFirmware(e.target.value)}
                placeholder="مثال: 11.00"
                dir="ltr"
              />
            </Field>
            <Field label="رقم تحديث اللعبة المتوافق">
              <Input
                value={p.gameUpdateVersion}
                onChange={(e) => p.setGameUpdateVersion(e.target.value)}
                placeholder="مثال: 1.02"
                dir="ltr"
              />
            </Field>
          </>
        ) : p.platform === 'X360' ? (
          <>
            <Field label="معرّف اللعبة (Title ID)">
              <Input
                value={p.titleId}
                onChange={(e) => p.setTitleId(e.target.value)}
                placeholder="مثال: 584111F7"
                dir="ltr"
              />
            </Field>
            <Field label="معرّف الوسائط (Media ID)">
              <Input
                value={p.mediaId}
                onChange={(e) => p.setMediaId(e.target.value)}
                placeholder="مثال: D06D12ED"
                dir="ltr"
              />
            </Field>
            <Field label="صيغة اللعبة المدعومة">
              <MultiChips
                options={XBOX_FORMATS}
                value={p.supportedFormat}
                onChange={p.setSupportedFormat}
              />
            </Field>
          </>
        ) : p.platform === 'NS' ? (
          <>
            <Field label="إصدار اللعبة">
              <Input
                value={p.titleId}
                onChange={(e) => p.setTitleId(e.target.value)}
                placeholder="مثال: 010042D00D900000"
                dir="ltr"
              />
            </Field>
            <Field label="الجهاز">
              <Input
                value={p.deviceModel}
                onChange={(e) => p.setDeviceModel(e.target.value)}
                placeholder="مثال: NS1"
                dir="ltr"
              />
            </Field>
            <Field label="رقم التحديث المتوافق">
              <Input
                value={p.gameUpdateVersion}
                onChange={(e) => p.setGameUpdateVersion(e.target.value)}
                placeholder="مثال: 1.0.2"
                dir="ltr"
              />
            </Field>
          </>
        ) : p.platform === 'ANDROID' ? (
          <>
            <Field label="نوع ملف التثبيت">
              <select
                value={p.installType}
                onChange={(e) => p.setInstallType(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">— اختر النوع —</option>
                {ANDROID_INSTALL_TYPES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="بنية المعالج المتوافقة">
              <MultiChips
                options={ANDROID_CPU_ARCHS}
                value={p.cpuArch}
                onChange={p.setCpuArch}
              />
            </Field>
            <Field label="رقم إصدار اللعبة المتوافق">
              <Input
                value={p.gameVersion}
                onChange={(e) => p.setGameVersion(e.target.value)}
                placeholder="مثال: 2.5.1"
                dir="ltr"
              />
            </Field>
            <Field label="الحد الأدنى لنظام الأندرويد">
              <Input
                value={p.minAndroidVersion}
                onChange={(e) => p.setMinAndroidVersion(e.target.value)}
                placeholder="مثال: 8.0"
                dir="ltr"
              />
            </Field>
          </>
        ) : (
          <Field label={t.compatField} hint={t.compatHint}>
            <Input
              value={p.compatibility}
              onChange={(e) => p.setCompatibility(e.target.value)}
              dir="auto"
            />
          </Field>
        )}
        <Field label={t.summaryLabel} hint={t.summaryHint}>
          <Textarea
            value={p.summary}
            onChange={(e) => p.setSummary(e.target.value.slice(0, 150))}
            rows={3}
            maxLength={150}
            placeholder={t.summaryPlaceholder}
            dir="auto"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {p.summary.length}/150
          </p>
        </Field>
        <Field
          label={t.fullDesc}
          required
          hint={t.descHint}
        >
          <Textarea
            value={p.description}
            onChange={(e) => p.setDescription(e.target.value)}
            rows={8}
            placeholder="## ..."
            dir="auto"
          />
        </Field>
      </Section>

      {/* ===== 2. install guide ===== */}
      <Section title={t.installGuide}>
        <Field label={t.installContent} hint={t.installHint}>
          <Textarea
            value={p.installGuide}
            onChange={(e) => p.setInstallGuide(e.target.value)}
            rows={8}
            placeholder="## ..."
          />
        </Field>
      </Section>

      {/* ===== 3. changelog ===== */}
      <Section title={t.changelog}>
        <Field label={t.changelogContent} hint={t.changelogHint}>
          <Textarea
            value={p.changelog}
            onChange={(e) => p.setChangelog(e.target.value)}
            rows={6}
            placeholder="## v1.0.0"
          />
        </Field>
      </Section>

      {/* ===== 4. tags ===== */}
      <Section title={t.tags}>
        <Field label={t.tags} hint={t.tagsHint}>
          <Input
            value={p.tags}
            onChange={(e) => p.setTags(e.target.value)}
            placeholder="مثال: إصلاح أخطاء، واجهة، أسلوب لعب"
          />
        </Field>
      </Section>
    </>
  )
}

/** قائمة جانبية مجمعة لاختيار عناصر محتوى التعريب (حتى MAX_SCOPE_ITEMS) — تُدمج في حقل النص. */
function ScopePicker({
  value,
  onChange,
  pickedLabel,
  maxLabel,
}: {
  value: string
  onChange: (v: string) => void
  pickedLabel: string
  maxLabel: string
}) {
  const parts = splitScope(value)
  const selected = new Set(parts.filter((s) => SCOPE_GROUPS.some((g) => g.items.includes(s))))
  const extraCount = parts.length - selected.size

  const toggle = (item: string) => {
    if (selected.has(item)) {
      onChange(parts.filter((s) => s !== item).join('، '))
    } else {
      if (selected.size >= MAX_SCOPE_ITEMS) return
      onChange([...parts, item].join('، '))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold">
          {pickedLabel}: {selected.size}/{MAX_SCOPE_ITEMS}
          {extraCount > 0 && <span className="font-normal text-muted-foreground"> (+{extraCount} يدوي)</span>}
        </span>
        {selected.size >= MAX_SCOPE_ITEMS && (
          <span className="text-amber-600 dark:text-amber-400">{maxLabel}</span>
        )}
      </div>
      <div className="max-h-56 space-y-3 overflow-y-auto ps-1">
        {SCOPE_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-xs font-bold text-primary">{g.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((item) => {
                const checked = selected.has(item)
                const disabled = !checked && selected.size >= MAX_SCOPE_ITEMS
                return (
                  <label
                    key={item}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      checked
                        ? 'border-primary bg-primary/10 font-bold text-primary'
                        : disabled
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:border-muted-foreground/40 hover:bg-accent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(item)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    {item}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
