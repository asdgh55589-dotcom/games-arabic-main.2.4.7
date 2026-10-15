'use client'

import { ChevronLeft, ChevronRight, Download, ImageOff, X, ZoomIn, ZoomOut } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'

interface ModGalleryProps {
  images: string[]
  modName: string
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5
const SWIPE_THRESHOLD = 50

/**
 * ModGallery — معرض صور احترافي مع lightbox كامل التحكم.
 *
 * عناصر التحكم:
 *   1. إغلاق (✕) — أحمر عند الـ hover + Esc + النقر خارج الصورة
 *   2. السابق (‹) — زر + سهم يمين في الكيبورد (RTL) + سحب
 *   3. التالي (›) — زر + سهم شمال في الكيبورد (RTL) + سحب
 *   4. تكبير (+) — زر + كيبورد + دبل كليك
 *   5. تصغير (−) — زر + كيبورد
 *   6. إعادة الضبط — شارة النسبة (100%) ترجع الزوم والتحريك للوضع الطبيعي
 *   7. تنزيل — حفظ الصورة الأصلية (مع fallback لفتحها في تبويب جديد)
 *   8. سحب للتحريك (pan) عند التكبير — بالماوس واللمس
 * عداد الصور + دقة الصورة (الأبعاد الحقيقية) أعلى جنب الأزرار،
 * وشريط مصغّرات صغير احترافي أسفل مع تمرير تلقائي للصورة النشطة.
 */
export function ModGallery({ images, modName }: ModGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const isOpen = lightboxIndex !== null

  const resetView = useCallback(() => {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length))
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [images.length])

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [images.length])

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))), [])
  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  const toggleZoom = useCallback(() => {
    setZoom((z) => (z > MIN_ZOOM ? MIN_ZOOM : 2.5))
    setPan({ x: 0, y: 0 })
  }, [])

  // تنزيل الصورة الحالية بالدقة الأصلية
  const downloadCurrent = useCallback(async () => {
    if (lightboxIndex === null) return
    const src = images[lightboxIndex]
    if (!src) return
    setDownloading(true)
    try {
      const res = await fetch(src, { mode: 'cors' })
      if (!res.ok) throw new Error('download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${modName}-${lightboxIndex + 1}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      // خوادم خارجية بدون CORS — نفتح الصورة في تبويب جديد ليحفظها المستخدم يدوياً
      window.open(src, '_blank', 'noopener')
    } finally {
      setDownloading(false)
    }
  }, [images, lightboxIndex, modName])

  // دقة الصورة الحقيقية (naturalWidth × naturalHeight)
  useEffect(() => {
    if (!isOpen || lightboxIndex === null) return
    setDimensions(null)
    let cancelled = false
    const probe = new window.Image()
    probe.onload = () => {
      if (!cancelled && probe.naturalWidth > 0) {
        setDimensions(`${probe.naturalWidth} × ${probe.naturalHeight}`)
      }
    }
    probe.src = images[lightboxIndex]
    return () => {
      cancelled = true
    }
  }, [isOpen, lightboxIndex, images])

  // تمرير تلقائي للمصغّرة النشطة داخل الشريط
  useEffect(() => {
    if (!isOpen || lightboxIndex === null) return
    const el = thumbsRef.current?.children[lightboxIndex] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [isOpen, lightboxIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowLeft')
        goNext() // RTL: left = next
      else if (e.key === 'ArrowRight')
        goPrev() // RTL: right = prev
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
      else if (e.key === '0') resetView()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, closeLightbox, goNext, goPrev, zoomIn, zoomOut, resetView])

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget as HTMLImageElement & {
      dataset: DOMStringMap
    }
    if (!target.dataset.fallback) {
      target.dataset.fallback = '1'
      target.src = FALLBACK_GAME_IMAGE
    } else {
      target.style.display = 'none'
    }
  }

  // سحب للتنقل (swipe) — يمين/شمال
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || zoom > MIN_ZOOM) {
      touchStartX.current = null
      return
    }
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    if (dx < 0) goNext()
    else goPrev()
  }

  // سحب للتحريك (pan) عند التكبير — ماوس
  const onPanStart = (e: React.PointerEvent) => {
    if (zoom <= MIN_ZOOM) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }
  const onPanMove = (e: React.PointerEvent) => {
    if (!panStart.current) return
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    })
  }
  const onPanEnd = () => {
    panStart.current = null
  }

  if (!images || images.length === 0) {
    return (
      <Card className="border-border/50 p-16 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary/60">
          <ImageOff className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <p className="text-sm text-muted-foreground">لا توجد صور في هذا المعرض</p>
      </Card>
    )
  }

  return (
    <>
      {/* الشبكة الرئيسية */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setLightboxIndex(i)}
            className="group relative aspect-video overflow-hidden rounded-xl border border-border/50 bg-card/40 transition-all duration-200 hover:border-border cursor-pointer"
          >
            <Image
              src={img}
              alt={`${modName} - صورة ${i + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
              onError={handleImageError}
            />
            {/* overlay عند الـ hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all group-hover:bg-background/30 group-hover:opacity-100">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-background/90 backdrop-blur shadow-lg">
                <ZoomIn className="h-5 w-5 text-primary" />
              </div>
            </div>
            {/* رقم الصورة في الزاوية */}
            <div className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-bold text-foreground backdrop-blur">
              {i + 1}
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox modal — full screen */}
      {isOpen && lightboxIndex !== null && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black" onClick={closeLightbox}>
          {/* شريط علوي — العداد + الدقة + التفاصيل | أزرار التحكم */}
          <div
            className="flex items-center justify-between gap-2 bg-black/80 px-3 py-2.5 backdrop-blur sm:px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* العداد + الدقة + اسم التعريب */}
            <div className="flex min-w-0 items-center gap-2">
              <div className="shrink-0 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-black tabular-nums text-white sm:text-sm">
                {lightboxIndex + 1} / {images.length}
              </div>
              <div
                className="shrink-0 rounded-md bg-white/10 px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-white/80 sm:text-xs"
                title="دقة الصورة الأصلية"
              >
                {dimensions ?? '…'}
              </div>
              <div className="hidden truncate text-xs text-white/60 md:block">
                {modName} — صورة {lightboxIndex + 1}
              </div>
            </div>

            {/* أزرار التحكم */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30 sm:h-10 sm:w-10"
                aria-label="تصغير"
                title="تصغير (-)"
              >
                <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                onClick={resetView}
                className="grid h-9 min-w-9 place-items-center rounded-md bg-white/10 px-2 text-[11px] font-black tabular-nums text-white transition-colors hover:bg-white/20 sm:h-10 sm:text-xs"
                aria-label="إعادة الضبط"
                title="الحجم الطبيعي (0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30 sm:h-10 sm:w-10"
                aria-label="تكبير"
                title="تكبير (+)"
              >
                <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                onClick={downloadCurrent}
                disabled={downloading}
                className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30 sm:h-10 sm:w-10"
                aria-label="تنزيل الصورة"
                title="تنزيل الصورة الأصلية"
              >
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="mx-0.5 h-7 w-px bg-white/20 sm:mx-1 sm:h-8" />
              {/* زر الإغلاق — كبير، واضح، أحمر عند الـ hover */}
              <button
                onClick={closeLightbox}
                className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-red-600 sm:h-10 sm:w-10"
                aria-label="إغلاق"
                title="إغلاق (Esc)"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>

          {/* منطقة الصورة الرئيسية + أسهم التنقّل */}
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-4"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* سهم يمين (prev في RTL) */}
            <button
              onClick={goPrev}
              className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 sm:right-4 sm:h-14 sm:w-14"
              aria-label="السابق"
              title="السابق (→)"
            >
              <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* الصورة — دبل كليك للتقريب + سحب للتحريك عند التكبير */}
            <div
              className={`flex max-h-full max-w-full items-center justify-center ${
                zoom > MIN_ZOOM ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
              style={{ touchAction: zoom > MIN_ZOOM ? 'none' : 'pan-y' }}
              onDoubleClick={toggleZoom}
              onPointerDown={onPanStart}
              onPointerMove={onPanMove}
              onPointerUp={onPanEnd}
              onPointerCancel={onPanEnd}
            >
              <Image
                src={images[lightboxIndex]}
                alt={`${modName} - صورة ${lightboxIndex + 1}`}
                width={1200}
                height={800}
                className="max-h-[70vh] max-w-full object-contain transition-transform duration-200 select-none"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                unoptimized
                draggable={false}
                onError={handleImageError}
              />
            </div>

            {/* سهم شمال (next في RTL) */}
            <button
              onClick={goNext}
              className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 sm:left-4 sm:h-14 sm:w-14"
              aria-label="التالي"
              title="التالي (←)"
            >
              <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>
          </div>

          {/* شريط المصغّرات — صغير واحترافي */}
          <div
            className="border-t border-white/10 bg-black/80 px-3 py-2 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={thumbsRef} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setLightboxIndex(i)
                    resetView()
                  }}
                  className={`relative h-10 w-16 shrink-0 overflow-hidden rounded-md border transition-all sm:h-11 sm:w-[72px] ${
                    i === lightboxIndex
                      ? 'border-primary opacity-100 ring-1 ring-primary/70'
                      : 'border-white/10 opacity-45 hover:opacity-100'
                  }`}
                  aria-label={`صورة ${i + 1}`}
                >
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="72px"
                    className="object-cover"
                    loading="lazy"
                    quality={60}
                    onError={handleImageError}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
