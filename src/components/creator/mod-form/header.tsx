// ModFormHeader — unified header box for creator + admin mod forms:
// breadcrumb + action buttons (cancel / change-platform / polish /
// smart-fill / save-publish). Smart-fill opens per-platform; polish
// is platform-free.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Loader2, Save, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ModFormHeaderProps {
  breadcrumbHref: string
  breadcrumbLabel: string
  currentLabel: string
  statusBadge?: ReactNode
  dir: string
  isEdit: boolean
  step: number
  /** Current platform key ('' = not chosen yet → smart button hidden). */
  platform: string
  saving: boolean
  loadError: string | null
  onSave: () => void
  saveLabel: string
  cancelHref: string
  cancelLabel: string
  /** When provided (creator new-mod flow), shows the change-platform button. */
  onBackToStep1?: () => void
}

export function ModFormHeader(p: ModFormHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-card/30 p-4">
      {/* Breadcrumb row */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={p.breadcrumbHref} className="hover:text-foreground">
          {p.breadcrumbLabel}
        </Link>
        <ChevronRight className={`h-4 w-4 ${p.dir === 'rtl' ? 'rotate-180' : ''}`} />
        <span className="font-bold text-foreground">{p.currentLabel}</span>
        {p.isEdit && p.statusBadge}
      </div>

      <div className="my-3 border-t border-border" />

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-2">
        {p.step === 2 && (
          <Button onClick={p.onSave} disabled={p.saving || !!p.loadError} className="min-h-[44px]">
            {p.saving ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            {p.saveLabel}
          </Button>
        )}
        {p.step === 2 && p.platform !== '' && (
          <Button asChild variant="outline" className="border-violet-500/40 text-violet-600 hover:text-violet-600">
            <a href={`/creator/ai-fill?platform=${p.platform}`} target="_blank" rel="noopener">
              <Sparkles className="me-1 h-3.5 w-3.5" />
              تعبئة ذكية
            </a>
          </Button>
        )}
        <Button asChild variant="outline" className="border-emerald-500/40 text-emerald-600 hover:text-emerald-600">
          <a href="/creator/polish" target="_blank" rel="noopener">
            <Wand2 className="me-1 h-3.5 w-3.5" />
            تحسين نصوص ذكية
          </a>
        </Button>
        {p.onBackToStep1 && (
          <Button variant="ghost" onClick={p.onBackToStep1}>
            <ArrowRight className="ml-1 h-4 w-4" />
            تغيير المنصة
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={p.cancelHref}>{p.cancelLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
