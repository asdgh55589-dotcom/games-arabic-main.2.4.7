'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface WarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  username: string
  onSuccess: () => void
}

export function WarningDialog({ open, onOpenChange, userId, username, onSuccess }: WarningDialogProps) {
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      toast.error('سبب التحذير مطلوب (5 أحرف على الأقل)')
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`تم تحذير ${username} بنجاح`)
        setReason('')
        onOpenChange(false)
        onSuccess()
      } else {
        const msg = data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || data?.message || 'فشل إرسال التحذير'
        toast.error(msg)
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تحذير {username}</DialogTitle>
          <DialogDescription>سيتم إرسال إشعار للمستخدم مع تسجيل التحذير في سجل الإجراءات</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب التحذير (5 أحرف على الأقل)"
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'جاري الإرسال...' : 'إرسال التحذير'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
