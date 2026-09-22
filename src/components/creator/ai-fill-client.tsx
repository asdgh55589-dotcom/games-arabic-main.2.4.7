// AiFillClient — new-tab page: paste raw mod text → Gemini structures
// it into the 7 PC fields → review/edit → approve. Approval stores
// the values in localStorage; the form tab applies them on `storage`.

'use client'

import { useState } from 'react'
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import { SiteHeader } from '@/components/creator-dashboard/site-header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aiFillKey, type AiFillValues } from '@/lib/ai/ai-fill'
import { PC_STRUCTURE_FIELDS } from '@/lib/ai/pc-structure-prompt'

const FIELD_LABELS: Record<keyof AiFillValues, string> = {
  title: 'العنوان',
  arabicTitle: 'العنوان بالعربي',
  scope: 'محتوى التعريب',
  compatibility: 'توافق التعريب',
  installGuide: 'طريقة التركيب',
  description: 'الوصف الكامل',
  summary: 'الملخص',
}

const LONG_FIELDS: (keyof AiFillValues)[] = ['installGuide', 'description']

export function AiFillClient({ platform }: { platform: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<AiFillValues | null>(null)
  const [applied, setApplied] = useState(false)

  const onSubmit = async () => {
    setError(null)
    setApplied(false)
    if (text.trim().length < 10) {
      setError('الصق بيانات التعريب كاملة أولاً (10 أحرف على الأقل)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, platform }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message || 'فشل الهيكلة — حاول مجدداً')
      }
      const out = {} as AiFillValues
      for (const f of PC_STRUCTURE_FIELDS) {
        out[f] = typeof data?.data?.[f] === 'string' ? data.data[f] : ''
      }
      setValues(out)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الهيكلة — حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  const onApprove = () => {
    if (!values) return
    localStorage.setItem(aiFillKey(platform), JSON.stringify({ values, at: Date.now() }))
    setApplied(true)
  }

  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 p-4 lg:p-6" dir="rtl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-5 w-5 text-violet-500" />
            التعبئة الذكية (PC)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            الصق كل بيانات التعريب كنص خام — تُرتب في الخانات السبع. راجع النتيجة ثم اعتمدها لتُعبأ في النموذج.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-raw">النص الخام</Label>
          <Textarea
            id="ai-raw"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="الصق هنا: اسم اللعبة، الوصف، المميزات، طريقة التركيب، التوافق، المشاكل المعروفة..."
            dir="auto"
          />
          <Button onClick={onSubmit} disabled={loading} className="min-h-[44px]">
            {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
            {loading ? 'جارٍ الترتيب...' : 'رتّب البيانات'}
          </Button>
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        </div>

        {values && (
          <div className="space-y-4 rounded-xl border border-border bg-card/30 p-4">
            <h2 className="text-lg font-bold">النتيجة — راجع قبل الاعتماد</h2>
            {PC_STRUCTURE_FIELDS.map((f) => (
              <div key={f} className="space-y-1.5">
                <Label htmlFor={`ai-${f}`}>{FIELD_LABELS[f]}</Label>
                {LONG_FIELDS.includes(f) ? (
                  <Textarea
                    id={`ai-${f}`}
                    value={values[f]}
                    onChange={(e) => setValues({ ...values, [f]: e.target.value })}
                    rows={f === 'description' ? 12 : 5}
                    dir="auto"
                  />
                ) : (
                  <Input
                    id={`ai-${f}`}
                    value={values[f]}
                    onChange={(e) => setValues({ ...values, [f]: e.target.value })}
                    dir="auto"
                  />
                )}
              </div>
            ))}
            <Button onClick={onApprove} className="min-h-[44px]">
              <CheckCircle2 className="me-2 h-4 w-4" />
              اعتماد وتعبئة النموذج
            </Button>
            {applied && (
              <p className="text-sm font-bold text-emerald-600">
                تمت التعبئة — ارجع لتبويب النموذج وراجع الحقول السبع قبل الحفظ
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
