// ModFormBasicInfo — sections 1 (basic, unified order), install guide, changelog, tags.
// Presentational only; all state lives in the ModForm orchestrator.
// Unified order (all platforms): العنوان، العنوان بالعربي، محتوى التعريب،
// نوع التعريب، طريقة التعريب، توافق التعريب، الملخص، الوصف الكامل،
// طريقة التركيب، سجل التغييرات، الوسوم.

import { Input } from '@/components/ui/input'
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

interface Props {
  name: string
  setName: (v: string) => void
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
  summary: string
  setSummary: (v: string) => void
  userRole: string
}

export function ModFormBasicInfo(p: Props) {
  const { dict } = useStudioLanguage()
  const t = dict.form
  return (
    <>
      {/* ===== 1. basic info (unified order) ===== */}
      <Section title={t.basicInfo}>
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
        <Field label={t.compatField} hint={t.compatHint}>
          <Input
            value={p.compatibility}
            onChange={(e) => p.setCompatibility(e.target.value)}
            dir="auto"
          />
        </Field>
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
