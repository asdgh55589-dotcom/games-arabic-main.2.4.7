'use client'

import { useCallback, useEffect, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Input } from '@/components/official-ui/input'
import { Label } from '@/components/official-ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useDragReorder } from '@/hooks/use-drag-reorder'
import { useTeamPermissions } from '@/hooks/use-team-permissions'
import { reportError } from '@/lib/error-reporting'

interface TabRow {
  id: string
  title: string
  content: string
  visible: boolean
}

const MAX_TABS = 3

function SortableTab({
  tab,
  busyId,
  onToggle,
  onRemove,
  canEdit = true,
}: {
  tab: TabRow
  busyId: string | null
  onToggle: (tab: TabRow) => void
  onRemove: (id: string) => void
  canEdit?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-border/60 p-2 transition-colors hover:bg-muted/40 ${isDragging ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="سحب لإعادة الترتيب"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{tab.title}</span>
      <span className="text-xs text-muted-foreground">{tab.visible ? 'ظاهر' : 'مخفي'}</span>
      <Button variant="outline" size="sm" disabled={!canEdit || busyId === tab.id} aria-disabled={!canEdit} title={!canEdit ? 'ليس لديك صلاحية' : undefined} onClick={() => onToggle(tab)}>
        {tab.visible ? 'إخفاء' : 'إظهار'}
      </Button>
      <Button variant="outline" size="sm" disabled={!canEdit || busyId === tab.id} aria-disabled={!canEdit} title={!canEdit ? 'ليس لديك صلاحية' : undefined} onClick={() => onRemove(tab.id)}>
        حذف
      </Button>
    </div>
  )
}

interface TeamCustomTabsProps {
  userRole?: string | null
  teamRole?: string | null
}

export function TeamCustomTabs({ userRole, teamRole }: TeamCustomTabsProps = {}) {
  const { toast } = useToast()
  const perms = useTeamPermissions(userRole ?? teamRole)
  const [tabs, setTabs] = useState<TabRow[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchTabs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/creator/team/custom-tabs', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) setTabs(json.data?.tabs ?? [])
    } catch (err) {
      // advisory list — form stays usable, but log the failure
      reportError(err, { route: 'creator-team-tabs', action: 'load' })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTabs()
  }, [fetchTabs])

  const handleReorder = useCallback(
    async (newOrder: TabRow[]) => {
      const prev = tabs
      setTabs(newOrder)
      try {
        const res = await fetch('/api/creator/team/custom-tabs/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: newOrder.map((t) => t.id) }),
        })
        if (!res.ok) throw new Error('reorder failed')
      } catch (err) {
        reportError(err, { route: 'creator-team-tabs', action: 'reorder' })
        toast({ title: 'تعذر إعادة الترتيب — حاول مجدداً', variant: 'destructive' })
        fetchTabs()
      }
    },
    [tabs, fetchTabs, toast],
  )

  const { sensors, handleDragEnd, DndContext, SortableContext } = useDragReorder(tabs, handleReorder)

  const add = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/creator/team/custom-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تمت إضافة التبويب' })
        setTitle('')
        setContent('')
        fetchTabs()
      } else {
        toast({ title: json?.error?.message || 'فشل إضافة التبويب', variant: 'destructive' })
      }
    } catch (err) {
      reportError(err, { route: 'creator-team-tabs', action: 'mutate' })
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setSaving(false)
  }

  const toggleVisible = async (tab: TabRow) => {
    setBusyId(tab.id)
    try {
      const res = await fetch(`/api/creator/team/custom-tabs/${encodeURIComponent(tab.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !tab.visible }),
      })
      if (res.ok) {
        fetchTabs()
      } else {
        const json = await res.json().catch(() => null)
        toast({ title: json?.error?.message || 'فشل الحفظ', variant: 'destructive' })
      }
    } catch (err) {
      reportError(err, { route: 'creator-team-tabs', action: 'mutate' })
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setBusyId(null)
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/creator/team/custom-tabs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({ title: 'تم حذف التبويب' })
        fetchTabs()
      } else {
        const json = await res.json().catch(() => null)
        toast({ title: json?.error?.message || 'فشل الحذف', variant: 'destructive' })
      }
    } catch (err) {
      reportError(err, { route: 'creator-team-tabs', action: 'mutate' })
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setBusyId(null)
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">التبويبات المخصصة ({tabs.length}/{MAX_TABS})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-12 animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="جارٍ التحميل" />
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={tabs.map((t) => t.id)}>
              <div className="space-y-2">
                {tabs.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تبويبات مخصصة بعد</p>}
                {tabs.map((t) => (
                  <SortableTab key={t.id} tab={t} busyId={busyId} onToggle={toggleVisible} onRemove={remove} canEdit={perms.canEditTabs} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {tabs.length < MAX_TABS && (
          <div className="space-y-2 border-t pt-3">
            <div className="space-y-2">
              <Label htmlFor="tab-title">عنوان التبويب</Label>
              <Input id="tab-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tab-content">المحتوى</Label>
              <Textarea id="tab-content" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
            </div>
            <Button size="sm" disabled={!perms.canEditTabs || saving || !title.trim()} aria-disabled={!perms.canEditTabs} title={!perms.canEditTabs ? 'ليس لديك صلاحية' : undefined} onClick={add}>
              {saving ? '...' : 'إضافة التبويب'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
