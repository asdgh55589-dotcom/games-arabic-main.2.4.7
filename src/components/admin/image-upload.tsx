'use client'

import Image from 'next/image'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ImageUploadProps {
  bucket: 'mods' | 'teams' | 'series' | 'news' | string
  value?: string
  values?: string[] // for gallery
  onChange?: (url: string) => void
  onValuesChange?: (urls: string[]) => void
  label?: string
  hint?: string
  required?: boolean
  multiple?: boolean
  accept?: string
  maxSizeMB?: number
  folder?: string
  modId?: string // لصور التعديلات فقط — يُستخدم مع Cloudinary
}

export function ImageUpload({
  bucket,
  value,
  values,
  onChange,
  onValuesChange,
  label,
  hint,
  required,
  multiple = false,
  accept = 'image/*',
  maxSizeMB = 10,
  folder = '',
  modId,
}: ImageUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewModal, setPreviewModal] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync preview with value when parent updates (e.g., initial load)
  useEffect(() => {
    if (value) setPreview(value)
  }, [value])

  const isMultiple = multiple || Array.isArray(values)

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`الملف كبير جداً — الحد الأقصى ${maxSizeMB}MB`)
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('الملف يجب أن يكون صورة')
        return
      }

      setUploading(true)
      setError(null)

      try {
        // صور التعديلات → Cloudinary (صور الغلاف، البانر، لقطات الشاشة)
        // باقي الصور (أفاتار، بنر المستخدم، شعار الفريق) → تبقى على Supabase Storage
        if (bucket === 'mods') {
          const typeMap: Record<string, string> = {
            banners: 'banner',
            thumbnails: 'cover',
            gallery: 'screenshot',
          }
          const imageType = typeMap[folder] || (folder === 'gallery' ? 'screenshot' : 'cover')
          // حاول استخراج modId من الـ prop أو من الـ URL
          let effectiveModId = modId
          if (!effectiveModId && typeof window !== 'undefined') {
            const match = window.location.pathname.match(/\/admin\/mods\/([^/]+)/)
            if (match && match[1] !== 'new') effectiveModId = match[1]
            else effectiveModId = 'new'
          }
          if (!effectiveModId) effectiveModId = 'new'

          const formData = new FormData()
          formData.append('file', file)
          formData.append('type', imageType)
          formData.append('modId', effectiveModId)

          const res = await fetch('/api/storage/upload-mod-image', {
            method: 'POST',
            body: formData,
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) {
            const msg = data?.error?.message || data?.error?.details || 'فشل رفع الصورة إلى Cloudinary'
            throw new Error(msg)
          }
          const publicUrl = data?.data?.url
          if (!publicUrl) throw new Error('لم يتم إرجاع رابط الصورة من الخادم')

          if (isMultiple && onValuesChange && values) {
            onValuesChange([...values, publicUrl])
          } else {
            onChange?.(publicUrl)
            setPreview(publicUrl)
          }
          return
        }

        // باقي الـ buckets → Supabase Storage (أفاتار، فرق، إلخ)
        const supabase = createClient()
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = folder ? `${folder}/${fileName}` : fileName

        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

        if (uploadError) {
          // Bucket might not exist
          if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
            throw new Error(`Bucket "${bucket}" غير موجود — أنشئه في Supabase Dashboard → Storage → New Bucket (Public)`)
          }
          throw uploadError
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        const publicUrl = data.publicUrl

        if (isMultiple && onValuesChange && values) {
          onValuesChange([...values, publicUrl])
        } else {
          onChange?.(publicUrl)
          setPreview(publicUrl)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'فشل الرفع'
        setError(msg)
      } finally {
        setUploading(false)
      }
    },
    [bucket, folder, isMultiple, maxSizeMB, modId, onChange, onValuesChange, values]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      if (isMultiple) {
        files.forEach((f) => uploadFile(f))
      } else if (files[0]) {
        uploadFile(files[0])
      }
    },
    [isMultiple, uploadFile]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (isMultiple) {
      files.forEach((f) => uploadFile(f))
    } else if (files[0]) {
      uploadFile(files[0])
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRemove = (urlToRemove?: string) => {
    if (isMultiple && onValuesChange && values && urlToRemove) {
      onValuesChange(values.filter((u) => u !== urlToRemove))
    } else {
      onChange?.('')
      setPreview(null)
    }
  }

  const displayValue = isMultiple ? null : value || preview

  return (
    <div className="space-y-2">
      {label && (
        <Label className="flex items-center gap-1 text-sm">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      {/* Single image */}
      {!isMultiple && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !displayValue && !uploading && inputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30'
            } ${uploading ? 'pointer-events-none opacity-60' : ''} ${!displayValue ? 'cursor-pointer' : ''}`}
          >
            {displayValue ? (
              <div className="relative h-40 w-full overflow-hidden rounded-md border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image unoptimized sizes="(max-width: 768px) 100vw, 50vw" fill src={displayValue} alt={label || 'صورة'} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewModal(displayValue)
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-black shadow hover:bg-white"
                    title="معاينة"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      inputRef.current?.click()
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90"
                    title="تغيير"
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove()
                  }}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/90"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white">اضغط للمعاينة</span>
              </div>
            ) : (
              <div onClick={() => !uploading && inputRef.current?.click()} className="flex w-full cursor-pointer flex-col items-center gap-2">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium">اسحب الصورة هنا أو اضغط للاختيار</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WebP — حتى {maxSizeMB}MB — أعلى جودة</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Upload className="h-3 w-3" /> سحب وإفلات مدعوم
                </div>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-background/50 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>

          <Input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Manual URL fallback */}
          <div className="flex gap-2">
            <Input
              value={value || ''}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="أو الصق رابط الصورة https://..."
              className="flex-1 text-xs"
            />
          </div>
        </>
      )}

      {/* Multiple gallery */}
      {isMultiple && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            <span className="text-sm">اسحب الصور هنا أو اضغط للرفع (متعدد)</span>
          </div>
          <Input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handleFileSelect} />

          {values && values.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {values.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-md border border-border bg-muted"
                  onClick={() => setPreviewModal(url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Image unoptimized sizes="(max-width: 768px) 100vw, 50vw" fill src={url} alt={`gallery-${idx}`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(url)
                    }}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 hidden rounded bg-black/60 px-1 py-0.5 text-[9px] text-white group-hover:block">
                    معاينة
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Manual URLs fallback for gallery */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">أو روابط المعرض (سطر لكل رابط)</Label>
            <textarea
              value={(values || []).join('\n')}
              onChange={(e) => onValuesChange?.(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
              rows={3}
              placeholder="https://..."
              className="w-full rounded-md border border-border bg-background p-2 text-xs"
            />
          </div>
        </>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setPreviewModal(null)}>
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl border-2 border-white/20 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image width={800} height={600} src={previewModal} alt="معاينة" className="max-h-[80vh] w-auto max-w-full object-contain" />
            <div className="flex items-center justify-between border-t border-border bg-card p-3">
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {previewModal}
              </p>
              <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => setPreviewModal(null)}>
                إغلاق
              </Button>
            </div>
            <button
              onClick={() => setPreviewModal(null)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
