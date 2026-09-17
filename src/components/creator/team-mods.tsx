'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Input } from '@/components/official-ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'

interface TeamMod {
  id: string
  name: string
  slug: string
  workflowStatus: string
  downloads: number
  rating: number
  createdAt: string
}

interface AvailableMod {
  id: string
  name: string
  slug: string
  workflowStatus: string
  downloads: number
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  APPROVED: 'مقبول',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
  REJECTED: 'مرفوض',
}

export function TeamMods() {
  const { toast } = useToast()
  const [mods, setMods] = useState<TeamMod[]>([])
  const [available, setAvailable] = useState<AvailableMod[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionId, setActionId] = useState<string | null>(null)
  const [pendingUnlink, setPendingUnlink] = useState<TeamMod | null>(null)

  const fetchMods = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (q.trim()) params.set('q', q.trim())
      const [a, b] = await Promise.all([
        fetch(`/api/creator/team/mods?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/creator/team/mods/available', { cache: 'no-store' }),
      ])
      const ja = await a.json().catch(() => null)
      const jb = await b.json().catch(() => null)
      if (a.ok) {
        setMods(ja.data ?? [])
        setTotalPages(ja.pagination?.totalPages || 1)
      }
      if (b.ok) setAvailable(jb.data?.mods ?? [])
    } catch {
      // list errors surface via empty state; actions toast individually
    }
    setLoading(false)
  }, [page, q])

  useEffect(() => {
    fetchMods()
  }, [fetchMods])

  const link = async (modId: string) => {
    setActionId(modId)
    try {
      const res = await fetch('/api/creator/team/mods/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modId }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم ربط التعريب بالفريق' })
        fetchMods()
      } else {
        toast({ title: json?.error?.message || 'فشل الربط', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const confirmUnlink = async () => {
    if (!pendingUnlink) return
    const mod = pendingUnlink
    setPendingUnlink(null)
    setActionId(mod.id)
    try {
      const res = await fetch('/api/creator/team/mods/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modId: mod.id }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم إلغاء ربط التعريب' })
        fetchMods()
      } else {
        toast({ title: json?.error?.message || 'فشل إلغاء الربط', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setPage(1)
            setQ(e.target.value)
          }}
          placeholder="ابحث باسم التعريب..."
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تعريبات الفريق ({mods.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {loading && (
            <div className="space-y-2 p-3" aria-busy="true" aria-label="جارٍ التحميل">
              {[0, 1].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}
          {!loading && mods.length === 0 && (
            <div className="p-3">
              <EmptyState icon="file" title="لا توجد تعريبات مرتبطة" description="اربط تعريباتك الخاصة من القائمة أدناه" />
            </div>
          )}
          {mods.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1 basis-40">
                <Link href={`/mod/${m.slug}`} className="truncate text-sm font-medium text-primary hover:underline">
                  {m.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {m.downloads} تحميل · {new Date(m.createdAt).toLocaleDateString('ar')}
                </p>
              </div>
              <Badge variant="secondary">{STATUS_LABELS[m.workflowStatus] ?? m.workflowStatus}</Badge>
              <Button variant="outline" size="sm" disabled={actionId === m.id} onClick={() => setPendingUnlink(m)}>
                إلغاء الربط
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">اربط تعريباً من تعريباتك</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {available.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">جميع تعريباتك مرتبطة بفرق بالفعل</p>
          )}
          {available.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
              <Button size="sm" disabled={actionId === m.id} onClick={() => link(m.id)}>
                {actionId === m.id ? '...' : 'ربط'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={pendingUnlink !== null} onOpenChange={(open) => !open && setPendingUnlink(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء ربط التعريب؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم فصل {pendingUnlink?.name} عن الفريق. التعريب نفسه لن يُحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlink}>تأكيد إلغاء الربط</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
