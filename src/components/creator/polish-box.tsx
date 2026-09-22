// PolishBox — shared standalone text-improvement service (all platforms).
// Not tied to any mod: paste any text → improve → copy manually and
// paste wherever needed. No form filling, no localStorage.

'use client'

import { useState } from 'react'
import { Check, Copy, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function PolishBox() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  const onPolish = async () => {
    setError(null)
    setCopied(false)
    if (text.trim().length < 10) {
      setError('الصق النص أولاً (10 أحرف على الأقل)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'polish', text }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message || 'فشل التحسين — حاول مجدداً')
      }
      setResult(typeof data?.data?.text === 'string' ? data.data.text : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحسين — حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  const onCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = result
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Wand2 className="h-4 w-4 text-emerald-600" />
          تحسين نصوص (حر)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          الصق أي نص لتحسين صياغته — ثم انسخ الناتج والصقه يدوياً في أي مكان بالمنصة. لا يعبئ أي حقل تلقائياً.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="polish-raw">النص الأصلي</Label>
        <Textarea
          id="polish-raw"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="الصق هنا أي نص تريد تحسين صياغته..."
          dir="auto"
        />
      </div>
      <Button onClick={onPolish} disabled={loading} variant="outline" className="min-h-[44px]">
        {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Wand2 className="me-2 h-4 w-4" />}
        {loading ? 'جارٍ التحسين...' : 'حسّن النص'}
      </Button>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {result && (
        <div className="space-y-1.5">
          <Label htmlFor="polish-out">النص المحسّن</Label>
          <Textarea
            id="polish-out"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={8}
            dir="auto"
          />
          <Button onClick={onCopy} variant="outline" size="sm">
            {copied ? <Check className="me-1 h-3.5 w-3.5" /> : <Copy className="me-1 h-3.5 w-3.5" />}
            {copied ? 'تم النسخ' : 'نسخ النص المحسّن'}
          </Button>
        </div>
      )}
    </div>
  )
}
