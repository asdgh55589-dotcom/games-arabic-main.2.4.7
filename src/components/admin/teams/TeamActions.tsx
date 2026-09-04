'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Pencil,
  Link2,
  Layout,
  Users,
  Package,
  Gift,
  Star,
  BadgeCheck,
  Archive,
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

interface TeamItem {
  id: string
  name: string
  isFeatured: boolean
  isOfficial: boolean
}

interface TeamActionsProps {
  team: TeamItem
  onActionComplete: () => void
}

export function TeamActions({ team, onActionComplete }: TeamActionsProps) {
  const { toast } = useToast()
  const [openDialog, setOpenDialog] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editName, setEditName] = useState(team.name)
  const [editDescription, setEditDescription] = useState('')
  const [editLogo, setEditLogo] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const handleFeature = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !team.isFeatured }),
      })
      if (!res.ok) throw new Error('فشل')
      toast({ title: !team.isFeatured ? 'تم تمييز الفريق' : 'تم إلغاء التمييز' })
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

  const handleOfficial = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOfficial: !team.isOfficial }),
      })
      if (!res.ok) throw new Error('فشل')
      toast({ title: !team.isOfficial ? 'تم جعل الفريق رسمياً' : 'تم إلغاء الرسمية' })
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

  const handleArchive = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (!res.ok) {
        // fallback to PUT with hiddenTabs
        const alt = await fetch(`/api/admin/teams/${team.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFeatured: false }),
        })
        if (!alt.ok) throw new Error('فشل الأرشفة')
      }
      toast({ title: 'تمت أرشفة الفريق', description: 'لن يظهر للعامة' })
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

  const handleDelete = async () => {
    if (deleteConfirm !== team.name) {
      toast({ title: `اكتب "${team.name}" للتأكيد`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم حذف الفريق نهائياً' })
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

  const handleEditGeneral = async () => {
    if (!editName.trim()) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDescription, logoUrl: editLogo }),
      })
      if (!res.ok) throw new Error('فشل الحفظ')
      toast({ title: 'تم حفظ التعديلات' })
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-[44px] min-w-[44px]"
            aria-label="إجراءات الفريق"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            إجراءات — {team.name}
          </DropdownMenuLabel>

          <DropdownMenuItem asChild>
            <Link href={`/admin/teams/${team.id}/dashboard`} className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> عرض لوحة المعلومات
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('editGeneral')}>
            <Pencil className="h-4 w-4" /> تعديل عام (الاسم/الوصف/الشعار)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('editContact')}>
            <Link2 className="h-4 w-4" /> تعديل روابط التواصل
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/admin/teams/${team.id}/edit?tab=tabs`}
              className="flex items-center gap-2"
            >
              <Layout className="h-4 w-4" /> إدارة التبويبات
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('manageMembers')}>
            <Users className="h-4 w-4" /> إدارة الأعضاء (توسيع الصف)
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/admin/mods?team=${team.id}`} className="flex items-center gap-2">
              <Package className="h-4 w-4" /> عرض التعريبات
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/teams/${team.id}/rewards`} className="flex items-center gap-2">
              <Gift className="h-4 w-4" /> عرض المكافآت
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenDialog('feature')}>
            <Star className="h-4 w-4" /> {team.isFeatured ? 'إلغاء التمييز' : 'تمييز الفريق'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('official')}>
            <BadgeCheck className="h-4 w-4" />{' '}
            {team.isOfficial ? 'إلغاء الرسمية' : 'جعل الفريق رسمياً'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenDialog('archive')} className="text-amber-600">
            <Archive className="h-4 w-4" /> أرشفة الفريق
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setOpenDialog('delete')}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" /> حذف نهائي
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* تعديل عام */}
      <Dialog open={openDialog === 'editGeneral'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل عام — {team.name}</DialogTitle>
            <DialogDescription>عدّل الاسم والوصف والشعار</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم الفريق *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="اسم الفريق"
                className="mt-1"
              />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="وصف الفريق..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label>رابط الشعار</Label>
              <Input
                value={editLogo}
                onChange={(e) => setEditLogo(e.target.value)}
                placeholder="https://..."
                className="mt-1"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleEditGeneral} disabled={loading}>
              {loading ? 'جاري...' : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تعديل روابط التواصل */}
      <Dialog open={openDialog === 'editContact'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل روابط التواصل</DialogTitle>
            <DialogDescription>
              إدارة روابط التواصل للفريق (موقع، تيليجرام، ديسكورد...)
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            <p>إدارة الروابط تتم من صفحة التعديل الكاملة.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href={`/admin/teams/${team.id}/edit`}>فتح صفحة التعديل</Link>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تمييز */}
      <Dialog open={openDialog === 'feature'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{team.isFeatured ? 'إلغاء تمييز الفريق' : 'تمييز الفريق'}</DialogTitle>
            <DialogDescription>
              {team.isFeatured
                ? 'سيتم إلغاء تمييز الفريق من الصفحة الرئيسية.'
                : 'سيتم تمييز الفريق في الصفحة الرئيسية.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleFeature} disabled={loading}>
              {loading ? 'جاري...' : team.isFeatured ? 'إلغاء التمييز' : 'تمييز الفريق'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* رسمي */}
      <Dialog open={openDialog === 'official'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{team.isOfficial ? 'إلغاء الرسمية' : 'جعل الفريق رسمياً'}</DialogTitle>
            <DialogDescription>
              {team.isOfficial
                ? 'سيتم إلغاء صفة الرسمية عن الفريق.'
                : 'سيتم جعل الفريق رسمياً وسيظهر بشارة رسمية.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleOfficial} disabled={loading}>
              {loading ? 'جاري...' : team.isOfficial ? 'إلغاء الرسمية' : 'جعله رسمياً'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* أرشفة */}
      <Dialog open={openDialog === 'archive'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>أرشفة الفريق</DialogTitle>
            <DialogDescription>
              هل تريد أرشفة هذا الفريق؟ لن يظهر للعامة لكن بياناته ستبقى.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={loading}>
              {loading ? 'جاري...' : 'تأكيد الأرشفة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حذف */}
      <Dialog open={openDialog === 'delete'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">حذف الفريق نهائياً</DialogTitle>
            <DialogDescription>
              سيتم حذف الفريق <span className="font-bold text-foreground">"{team.name}"</span>{' '}
              نهائياً مع جميع بياناته. اكتب اسم الفريق للتأكيد.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>اكتب اسم الفريق للحذف *</Label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={team.name}
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
              disabled={loading || deleteConfirm !== team.name}
            >
              تأكيد الحذف النهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إدارة الأعضاء - توجيه للتوسيع */}
      <Dialog open={openDialog === 'manageMembers'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إدارة الأعضاء</DialogTitle>
            <DialogDescription>
              استخدم الصف القابل للتوسيع في الجدول لإدارة الأعضاء مباشرة.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            اضغط على زر التوسيع (▼) في صف الفريق لعرض الأعضاء.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              فهمت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
