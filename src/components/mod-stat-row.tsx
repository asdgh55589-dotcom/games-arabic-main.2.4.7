'use client'

import { Download, Eye, ThumbsUp } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ModSummary } from '@/lib/types'

/**
 * ModStatRow — صفّ الإحصائيات الموحّد (تحميلات / مشاهدات / إعجابات).
 *
 * كان نفس البلوك مكرّراً 3 مرات داخل `home-sidebar.tsx` (مرة لكل variant)
 * ومكرّراً مرتين داخل `mod-card.tsx` — فكان المستخدم يرى نفس الأرقام مرتين
 * على الصفحة الواحدة. الآن هناك مصدر واحد فقط للأرقام.
 *
 * - `sidebar`: أيقونات `h-3.5` زرقاء (الشريط الجانبي للرئيسية).
 * - `card`:    أيقونات `h-3` بلون الهوية (بطاقة التعريب) — والخلية الثانية
 *             والثالثة تفصلهما حدود، تماماً كما كان الشريط في البطاقة.
 * - `cardCompact`: نفس شريط البطاقة بأيقونات أصغر (بطاقة التعريب المُصغّرة).
 */
export type ModStatRowVariant = 'sidebar' | 'card' | 'cardCompact'

interface ModStatRowProps {
  mod: ModSummary
  variant?: ModStatRowVariant
}

export function ModStatRow({ mod, variant = 'sidebar' }: ModStatRowProps) {
  // الأرقام تُنسّق مرة واحدة فقط — لا تكرار في مصدر العرض.
  const downloads = formatNumber(mod.downloads)
  const views = formatNumber(mod.views)
  const endorsements = formatNumber(mod.endorsements)

  if (variant === 'card' || variant === 'cardCompact') {
    const compact = variant === 'cardCompact'
    const iconClass = compact
      ? 'h-3 w-3 text-primary'
      : 'h-3 w-3 text-primary sm:h-3.5 sm:w-3.5'
    const valueClass = compact
      ? 'text-[10px] font-bold leading-[1.3] text-foreground/90'
      : 'text-[10px] font-bold leading-[1.3] text-foreground/90 sm:text-[11px]'
    return (
      <>
        <div className="flex items-center justify-center gap-1" title="التحميلات">
          <Download className={iconClass} />
          <span className={valueClass}>{downloads}</span>
        </div>
        <div
          className="flex items-center justify-center gap-1 border-s border-border/60"
          title="المشاهدات"
        >
          <Eye className={iconClass} />
          <span className={valueClass}>{views}</span>
        </div>
        <div
          className="flex items-center justify-center gap-1 border-s border-border/60"
          title="الإعجابات"
        >
          <ThumbsUp className={iconClass} />
          <span className={valueClass}>{endorsements}</span>
        </div>
      </>
    )
  }

  return (
    <>
      <span className="flex items-center gap-0.5" title="التحميلات">
        <Download className="h-3.5 w-3.5 text-blue-500" />
        {downloads}
      </span>
      <span className="flex items-center gap-0.5" title="المشاهدات">
        <Eye className="h-3.5 w-3.5 text-blue-500" />
        {views}
      </span>
      <span className="flex items-center gap-0.5" title="التأييدات">
        <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
        {endorsements}
      </span>
    </>
  )
}
