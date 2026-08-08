'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import type { ModSummary } from '@/lib/types'

const PLATFORM_PALETTE: Record<string, string[]> = {
  PC:   ['#0078D4', '#00A4EF', '#005A9E'],
  X360: ['#107C10', '#2DC653', '#0E6B0E'],
  NS:   ['#e60012', '#ef4444', '#dc2626'],
  PS4:  ['#3b82f6', '#60a5fa', '#2563eb'],
  PS3:  ['#1e40af', '#3b82f6', '#1d4ed8'],
  PS2:  ['#06b6d4', '#0891b2', '#0e7490'],
  PS1:  ['#94a3b8', '#cbd5e1', '#64748b'],
}

const SLIDER_INTERVAL = 6000

interface HeroSliderProps {
  slides: ModSummary[]
}

export function HeroSlider({ slides }: HeroSliderProps) {
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const goTo = useCallback((idx: number) => {
    setActive(idx)
    startRef.current = Date.now()
    // Reset progress bar via DOM ref
    if (progressBarRef.current) progressBarRef.current.style.width = '0%'
  }, [])

  const next = useCallback(() => goTo((activeRef.current + 1) % slides.length), [slides.length, goTo])
  const prev = useCallback(() => goTo((activeRef.current - 1 + slides.length) % slides.length), [slides.length, goTo])

  // Auto-advance
  useEffect(() => {
    if (slides.length === 0) return
    timerRef.current = setInterval(() => {
      setActive((p) => (p + 1) % slides.length)
      startRef.current = Date.now()
    }, SLIDER_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [slides.length])

  // Smooth progress bar via rAF — updates DOM directly, no React state
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.min((elapsed / SLIDER_INTERVAL) * 100, 100)
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${pct}%`
      }
      progressRef.current = requestAnimationFrame(tick)
    }
    progressRef.current = requestAnimationFrame(tick)
    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current)
    }
  }, [active])

  if (slides.length === 0) return null

  const slide = slides[active]
  const platform = slide.game?.platform || 'PC'
  const palette = PLATFORM_PALETTE[platform] || PLATFORM_PALETTE.PC
  const color = palette[active % palette.length]
  const meta = {
    label: `ARABIC ${platform}`,
    color,
  }

  return (
    <section
      className="relative overflow-hidden select-none"
      style={{ height: 'clamp(360px, 52vh, 580px)' }}
      dir="rtl"
    >
      {/* ===== الصورة الخلفية ===== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-0"
        >
          <img src={slide.imageUrl} alt={slide.name} className="h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.55) 45%, rgba(10,10,10,0.05) 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to left, rgba(10,10,10,0.65) 0%, transparent 55%)' }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 75% 100%, ${meta.color}30 0%, transparent 60%)` }}
          />
        </motion.div>
      </AnimatePresence>

      {/* ===== المحتوى النصي ===== */}
      <div className="absolute inset-0 flex items-end pointer-events-none">
        <div className="w-full px-6 pb-12 sm:px-12 sm:pb-16 lg:px-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={`txt-${active}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="pointer-events-auto max-w-[650px]"
            >
              <span
                className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"
                style={{
                  backgroundColor: meta.color,
                  color: '#fff',
                }}
              >
                {meta.label}
              </span>

              <h2
                className="mb-2 font-black leading-tight text-white"
                style={{
                  fontSize: 'clamp(1.5rem, 3.8vw, 3.2rem)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.6)',
                }}
              >
                {slide.name}
              </h2>

              <p className="mb-5 text-sm font-semibold text-gray-300">
                {slide.category?.name || slide.game?.name}
                {slide.fileSize && <span className="mx-2 opacity-30">•</span>}
                {slide.fileSize && <span className="text-gray-400">{slide.fileSize}</span>}
              </p>

              <a
                href={`/?view=mod&slug=${slide.slug}`}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: meta.color,
                  color: '#fff',
                  boxShadow: `0 8px 24px ${meta.color}55`,
                }}
              >
                <Info size={15} />
                عرض التفاصيل
              </a>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ===== عدّاد الشرائح ===== */}
      <div className="absolute left-6 top-5 flex items-center gap-1.5 pointer-events-none" dir="ltr">
        <span
          className="text-sm font-black tabular-nums text-white"
          style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}
        >
          {String(active + 1).padStart(2, '0')}
        </span>
        <span className="text-xs text-white/25">/</span>
        <span className="text-xs font-bold tabular-nums text-white/35">
          {String(slides.length).padStart(2, '0')}
        </span>
      </div>

      {/* ===== سهم التنقل — يمين ===== */}
      <button
        onClick={next}
        aria-label="الشريحة التالية"
        className="absolute right-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full transition-all duration-150 hover:scale-110 active:scale-90"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <ChevronRight size={18} className="text-white" />
      </button>

      {/* ===== سهم التنقل — يسار ===== */}
      <button
        onClick={prev}
        aria-label="الشريحة السابقة"
        className="absolute left-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full transition-all duration-150 hover:scale-110 active:scale-90"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <ChevronLeft size={18} className="text-white" />
      </button>

      {/* ===== شريط التقدم + النقاط ===== */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 px-6 pb-3 sm:px-12 lg:px-16" dir="ltr">
        <div
          className="h-[2px] w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <div
            ref={progressBarRef}
            className="h-full rounded-full"
            style={{
              width: '0%',
              background: `linear-gradient(to right, ${meta.color}, #fff)`,
            }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`الانتقال للشريحة ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === active ? '22px' : '6px',
                height: '6px',
                backgroundColor: i === active ? meta.color : 'rgba(255,255,255,0.22)',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
