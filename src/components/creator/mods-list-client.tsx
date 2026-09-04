'use client'

import Image from 'next/image'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreVertical,
  Edit,
  Trash2,
  Archive,
  Send,
  Eye,
  Download,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface ModItem {
  id: string
  name: string
  slug: string
  workflowStatus: string
  views: number
  downloads: number
  endorsements: number
  rating: number
  ratingCount: number
  comments: number
  createdAt: string
  updatedAt: string
  isOriginalWork: boolean | null
  originalSource: string | null
  thumbnailUrl: string | null
  game: { id: string; name: string; slug: string } | null
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  DRAFT: { label: 'مسودة', icon: FileText, color: 'bg-gray-500' },
  IN_REVIEW: { label: 'بانتظار المراجعة', icon: Clock, color: 'bg-yellow-500' },
  APPROVED: { label: 'موافق عليه', icon: CheckCircle, color: 'bg-blue-500' },
  PUBLISHED: { label: 'منشور', icon: CheckCircle, color: 'bg-green-500' },
  ARCHIVED: { label: 'مؤرشف', icon: Archive, color: 'bg-gray-400' },
  REJECTED: { label: 'مرفوض', icon: XCircle, color: 'bg-red-500' },
}

const STATUS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'PUBLISHED', label: 'منشور' },
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'IN_REVIEW', label: 'بانتظار المراجعة' },
  { value: 'REJECTED', label: 'مرفوض' },
  { value: 'ARCHIVED', label: 'مؤرشف' },
]

export function ModsListClient({
  initialStatus,
  initialQuery,
}: {
  initialStatus: string
  initialQuery: string
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [status, setStatus] = useState(initialStatus || 'all')
  const [query, setQuery] = useState(initialQuery || '')
  const [mods, setMods] = useState<ModItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)

  const fetchMods = useCallback(
    async (pageNum = 1, signal?: AbortSignal) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (status !== 'all') params.set('status', status)
        if (query) params.set('q', query)
        params.set('page', pageNum.toString())
        params.set('limit', '20')
        const res = await fetch(`/api/creator/mods?${params.toString()}`, {
          cache: 'no-store',
          signal,
        })
        const data = await res.json()
        if (res.ok) {
          setMods(data.data?.mods || [])
          setPagination(data.data?.pagination || { page: 1, totalPages: 1, total: 0 })
          setPage(pageNum)
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to fetch mods:', error)
          // يمكن إضافة toast هنا لكن نكتفي بالسجل لتجنب الإزعاج
        }
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [status, query],
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchMods(1, controller.signal)
    return () => controller.abort()
  }, [fetchMods])

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    router.replace(
      `/creator/mods?status=${newStatus}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      { scroll: false },
    )
  }

  const handleAction = async (modId: string, action: string) => {
    if (action === 'view') {
      const mod = mods.find((m) => m.id === modId)
      if (mod) router.push(`/mod/${mod.slug}`)
      return
    }
    if (action === 'edit') {
      router.push(`/creator/mods/${modId}/edit`)
      return
    }

    const confirmMessages: Record<string, string> = {
      submit: 'هل أنت متأكد من إرسال هذا التعريب للمراجعة؟',
      archive: 'هل أنت متأكد من أرشفة هذا التعريب؟',
      delete: 'هل أنت متأكد من حذف هذا التعريب؟ لا يمكن التراجع.',
    }
    if (confirmMessages[action] && !confirm(confirmMessages[action])) return

    try {
      const res = await fetch(`/api/creator/mods/${modId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: data.data?.message || 'تم بنجاح' })
        fetchMods(page)
      } else {
        toast({
          title: data.error?.message || data.error?.details || 'فشل الإجراء',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={status === filter.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث في تعريباتك..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Mods list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : mods.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="لا توجد تعريبات بعد"
          description={
            query
              ? 'لم يتم العثور على نتائج مطابقة لبحثك'
              : 'ابدأ بإنشاء أول تعريب لك وشاركه مع المجتمع'
          }
          action={{ label: 'إنشاء تعريب جديد', href: '/creator/mods/new' }}
        />
      ) : (
        <div className="space-y-3">
          {mods.map((mod) => (
            <ModCard key={mod.id} mod={mod} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => fetchMods(page - 1)}
          >
            السابق
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            صفحة {pagination.page} من {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => fetchMods(page + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}

function ModCard({
  mod,
  onAction,
}: {
  mod: ModItem
  onAction: (id: string, action: string) => void
}) {
  const statusConfig = STATUS_CONFIG[mod.workflowStatus] || STATUS_CONFIG.DRAFT
  const StatusIcon = statusConfig.icon

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {mod.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Image
              loading="lazy"
              width={56}
              height={56}
              src={mod.thumbnailUrl}
              alt={mod.name}
              className="w-20 h-14 object-cover rounded-lg shrink-0"
            />
          ) : (
            <div className="w-20 h-14 bg-muted rounded-lg shrink-0 grid place-items-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{mod.name}</h3>
              <Badge className={cn('text-white', statusConfig.color)}>
                <StatusIcon className="h-3 w-3 ml-1" />
                {statusConfig.label}
              </Badge>
              {mod.isOriginalWork === false && (
                <Badge variant="outline" className="text-amber-500 border-amber-500">
                  من مصدر خارجي
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {mod.game?.name && <span>لعبة: {mod.game.name}</span>}
              <span className="hidden sm:inline">•</span>
              <span>{new Date(mod.createdAt).toLocaleDateString('ar-EG')}</span>
            </div>

            {mod.workflowStatus === 'PUBLISHED' && (
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" /> {(mod.views || 0).toLocaleString('ar-EG')}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="h-4 w-4" /> {(mod.downloads || 0).toLocaleString('ar-EG')}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" /> {(mod.rating || 0).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="إجراءات">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction(mod.id, 'view')}>
                <Eye className="h-4 w-4 ml-2" /> عرض
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction(mod.id, 'edit')}>
                <Edit className="h-4 w-4 ml-2" /> تعديل
              </DropdownMenuItem>
              {mod.workflowStatus === 'DRAFT' && (
                <DropdownMenuItem onClick={() => onAction(mod.id, 'submit')}>
                  <Send className="h-4 w-4 ml-2" /> إرسال للمراجعة
                </DropdownMenuItem>
              )}
              {mod.workflowStatus === 'REJECTED' && (
                <DropdownMenuItem onClick={() => onAction(mod.id, 'resubmit')}>
                  <Send className="h-4 w-4 ml-2" /> 🔄 إعادة إرسال
                </DropdownMenuItem>
              )}
              {mod.workflowStatus === 'PUBLISHED' && (
                <DropdownMenuItem onClick={() => onAction(mod.id, 'archive')}>
                  <Archive className="h-4 w-4 ml-2" /> أرشفة
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onAction(mod.id, 'delete')}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 ml-2" /> حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
