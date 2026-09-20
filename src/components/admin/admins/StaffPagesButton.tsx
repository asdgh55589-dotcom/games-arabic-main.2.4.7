'use client'

import { Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { ADMIN_PAGE_GROUPS, roleSeesPageByDefault } from '@/lib/admin-pages'
import { ApiError, apiFetch } from '@/lib/api-client'

interface Props {
  user: { id: string; username: string; role: string }
  currentUserRole: string
  onSaved?: () => void
}

/** زر تحديد صفحات اللوحة لإداري (مالك فقط) — يُعرض بجانب إجراءات المستخدم. */
export function StaffPagesButton({ user, currentUserRole, onSaved }: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [hasCustom, setHasCustom] = useState(false)

  // فقط المالك، ولغير المالكين من الإداريين فقط
  if (currentUserRole !== 'owner') return null
  if (!['moderator', 'admin', 'manager'].includes(user.role)) return null

  const load = async () => {
    setLoading(true)
    try {
      const json = await apiFetch<{ data: { pages: string[] | null } }>(
        `/api/admin/users/${user.id}/pages`,
      )
      const pages = json.data.pages
      setHasCustom(Array.isArray(pages) && pages.length > 0)
      if (pages) {
        setSelected(pages)
      } else {
        // افتراضي الرتبة مُعلَّم مبدئياً لتسهيل التخصيص
        setSelected(
          ADMIN_PAGE_GROUPS.flatMap((g) => g.pages)
            .filter((d) => roleSeesPageByDefault(user.role, d))
            .map((d) => d.key),
        )
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل تحميل الصلاحيات',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // حمّل عند الفتح فقط (hooks بعد الـ early return ممنوعة — لذا التحميل هنا يدوي)
  const handleOpen = (v: boolean) => {
    setOpen(v)
    if (v) load()
  }

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const save = async () => {
    if (saving || selected.length === 0) return
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${user.id}/pages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: selected }),
      })
      toast({
        title: 'تم الحفظ',
        description: 'سيحتاج المستخدم لتسجيل الدخول مجدداً لتطبيق الصلاحيات',
      })
      setOpen(false)
      onSaved?.()
    } catch (err) {
      toast({
        title: 'خطأ',
        description:
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'فشل الحفظ',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    if (saving) return
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${user.id}/pages`, { method: 'DELETE' })
      toast({ title: 'تمت الإزالة', description: 'عاد المستخدم للنظام الافتراضي حسب رتبته' })
      setOpen(false)
      onSaved?.()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => handleOpen(true)}
        title="صلاحيات صفحات اللوحة"
      >
        <ShieldCheck className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>صفحات اللوحة — {user.username}</DialogTitle>
            <DialogDescription>
              حدد الصفحات التي يراها ويفتحها. غير المحدد يختفي من قائمته ويُمنع بالرابط.
              {hasCustom ? ' (يوجد تخصيص حالي)' : ' (حاليا: النظام الافتراضي حسب الرتبة)'}
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {ADMIN_PAGE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-xs font-black text-muted-foreground">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.pages.map((page) => {
                      const byDefault = roleSeesPageByDefault(user.role, page)
                      return (
                        <label
                          key={page.key}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-accent/40"
                        >
                          <Checkbox
                            checked={selected.includes(page.key)}
                            onCheckedChange={() => toggle(page.key)}
                          />
                          <span className="flex-1 text-sm font-bold">{page.label}</span>
                          {!byDefault && (
                            <span className="text-[10px] font-bold text-muted-foreground">
                              فوق رتبته
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2">
            {hasCustom && (
              <Button variant="ghost" onClick={resetToDefault} disabled={saving}>
                عودة للافتراضي
              </Button>
            )}
            <Button onClick={save} disabled={saving || selected.length === 0} className="min-h-[44px]">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ ({selected.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
