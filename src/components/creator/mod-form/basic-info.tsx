// ModFormBasicInfo — sections 1 (basic), source, 9 (changelog), 10 (install guide).
// Presentational only; all state lives in the ModForm orchestrator.

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import { normalizeTranslationType, TRANSLATION_TYPE_LABELS, type TranslationType } from '@/lib/schemas'
import { Field, Section } from './primitives'

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
  compatibility: string
  setCompatibility: (v: string) => void
  tags: string
  setTags: (v: string) => void
  translationType: TranslationType
  setTranslationType: (v: TranslationType) => void
  isOriginalWork: boolean
  setIsOriginalWork: (v: boolean) => void
  originalSource: string
  setOriginalSource: (v: string) => void
  originalAuthor: string
  setOriginalAuthor: (v: string) => void
  userRole: string
}

export function ModFormBasicInfo(p: Props) {
  const { dict } = useStudioLanguage()
  const t = dict.form
  return (
    <>
      {/* ===== 1. basic info ===== */}
      <Section title={t.basicInfo}>
        <Field label={t.modName} required>
          <Input
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            placeholder="مثال: ترجمة غير رسمية للعبة"
          />
        </Field>
        <Field label={t.arabicName}>
          <Input
            value={p.arabicTitle}
            onChange={(e) => p.setArabicTitle(e.target.value)}
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
        <Field label={t.tags} hint={t.tagsHint}>
          <Input
            value={p.tags}
            onChange={(e) => p.setTags(e.target.value)}
            placeholder="مثال: إصلاح أخطاء، واجهة، أسلوب لعب"
          />
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
      </Section>

      {/* ===== mod source — creator vs publisher ===== */}
      <Section title={t.modSource}>
        <div className="flex items-center gap-3">
          <Switch
            id="isOriginalWork"
            checked={p.userRole === 'publisher' ? false : p.isOriginalWork}
            onCheckedChange={(v) => {
              if (p.userRole === 'publisher') return
              p.setIsOriginalWork(v)
            }}
            disabled={p.userRole === 'publisher'}
          />
          <Label htmlFor="isOriginalWork" className="cursor-pointer">
            {p.userRole === 'publisher'
              ? t.externalYes
              : p.isOriginalWork
                ? t.ownYes
                : t.ownNo}
          </Label>
        </div>
        {(p.userRole === 'publisher' ? true : !p.isOriginalWork) && (
          <div className="space-y-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-600">
              {t.externalWarn}
            </p>
            <Field label={t.origSource} required>
              <Input
                value={p.originalSource}
                onChange={(e) => p.setOriginalSource(e.target.value)}
                placeholder={t.origSourcePlaceholder}
              />
            </Field>
            <Field label={t.origAuthor}>
              <Input
                value={p.originalAuthor}
                onChange={(e) => p.setOriginalAuthor(e.target.value)}
                placeholder={t.origAuthorPlaceholder}
              />
            </Field>
          </div>
        )}
      </Section>

      {/* ===== 9. changelog ===== */}
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

      {/* ===== 10. install guide ===== */}
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
    </>
  )
}
