'use client'

import { useEffect } from 'react'

/**
 * useSmoothWheelScroll — هوك بيخلّي الـ wheel scroll ناعم (buttery smooth)
 * بدل القفزات الجامدة اللي بتعملها الـ browser بشكل افتراضي.
 *
 * الفكرة:
 *   - بنرصد wheel event
 *   - بنـ preventDefault على الـ default behavior (القفزة الجامدة)
 *   - بنستخدم requestAnimationFrame عشان نعمل scroll تدريجي ناعم
 *   - بنستخدم easing function (easeOutCubic) عشان الحركة تكون طبيعية
 *
 * بنشتغل بس لما:
 *   - prefers-reduced-motion يكون false (احترام لإعدادات المستخدم)
 *   - المستخدم مش بيـ ctrl+scroll (zoom)
 *
 * الفائدة:
 *   - الحركة ناعمة جداً زي المواقع الحديثة (مثل Apple, Stripe)
 *   - مفيش jank أو stuttering
 *   - شغّال على كل الـ pages (بنحطه في الـ root layout)
 */
export function useSmoothWheelScroll() {
  useEffect(() => {
    // احترم إعدادات المستخدم لو prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let isAnimating = false
    let currentScroll = window.scrollY
    let targetScroll = window.scrollY

    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
    const DURATION_MS = 400
    let animStart: number | null = null
    let startScroll = 0

    const animate = (timestamp: number) => {
      if (animStart === null) animStart = timestamp
      const elapsed = timestamp - animStart
      const t = Math.min(elapsed / DURATION_MS, 1)
      const eased = easeOutCubic(t)
      currentScroll = startScroll + (targetScroll - startScroll) * eased
      window.scrollTo(0, currentScroll)

      if (t < 1) {
        requestAnimationFrame(animate)
      } else {
        isAnimating = false
        animStart = null
      }
    }

    const onWheel = (e: WheelEvent) => {
      // لو المستخدم بيـ ctrl+scroll (zoom), سيب الـ browser يتعامل معاه
      if (e.ctrlKey) return

      // لو في تقاطع (deltaX), سيب الـ browser (horizontal scroll)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

      e.preventDefault()
      const delta = e.deltaY
      // عامل تطبيع بسيط: بعض الأجهزة بتبعت delta كبير (line mode),
      // وبعضها بتبعت delta صغير (pixel mode). بنطبّق عامل تكبير بسيط.
      const normalized = delta * 0.8

      // لو في animation شغّال، نكمّل من الـ current target
      targetScroll = Math.max(
        0,
        Math.min(
          document.documentElement.scrollHeight - window.innerHeight,
          targetScroll + normalized,
        ),
      )

      if (!isAnimating) {
        isAnimating = true
        startScroll = window.scrollY
        animStart = null
        requestAnimationFrame(animate)
      } else {
        // حدّث الـ startScroll بناءً على الـ position الحالي عشان النعومة
        // تفضل مستمرة حتى لو المستخدم كمل scroll
        // بس مش بنصفر الـ animStart عشان الـ animation يكمّل بس النعومة تتعدّل
        startScroll = window.scrollY
        animStart = null
      }
    }

    // passive: false عشان نقدر نـ preventDefault
    window.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
}
