'use client'

import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatArNumber } from '@/lib/notifications/admin-labels'

/** ألوان البطاقات المطابقة للوحة التحكم (`src/app/admin/page.tsx`). */
export type StatTone = 'primary' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'

const TONES: Record<StatTone, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  blue: { bg: 'bg-blue-lt', text: 'text-blue' },
  green: { bg: 'bg-green-lt', text: 'text-green' },
  yellow: { bg: 'bg-yellow-lt', text: 'text-yellow' },
  red: { bg: 'bg-red-lt', text: 'text-red' },
  purple: { bg: 'bg-purple-lt', text: 'text-purple' },
}

interface OverviewStatCardProps {
  label: string
  value: number
  icon: LucideIcon
  tone?: StatTone
  /** ملاحظة صغيرة أسفل الرقم (مثل «نطاق 30 يوماً»). */
  hint?: string
  /** عدد الخانات العشرية (افتراضياً 0). */
  fractionDigits?: number
}

/** بطاقة إحصاء واحدة — الرقم يُنسَّق بـ ar-SA عبر `admin-labels`. */
export function OverviewStatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
  fractionDigits = 0,
}: OverviewStatCardProps) {
  const colors = TONES[tone]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}
          >
            <Icon className={`h-5 w-5 ${colors.text}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-medium tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
              {formatArNumber(value, fractionDigits)}
            </div>
            {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
