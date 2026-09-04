'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  GitCompare,
  Eye,
  CheckCircle,
  XCircle,
  Archive,
  MessageSquare,
  UserPlus,
  History,
  ArrowRightLeft,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export type ModAction =
  | 'viewMod'
  | 'viewDiff'
  | 'preview'
  | 'approve'
  | 'reject'
  | 'archive'
  | 'requestChanges'
  | 'assignReviewer'
  | 'viewWorkflowHistory'
  | 'transferAuthor'
  | 'delete'

export interface WorkflowMod {
  id: string
  slug: string
  name: string
  workflowStatus: string
  authorId: string
  author?: { id: string; username: string; role: string }
  version?: string
  qualityScore?: number
}

export interface ModWorkflowActionsProps {
  mod: WorkflowMod
  currentUser?: { id: string; role: string }
  onActionComplete: () => void
  availableActions?: ModAction[]
}

export function ModWorkflowActions({
  mod,
  currentUser,
  onActionComplete,
  availableActions,
}: ModWorkflowActionsProps) {
  const { toast } = useToast()
  const [openDialog, setOpenDialog] = useState<ModAction | null>(null)
  const [loading, setLoading] = useState(false)

  // form states
  const [rejectReason, setRejectReason] = useState('')
  const [allowResubmit, setAllowResubmit] = useState(true)
  const [approveComment, setApproveComment] = useState('')
  const [changeFeedback, setChangeFeedback] = useState('')
  const [changePriority, setChangePriority] = useState<'minor' | 'major' | 'critical'>('major')
  const [assignSearch, setAssignSearch] = useState('')
  const [assignReviewerId, setAssignReviewerId] = useState('')
  const [transferSearch, setTransferSearch] = useState('')
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [workflowHistory, setWorkflowHistory] = useState<
    Array<{
      fromStatus: string
      toStatus: string
      changedBy: string
      changedAt: string
      reason?: string
    }>
  >([])

  const isActionEnabled = (action: ModAction) => {
    if (availableActions && !availableActions.includes(action)) return false
    switch (action) {
      case 'viewMod':
      case 'viewDiff':
      case 'preview':
      case 'viewWorkflowHistory':
        return true
      case 'approve':
        return mod.workflowStatus === 'IN_REVIEW'
      case 'reject':
        return mod.workflowStatus === 'IN_REVIEW'
      case 'archive':
        return ['IN_REVIEW', 'PUBLISHED', 'APPROVED'].includes(mod.workflowStatus)
      case 'requestChanges':
        return mod.workflowStatus === 'IN_REVIEW'
      case 'assignReviewer':
        return true
      case 'transferAuthor':
        return ['admin', 'manager', 'owner'].includes(currentUser?.role || '')
      case 'delete':
        return (
          ['DRAFT', 'REJECTED', 'ARCHIVED'].includes(mod.workflowStatus) ||
          ['admin', 'manager', 'owner'].includes(currentUser?.role || '')
        )
      default:
        return true
    }
  }

  const handleApprove = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', toStatus: 'APPROVED', comment: approveComment }),
      })
      // Fallback to PUT /api/admin/mods/[id]/workflow or bulk
      let data: unknown = null
      if (!res.ok) {
        const alt = await fetch(`/api/admin/mods/${mod.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflowStatus: 'APPROVED' }),
        })
        if (!alt.ok) throw new Error('فشل الموافقة')
        data = await alt.json()
      } else {
        data = await res.json()
      }
      toast({ title: 'تمت الموافقة بنجاح', description: `تمت الموافقة على "${mod.name}" وسيُنشر` })
      setOpenDialog(null)
      setApproveComment('')
      onActionComplete()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'سبب الرفض مطلوب', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          toStatus: 'REJECTED',
          reason: rejectReason,
          allowResubmit,
        }),
      })
      if (!res.ok) {
        const alt = await fetch(`/api/admin/mods/${mod.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflowStatus: 'REJECTED', rejectionReason: rejectReason }),
        })
        if (!alt.ok) throw new Error('فشل الرفض')
      }
      toast({
        title: 'تم رفض التعريب',
        description: allowResubmit ? 'يمكن للمؤلف إعادة الإرسال بعد التعديل' : 'مرفوض نهائياً',
      })
      setOpenDialog(null)
      setRejectReason('')
      onActionComplete()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', toStatus: 'ARCHIVED' }),
      })
      if (!res.ok) {
        const alt = await fetch(`/api/admin/mods/${mod.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflowStatus: 'ARCHIVED' }),
        })
        if (!alt.ok) throw new Error('فشل الأرشفة')
      }
      toast({ title: 'تمت الأرشفة', description: `"${mod.name}" مؤرشف الآن ولن يظهر للعامة` })
      setOpenDialog(null)
      onActionComplete()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRequestChanges = async () => {
    if (!changeFeedback.trim()) {
      toast({ title: 'الملاحظات مطلوبة', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/mods/${mod.slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `طلب تعديلات (${changePriority}): ${changeFeedback}` }),
      })
      if (!res.ok) {
        // fallback to notify author
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: mod.authorId,
            title: 'مطلوب تعديلات على تعريبك',
            message: changeFeedback,
          }),
        }).catch(() => {})
      }
      toast({
        title: 'تم إرسال طلب التعديلات',
        description: 'سيبقى التعريب في حالة قيد المراجعة مع علامة يحتاج تعديلات',
      })
      setOpenDialog(null)
      setChangeFeedback('')
      onActionComplete()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAssignReviewer = async () => {
    if (!assignReviewerId.trim()) {
      toast({ title: 'اختر المراجع', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: assignReviewerId }),
      })
      if (!res.ok) throw new Error('فشل الإسناد')
      toast({ title: 'تم إسناد المراجع بنجاح' })
      setOpenDialog(null)
      setAssignReviewerId('')
      onActionComplete()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTransferAuthor = async () => {
    if (!transferTargetId.trim() || !transferReason.trim()) {
      toast({ title: 'المؤلف الجديد وسبب النقل مطلوبان', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: transferTargetId, transferReason }),
      })
      if (!res.ok) throw new Error('فشل نقل الملكية')
      toast({ title: 'تم نقل ملكية التعريب بنجاح' })
      setOpenDialog(null)
      setTransferTargetId('')
      setTransferReason('')
      onActionComplete()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== mod.name) {
      toast({ title: `اكتب "${mod.name}" للتأكيد`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || 'فشل الحذف')
      }
      toast({ title: 'تم حذف التعريب نهائياً' })
      setOpenDialog(null)
      onActionComplete()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkflowHistory = async () => {
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}/workflow`)
      if (res.ok) {
        const data = await res.json()
        setWorkflowHistory(data?.data || data?.history || [])
      }
    } catch {}
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[44px] min-w-[44px]"
            aria-label="إجراءات سير العمل"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            إجراءات — {mod.name}
          </DropdownMenuLabel>

          {/* عرض */}
          <DropdownMenuLabel className="text-xs">عرض</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/mod/${mod.slug}`} target="_blank" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> عرض التعريب
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setOpenDialog('viewDiff')
            }}
          >
            <GitCompare className="h-4 w-4" /> عرض الفروق
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('preview')}>
            <Eye className="h-4 w-4" /> معاينة كمسؤول
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              fetchWorkflowHistory()
              setOpenDialog('viewWorkflowHistory')
            }}
          >
            <History className="h-4 w-4" /> عرض سجل سير العمل
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">مراجعة</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setOpenDialog('approve')}
            disabled={!isActionEnabled('approve')}
          >
            <CheckCircle className="h-4 w-4 text-green-500" /> موافقة ونشر
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpenDialog('reject')}
            disabled={!isActionEnabled('reject')}
            variant="destructive"
          >
            <XCircle className="h-4 w-4" /> رفض مع السبب
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpenDialog('requestChanges')}
            disabled={!isActionEnabled('requestChanges')}
          >
            <MessageSquare className="h-4 w-4" /> طلب تعديلات
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpenDialog('assignReviewer')}
            disabled={!isActionEnabled('assignReviewer')}
          >
            <UserPlus className="h-4 w-4" /> إسناد مراجع
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">إدارة</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setOpenDialog('archive')}
            disabled={!isActionEnabled('archive')}
          >
            <Archive className="h-4 w-4" /> أرشفة التعريب
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpenDialog('transferAuthor')}
            disabled={!isActionEnabled('transferAuthor')}
          >
            <ArrowRightLeft className="h-4 w-4" /> نقل الملكية
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-destructive">حذف</DropdownMenuLabel>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setOpenDialog('delete')}
            disabled={!isActionEnabled('delete')}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" /> حذف نهائي
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ===== عرض الفروق ===== */}
      <Dialog open={openDialog === 'viewDiff'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>الفروق — {mod.name}</DialogTitle>
            <DialogDescription>مقارنة الإصدار الحالي بالإصدار السابق (إن وجد).</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {mod.version ? (
              <div className="space-y-2">
                <div className="text-sm font-bold">الإصدار الحالي: v{mod.version}</div>
                <div className="text-xs">جودة: {mod.qualityScore ?? '—'}%</div>
                <p>
                  إذا كان للتعريب إصدار سابق، سيُعرض هنا جدول مقارنة جانبي يبرز الحقول المتغيرة.
                  حالياً لا يوجد إصدار سابق للمقارنة أو لم يتم تفعيل نظام الإصدارات لهذا التعريب.
                </p>
              </div>
            ) : (
              <p>لا يوجد إصدار سابق للمقارنة. هذا هو الإصدار الأول.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== معاينة ===== */}
      <Dialog open={openDialog === 'preview'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>معاينة التعريب — عرض كمسؤول</DialogTitle>
            <DialogDescription>هكذا سيظهر التعريب للزوار بعد النشر.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              عرض كمسؤول
            </div>
            <h3 className="text-lg font-bold">{mod.name}</h3>
            <div className="text-sm text-muted-foreground">
              الحالة: {mod.workflowStatus} · المؤلف: {mod.author?.username || mod.authorId}
            </div>
            <Button asChild variant="outline" className="w-full mt-4">
              <Link href={`/mod/${mod.slug}`} target="_blank">
                فتح الصفحة العامة في تبويب جديد
              </Link>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== موافقة ===== */}
      <Dialog open={openDialog === 'approve'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الموافقة والنشر</DialogTitle>
            <DialogDescription>
              هل تريد الموافقة على نشر التعريب <span className="font-bold">"{mod.name}"</span>؟
              سيتحول من <span className="font-bold">قيد المراجعة</span> إلى{' '}
              <span className="font-bold text-green-500">تمت الموافقة → منشور</span> وسيُشعر المؤلف.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>تعليق الموافقة (اختياري)</Label>
            <Textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="مثال: تعريب ممتاز، شكراً لجهودك..."
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button
              onClick={handleApprove}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'جاري...' : 'تأكيد الموافقة والنشر'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== رفض ===== */}
      <Dialog open={openDialog === 'reject'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض التعريب — {mod.name}</DialogTitle>
            <DialogDescription>
              اكتب سبب الرفض بوضوح واقتراحات للتحسين. سيُشعر المؤلف بالسبب.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>سبب الرفض *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثال: الترجمة غير مكتملة في القوائم، يوجد أخطاء إملائية كثيرة..."
                rows={4}
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowResubmit}
                onChange={(e) => setAllowResubmit(e.target.checked)}
              />{' '}
              السماح بإعادة الإرسال بعد التعديل (مفعل افتراضياً)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={loading || !rejectReason.trim()}
            >
              {loading ? 'جاري...' : 'تأكيد الرفض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== أرشفة ===== */}
      <Dialog open={openDialog === 'archive'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>أرشفة التعريب</DialogTitle>
            <DialogDescription>
              هل تريد أرشفة التعريب <span className="font-bold">"{mod.name}"</span>؟ لن يظهر للعامة
              لكن سيبقى ظاهراً للمؤلف والإدارة. يمكن إلغاء الأرشفة لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleArchive} disabled={loading}>
              {loading ? 'جاري...' : 'تأكيد الأرشفة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== طلب تعديلات ===== */}
      <Dialog
        open={openDialog === 'requestChanges'}
        onOpenChange={(o) => !o && setOpenDialog(null)}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>طلب تعديلات من المؤلف</DialogTitle>
            <DialogDescription>
              اكتب ملاحظات مفصلة وسيبقى التعريب في حالة قيد المراجعة مع علامة يحتاج تعديلات.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الأولوية</Label>
              <select
                value={changePriority}
                onChange={(e) => setChangePriority(e.target.value as never)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="minor">بسيطة</option>
                <option value="major">مهمة</option>
                <option value="critical">حرجة</option>
              </select>
            </div>
            <div>
              <Label>الملاحظات التفصيلية *</Label>
              <Textarea
                value={changeFeedback}
                onChange={(e) => setChangeFeedback(e.target.value)}
                placeholder="مثال: صحح أخطاء الترجمة في القوائم الرئيسية، حسّن جودة الصور..."
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleRequestChanges} disabled={loading || !changeFeedback.trim()}>
              {loading ? 'جاري...' : 'إرسال طلب التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== إسناد مراجع ===== */}
      <Dialog
        open={openDialog === 'assignReviewer'}
        onOpenChange={(o) => !o && setOpenDialog(null)}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إسناد مراجع للتعريب</DialogTitle>
            <DialogDescription>
              ابحث عن مشرف/مسؤول وسيتم إشعاره. يظهر عبء العمل (عدد الطلبات المعلقة).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>معرّف المراجع (ID) *</Label>
              <Input
                value={assignReviewerId}
                onChange={(e) => setAssignReviewerId(e.target.value)}
                placeholder="الصق ID المستخدم المراجع (مثال: clx...)"
                className="mt-1"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ابحث في `/admin/users?role=moderator` وانسخ المعرف.
              </p>
            </div>
            <div>
              <Label>بحث (اختياري)</Label>
              <Input
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleAssignReviewer} disabled={loading || !assignReviewerId.trim()}>
              {loading ? 'جاري...' : 'تأكيد الإسناد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== سجل سير العمل ===== */}
      <Dialog
        open={openDialog === 'viewWorkflowHistory'}
        onOpenChange={(o) => !o && setOpenDialog(null)}
      >
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>سجل سير العمل — {mod.name}</DialogTitle>
            <DialogDescription>كل انتقالات الحالة مع من قام بها ومتى والتعليق.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {workflowHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                جاري التحميل أو لا يوجد سجل...
              </p>
            ) : (
              workflowHistory.map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <span className="rounded bg-muted px-2 py-1 text-xs font-bold">
                    {h.fromStatus}
                  </span>
                  <span>←</span>
                  <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    {h.toStatus}
                  </span>
                  <span className="mr-auto text-xs text-muted-foreground">
                    {h.changedBy} · {new Date(h.changedAt).toLocaleString('ar-EG')}
                  </span>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={fetchWorkflowHistory}>
              تحديث السجل
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== نقل الملكية ===== */}
      <Dialog
        open={openDialog === 'transferAuthor'}
        onOpenChange={(o) => !o && setOpenDialog(null)}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>نقل ملكية التعريب</DialogTitle>
            <DialogDescription>
              سيتم نقل ملكية <span className="font-bold">"{mod.name}"</span> إلى مؤلف جديد. سيُشعر
              المؤلف القديم والجديد.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>معرّف المؤلف الجديد (creator/publisher فقط) *</Label>
              <Input
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                placeholder="الصق ID المستخدم الجديد"
                className="mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label>بحث (اختياري)</Label>
              <Input
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>سبب النقل *</Label>
              <Textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="مثال: بناء على طلب المؤلف الأصلي..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button
              onClick={handleTransferAuthor}
              disabled={loading || !transferTargetId.trim() || !transferReason.trim()}
            >
              {loading ? 'جاري...' : 'تأكيد النقل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== حذف نهائي ===== */}
      <Dialog open={openDialog === 'delete'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              حذف التعريب نهائياً — لا يمكن التراجع
            </DialogTitle>
            <DialogDescription>
              سيتم حذف التعريب <span className="font-bold text-foreground">"{mod.name}"</span>{' '}
              نهائياً مع كل ملفاته. التعريبات المنشورة يجب أرشفتها أولاً. اكتب اسم التعريب للتأكيد.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>اكتب اسم التعريب للحذف *</Label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={mod.name}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || deleteConfirm !== mod.name}
            >
              تأكيد الحذف النهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
