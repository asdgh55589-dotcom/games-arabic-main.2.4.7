'use client'

import {
  Archive,
  CheckCircle,
  Clock,
  Download,
  Edit,
  Eye,
  FileText,
  MoreVertical,
  Search,
  Send,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import type { StudioDict } from '@/lib/studio-i18n/types'
import { cn } from '@/lib/utils'

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

const STATUS_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  DRAFT: { icon: FileText, color: 'bg-gray-500' },
  IN_REVIEW: { icon: Clock, color: 'bg-yellow-500' },
  APPROVED: { icon: CheckCircle, color: 'bg-blue-500' },
  PUBLISHED: { icon: CheckCircle, color: 'bg-green-500' },
  ARCHIVED: { icon: Archive, color: 'bg-gray-400' },
  REJECTED: { icon: XCircle, color: 'bg-red-500' },
}

function statusLabel(workflowStatus: string, mods: StudioDict['mods']): string {
  switch (workflowStatus) {
    case 'PUBLISHED':
      return mods.published
    case 'IN_REVIEW':
      return mods.inReview
    case 'APPROVED':
      return mods.approved
    case 'REJECTED':
      return mods.rejected
    case 'ARCHIVED':
      return mods.archived
    default:
      return mods.draft
  }
}

function statusFilters(mods: StudioDict['mods']): { value: string; label: string }[] {
  return [
    { value: 'all', label: mods.all },
    { value: 'PUBLISHED', label: mods.published },
    { value: 'DRAFT', label: mods.draft },
    { value: 'IN_REVIEW', label: mods.inReview },
    { value: 'REJECTED', label: mods.rejected },
    { value: 'ARCHIVED', label: mods.archived },
  ]
}

export function ModsListClient({
  initialStatus,
  initialQuery,
}: {
  initialStatus: string
  initialQuery: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { dict, locale } = useStudioLanguage()
  const tag = locale === 'ar' ? 'ar-EG' : 'en-US'

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
      submit: dict.mods.confirmSubmit,
      archive: dict.mods.confirmArchive,
      delete: dict.mods.confirmDelete,
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
        toast({ title: data.data?.message || dict.mods.actionDone })
        fetchMods(page)
      } else {
        toast({
          title: data.error?.message || data.error?.details || dict.mods.actionFailed,
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: dict.mods.unexpectedError, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {statusFilters(dict.mods).map((filter) => (
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
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={dict.mods.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ps-10"
        />
      </div>

      {/* Mods list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{dict.mods.loading}</div>
      ) : mods.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={dict.mods.emptyTitle}
          description={
            query
              ? dict.mods.emptySearch
              : dict.mods.emptyCreate
          }
          action={{ label: dict.mods.createNew, href: '/creator/mods/new' }}
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
            {dict.mods.prev}
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {dict.mods.page} {pagination.page} {dict.mods.pageOf} {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => fetchMods(page + 1)}
          >
            {dict.mods.next}
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
  const { dict, locale } = useStudioLanguage()
  const tag = locale === 'ar' ? 'ar-EG' : 'en-US'
  const meta = STATUS_META[mod.workflowStatus] || STATUS_META.DRAFT
  const StatusIcon = meta.icon

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
              <Badge className={cn('text-white', meta.color)}>
                <StatusIcon className="h-3 w-3 me-1" />
                {statusLabel(mod.workflowStatus, dict.mods)}
              </Badge>
              {mod.isOriginalWork === false && (
                <Badge variant="outline" className="text-amber-500 border-amber-500">
                  {dict.mods.externalSource}
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {mod.game?.name && <span>{dict.mods.game}: {mod.game.name}</span>}
              <span className="hidden sm:inline">•</span>
              <span>{new Date(mod.createdAt).toLocaleDateString(tag)}</span>
            </div>

            {mod.workflowStatus === 'PUBLISHED' && (
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" /> {(mod.views || 0).toLocaleString(tag)}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="h-4 w-4" /> {(mod.downloads || 0).toLocaleString(tag)}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" /> {(mod.rating || 0).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={dict.mods.actions}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction(mod.id, 'view')}>
                <Eye className="h-4 w-4 me-2" /> {dict.mods.view}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction(mod.id, 'edit')}>
                <Edit className="h-4 w-4 me-2" /> {dict.mods.edit}
              </DropdownMenuItem>
              {mod.workflowStatus === 'DRAFT' && (
                <DropdownMenuItem onClick={() => onAction(mod.id, 'submit')}>
                  <Send className="h-4 w-4 me-2" /> {dict.mods.submitReview}
                </DropdownMenuItem>
              )}
              {mod.workflowStatus === 'REJECTED' && (
                <DropdownMenuItem onClick={() => onAction(mod.id, 'resubmit')}>
                  <Send className="h-4 w-4 me-2" /> {dict.mods.resubmit}
                </DropdownMenuItem>
              )}
              {mod.workflowStatus === 'PUBLISHED' && (
                <DropdownMenuItem onClick={() => onAction(mod.id, 'archive')}>
                  <Archive className="h-4 w-4 me-2" /> {dict.mods.archive}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onAction(mod.id, 'delete')}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 me-2" /> {dict.mods.remove}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
