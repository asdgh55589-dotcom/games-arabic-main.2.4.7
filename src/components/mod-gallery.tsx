'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ImageOff,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'

interface ModGalleryProps {
  images: string[]
  modName: string
}

/**
 * ModGallery — معرض صور احترافي مع lightbox.
 *
 * المميزات:
 *   - شبكة صور بحدود فاصلة واضحة
 *   - Lightbox modal عند الضغط على أي صورة
 *   - زر إغلاق كبير وواضح في أعلى اليمين (دائماً مرئي)
 *   - تنقّل بين الصور (أسهم كبيرة + keyboard arrows)
 *   - تكبير/تصغير (zoom in/out)
 *   - ملء الشاشة
 *   - شريط مصغّرات في الأسفل
 *   - عدّاد الصور
 *   - دعم keyboard (Esc للإغلاق، arrows للتنقّل، +/- للتكبير)
 *   - النقر على الخلفية بيغلق الـ lightbox
 */
export function ModGallery({ images, modName }: ModGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)

  const isOpen = lightboxIndex !== null

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
    setZoom(1)
  }, [])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length))
    setZoom(1)
  }, [images.length])

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
    setZoom(1)
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowLeft') goNext() // RTL: left = next
      else if (e.key === 'ArrowRight') goPrev() // RTL: right = prev
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, z + 0.25))
      else if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, closeLightbox, goNext, goPrev])

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
            <img
              src={img}
              alt={`${modName} - صورة ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => { e.currentTarget.src = FALLBACK_GAME_IMAGE }}
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
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black"
          onClick={closeLightbox}
        >
          {/* شريط علوي ثابت — عدّاد الصور + أزرار التحكم */}
          <div
            className="flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-bold text-white">
                {lightboxIndex + 1} / {images.length}
              </div>
              <div className="hidden text-xs text-white/60 sm:block">
                اضغط خارج الصورة أو Esc للإغلاق
              </div>
            </div>

            {/* أزرار التحكم في التكبير + الإغلاق */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="تكبير"
                title="تكبير (+)"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="تصغير"
                title="تصغير (-)"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="إعادة الضبط"
                title="الحجم الطبيعي"
              >
                <Maximize2 className="h-5 w-5" />
              </button>
              <div className="mx-1 h-8 w-px bg-white/20" />
              {/* زر الإغلاق — كبير، واضح، أحمر عند الـ hover */}
              <button
                onClick={closeLightbox}
                className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-red-600"
                aria-label="إغلاق"
                title="إغلاق (Esc)"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* منطقة الصورة الرئيسية + أسهم التنقّل */}
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* سهم يمين (prev في RTL) — كبير */}
            <button
              onClick={goPrev}
              className="absolute right-4 top-1/2 z-10 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30"
              aria-label="السابق"
              title="السابق (→)"
            >
              <ChevronRight className="h-7 w-7" />
            </button>

            {/* الصورة */}
            <img
              src={images[lightboxIndex]}
              alt={`${modName} - صورة ${lightboxIndex + 1}`}
              className="max-h-full max-w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              onError={(e) => { e.currentTarget.src = FALLBACK_GAME_IMAGE }}
            />

            {/* سهم شمال (next في RTL) — كبير */}
            <button
              onClick={goNext}
              className="absolute left-4 top-1/2 z-10 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30"
              aria-label="التالي"
              title="التالي (←)"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          </div>

          {/* شريط المصغّرات في الأسفل */}
          <div
            className="border-t border-white/10 bg-black/80 px-4 py-3 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setLightboxIndex(i)
                    setZoom(1)
                  }}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 transition-all ${
                    i === lightboxIndex
                      ? 'border-primary opacity-100 ring-2 ring-primary/50'
                      : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = FALLBACK_GAME_IMAGE }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
