'use client'

import { FlaskConical } from 'lucide-react'

/**
 * شريط يوضّح أن المعروض بيانات تجريبية لأن مسار الـ API لم يهبط بعد.
 * يظهر فقط عندما تكون `isMock === true` — لا يظهر مع بيانات حقيقية أبداً.
 */
export function OverviewDemoBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="text-[12.5px]">
        <div className="font-medium text-foreground">بيانات تجريبية</div>
        <p className="text-muted-foreground">
          لم تتوفّر بعد واجهة إحصاءات السوشيال ميديا على الخادم؛ المعروض هنا نموذج توضيحي وسيُستبدل
          تلقائياً بالبيانات الحقيقية فور جهوزيتها.
        </p>
      </div>
    </div>
  )
}
