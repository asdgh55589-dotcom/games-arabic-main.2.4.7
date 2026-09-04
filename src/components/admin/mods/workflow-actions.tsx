'use client'

import { Archive, Check, Globe, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getAvailableActions, WORKFLOW_LABELS, type WorkflowStatus } from '@/lib/workflow'

interface WorkflowActionsProps {
  modId: string
  currentStatus: string
  userRole: string
  onStatusChange?: (newStatus: string) => void
}

const ACTION_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    label: string
    variant: 'default' | 'outline' | 'destructive'
  }
> = {
  IN_REVIEW: { icon: Send, label: 'إرسال للمراجعة', variant: 'default' },
  APPROVED: { icon: Check, label: 'موافقة', variant: 'default' },
  REJECTED: { icon: X, label: 'رفض', variant: 'destructive' },
  PUBLISHED: { icon: Globe, label: 'نشر', variant: 'default' },
  ARCHIVED: { icon: Archive, label: 'أرشفة', variant: 'outline' },
  DRAFT: { icon: RotateCcw, label: 'إعادة للمسودة', variant: 'outline' },
}

export function WorkflowActions({
  modId,
  currentStatus,
  userRole,
  onStatusChange,
}: WorkflowActionsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<WorkflowStatus | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const available = getAvailableActions(userRole as any, currentStatus as WorkflowStatus)

  if (available.length === 0) return null

  const handleAction = (action: WorkflowStatus) => {
    setPendingAction(action)
    setReason('')
    setNotes('')
    setDialogOpen(true)
  }

  const confirmAction = async () => {
    if (!pendingAction) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${modId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus: pendingAction,
          reason: reason || undefined,
          notes: notes || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || 'فشل تحديث الحالة')
      }

      toast({
        title: 'تم تحديث الحالة',
        description: `تم التحويل إلى: ${WORKFLOW_LABELS[pendingAction]}`,
      })

      setDialogOpen(false)
      onStatusChange?.(pendingAction)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((action) => {
          const config = ACTION_CONFIG[action]
          if (!config) return null
          const Icon = config.icon
          return (
            <Button
              key={action}
              variant={config.variant}
              size="sm"
              className="min-h-[44px]"
              onClick={() => handleAction(action)}
            >
              <Icon className="ml-1 h-3.5 w-3.5" />
              {config.label}
            </Button>
          )
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction && WORKFLOW_LABELS[pendingAction]}</DialogTitle>
            <DialogDescription>هل أنت متأكد من تغيير حالة التعريب؟</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {pendingAction === 'REJECTED' && (
              <div className="space-y-2">
                <Label htmlFor="reason">سبب الرفض *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="اكتب سبب الرفض..."
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button
              variant={pendingAction === 'REJECTED' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={loading || (pendingAction === 'REJECTED' && !reason.trim())}
            >
              {loading ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
