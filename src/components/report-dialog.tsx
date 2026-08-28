'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from '@/lib/reports/constants'

interface ReportDialogProps {
  targetType: ReportTargetType
  targetId: string
  children?: React.ReactNode
  onSuccess?: () => void
}

export function ReportDialog({ targetType, targetId, children, onSuccess }: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: 'اختر سبب البلاغ', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, description }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: data.error?.message || 'فشل إرسال البلاغ', variant: 'destructive' })
        return
      }

      toast({ title: 'لقد تم استلام بلاغك', description: 'شكراً لمساهمتك، ستتم مراجعته قريباً' })
      onSuccess?.()
      setOpen(false)
      setReason('')
      setDescription('')
    } catch {
      toast({ title: 'حدث خطأ أثناء إرسال البلاغ', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive min-h-[44px]">
            <Flag className="h-4 w-4" />
            إبلاغ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            الإبلاغ عن محتوى
          </DialogTitle>
          <DialogDescription>
            ساعدنا في الحفاظ على جودة المحتوى. جميع البلاغات تُفحص بسرية تامة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="mb-2 block text-sm font-medium">سبب البلاغ *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">اختر سبب البلاغ...</option>
              {Object.entries(REPORT_REASONS).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">تفاصيل إضافية (اختياري)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اشرح المشكلة بالتفصيل..."
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={loading || !reason}>
            {loading ? 'جاري الإرسال...' : 'إرسال البلاغ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
