'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Star, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'

interface RateReviewBarProps {
  slug: string
  name: string
  rating: number
  ratingCount: number
  recommendPct: number
  viewerRole?: string | null
  onReadReviews: () => void
}

/**
 * شريط RATE & REVIEW تحت العنوان — نجوم تفاعلية (hover للمعاينة + ضغط للاختيار).
 * الاختيار يُحفظ محلياً + toast؛ لا يوجد endpoint عام للتقييم بعد.
 */
// TODO(ratings-api): POST /api/mods/[slug]/rate { stars } — يُربط هنا بعد الاتفاق على الـ API.
export function RateReviewBar({
  slug,
  name,
  rating,
  ratingCount,
  recommendPct,
  onReadReviews,
}: RateReviewBarProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [hovered, setHovered] = useState(0)
  const [userRating, setUserRating] = useState(0)
  const storageKey = `ga_rated_${slug}`

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(storageKey))
      if (v >= 1 && v <= 5) setUserRating(v)
    } catch {
      // best-effort: التقييم المحلي غير متاح
    }
  }, [storageKey])

  const shown = hovered || userRating || 5

  const handleRate = (stars: number) => {
    if (!user) {
      toast({
        title: 'سجّل الدخول',
        description: 'يجب تسجيل الدخول لتقييم التعريب',
        variant: 'destructive',
      })
      router.push('/login')
      return
    }
    setUserRating(stars)
    try {
      localStorage.setItem(storageKey, String(stars))
    } catch {
      // best-effort: يُحفظ في الذاكرة فقط
    }
    toast({
      title: 'شكراً لك على تقييمك بياناتنا',
      description: `قيّمت «${name}» بـ ${stars} من 5 — النجوم تقيّم بيانات الصفحة (العنوان والوصف هو محتوى لا تنسى تقييم التعريب ❣️)`,
      duration: 2500,
    })
  }

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-1.5 text-xs sm:gap-2"
      dir="rtl"
      aria-label="التقييم والمراجعات"
    >
      {/* العنوان — نص عادي بلون بارد */}
      <span className="me-2 font-black uppercase tracking-widest text-foreground/60">
        Rate & Review
      </span>
      {/* النجوم التفاعلية — متقاربة بدون صندوق، ترتفع عند الوقوف وتنزل عند المغادرة */}
      <div
        role="radiogroup"
        aria-label="قيّم التعريب بالنجوم"
        className="flex items-center select-none"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={userRating === i}
            aria-label={`قيّم ${i} ${i === 1 ? 'نجمة' : 'نجوم'}`}
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(0)}
            onClick={() => handleRate(i)}
            className="grid h-7 w-7 min-h-[44px] min-w-[44px] cursor-pointer place-items-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{
              marginInlineStart: i === 0 ? undefined : '-12px',
              transform: hovered === i ? 'translateY(-6px) scale(1.25)' : undefined,
              transition: 'transform 150ms ease-out',
            }}
          >
            <Star
              className={`h-5 w-5 transition-colors duration-150 ${
                i <= shown
                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_6px_rgba(251,191,36,0.5)]'
                  : 'text-muted-foreground/40'
              }`}
            />
          </button>
        ))}
      </div>
      <span className="hidden text-white sm:block" aria-hidden>
        •
      </span>
      {/* قالب: الرقم — نفس تصميم الشارة القديمة */}
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-black tabular-nums">
        {ratingCount > 0 ? `★ ${rating}/5 (${formatNumber(ratingCount)})` : 'لا تقييم بعد'}
      </span>
      <span className="hidden text-white sm:block" aria-hidden>
        •
      </span>
      {/* قالب: التوصية — نفس ستايل الشارات */}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
        <ThumbsUp className="h-3.5 w-3.5" />
        {recommendPct}% يوصي به
      </span>
      <span className="hidden text-white sm:block" aria-hidden>
        •
      </span>
      {/* قالب: المراجعات */}
      <button
        type="button"
        onClick={onReadReviews}
        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-black text-primary transition-colors hover:bg-primary/20"
      >
        Read reviews
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
