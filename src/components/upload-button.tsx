'use client'

import dynamic from 'next/dynamic'
import { Upload } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const MAX_FILE_BYTES = 2 * 1024 ** 3 // 2GB — server quota is the hard gate

// Uppy + Dashboard CSS load only when the panel mounts (code-split).
const IaUploaderPanel = dynamic(
  () => import('@/components/creator/ia-uploader').then((m) => ({ default: m.IaUploader })),
  {
    ssr: false,
    loading: () => <div className="h-[320px] animate-pulse rounded-lg bg-muted" />,
  },
)

interface UploadButtonProps {
  /** Called after at least one file finished uploading (refresh the list). */
  onUploaded?: () => void | Promise<void>
  modId?: string
  label?: string
}

/**
 * Creator files upload entry point (P0-4). Wraps IaUploader in RELAY mode —
 * the live server-streamed path — and refreshes the files list on success.
 */
export function UploadButton({ onUploaded, modId, label = 'رفع ملف' }: UploadButtonProps) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)

  const handleComplete = React.useCallback(
    async (files: Array<{ name: string }>) => {
      const count = files.length
      toast({
        title: 'تم الرفع بنجاح',
        description:
          count > 1 ? `تم رفع ${count} ملفات إلى الأرشيف` : `تم رفع «${files[0]?.name || 'الملف'}» إلى الأرشيف`,
      })
      try {
        await onUploaded?.()
      } catch {
        // Refresh failure is non-fatal — the upload itself succeeded.
      }
    },
    [onUploaded, toast],
  )

  const handleError = React.useCallback(
    (message: string) => {
      toast({
        title: 'فشل رفع الملف',
        description: message || 'حدث خطأ غير متوقع — حاول مرة أخرى',
        variant: 'destructive',
      })
    },
    [toast],
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Upload className="me-2 h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>رفع ملف جديد</DialogTitle>
          <DialogDescription>
            يُبث الملف إلى Internet Archive عبر خادم المنصة مع شريط تقدم وإيقاف/استئناف. الأنواع
            المدعومة: ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ, ISO, PDF, JPG, PNG, WebP, GIF.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <IaUploaderPanel
            mode="relay"
            modId={modId}
            maxFileSize={MAX_FILE_BYTES}
            maxNumberOfFiles={3}
            onComplete={handleComplete}
            onError={handleError}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
