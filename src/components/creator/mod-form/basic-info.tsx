// ModFormBasicInfo — sections 1 (basic), source, 9 (changelog), 10 (install guide).
// Presentational only; all state lives in the ModForm orchestrator.

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  translationType: string
  setTranslationType: (v: string) => void
  isOriginalWork: boolean
  setIsOriginalWork: (v: boolean) => void
  originalSource: string
  setOriginalSource: (v: string) => void
  originalAuthor: string
  setOriginalAuthor: (v: string) => void
  userRole: string
}

export function ModFormBasicInfo(p: Props) {
  return (
    <>
      {/* ===== 1. المعلومات الأساسية ===== */}
      <Section title="المعلومات الأساسية">
        <Field label="اسم التعريب *" required>
          <Input
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            placeholder="مثال: Unofficial Skyrim Patch"
          />
        </Field>
        <Field label="الاسم بالعربي">
          <Input
            value={p.arabicTitle}
            onChange={(e) => p.setArabicTitle(e.target.value)}
            placeholder="مثال: باتش سكايرم غير الرسمي"
          />
        </Field>
        <Field label="نطاق التعريب" hint="مثال: العالم العربي، الخليج، جميع الدول">
          <Input
            value={p.translationScope}
            onChange={(e) => p.setTranslationScope(e.target.value)}
            placeholder="مثال: العالم العربي"
          />
        </Field>
        <Field
          label="الوصف الكامل *"
          required
          hint="يدعم Markdown — استخدم ## للعناوين و - للقوائم"
        >
          <Textarea
            value={p.description}
            onChange={(e) => p.setDescription(e.target.value)}
            rows={8}
            placeholder="## عن هذا التعريب\n\n..."
          />
        </Field>
        <Field label="الوسوم" hint="افصل بينها بفاصلة">
          <Input
            value={p.tags}
            onChange={(e) => p.setTags(e.target.value)}
            placeholder="Bugfix, UI, Gameplay"
          />
        </Field>
        <Field label="نوع التعريب" hint="اكتب أي نوع: رسمي، غير رسمي، واجهة، أسلحة، إلخ">
          <Input
            value={p.translationType}
            onChange={(e) => p.setTranslationType(e.target.value)}
            placeholder="مثال: تعريب رسمي - واجهة وقوالب"
          />
        </Field>
      </Section>

      {/* ===== مصدر التعريب — creator vs publisher ===== */}
      <Section title="مصدر التعريب">
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
              ? 'هذا التعريب من مصدر خارجي (الناشر ينشر من مصادر خارجية فقط)'
              : p.isOriginalWork
                ? 'هذا التعريب من ترجمتي الخاصة'
                : 'هذا التعريب من مصدر خارجي'}
          </Label>
        </div>
        {(p.userRole === 'publisher' ? true : !p.isOriginalWork) && (
          <div className="space-y-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-600">
              ⚠️ يجب ذكر المصدر الأصلي عند النشر من مصدر خارجي
            </p>
            <Field label="المصدر الأصلي *" required>
              <Input
                value={p.originalSource}
                onChange={(e) => p.setOriginalSource(e.target.value)}
                placeholder="رابط أو اسم المصدر الأصلي"
              />
            </Field>
            <Field label="اسم المترجم الأصلي">
              <Input
                value={p.originalAuthor}
                onChange={(e) => p.setOriginalAuthor(e.target.value)}
                placeholder="اسم الشخص أو الفريق الأصلي"
              />
            </Field>
          </div>
        )}
      </Section>

      {/* ===== 9. سجل التغييرات ===== */}
      <Section title="سجل التغييرات">
        <Field label="محتوى سجل التغييرات" hint="يدعم Markdown">
          <Textarea
            value={p.changelog}
            onChange={(e) => p.setChangelog(e.target.value)}
            rows={6}
            placeholder="## v1.0.0\n- الإصدار الأول العام..."
          />
        </Field>
      </Section>

      {/* ===== 10. طريقة التركيب ===== */}
      <Section title="طريقة التركيب">
        <Field label="دليل التركيب" hint="يدعم Markdown — اكتب خطوات التركيب بالتفصيل">
          <Textarea
            value={p.installGuide}
            onChange={(e) => p.setInstallGuide(e.target.value)}
            rows={8}
            placeholder="## طريقة التركيب\n\n1. حمّل ملف التعريب\n2. استخرج الملفات\n3. انسخها لمجلد اللعبة\n4. فعّل العربية من الإعدادات"
          />
        </Field>
      </Section>
    </>
  )
}
