'use client'

import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useToast } from '@/hooks/use-toast'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

const UppyImagePanel = dynamic(
  () => import('@/components/creator/uppy-uploader').then((m) => ({ default: m.UppyUploader })),
  {
    ssr: false,
    loading: () => <div className="h-[120px] animate-pulse rounded-lg bg-muted" />,
  },
)

interface NewsItem {
  id: string
  slug: string
  title: string
  summary: string
  content: string
  imageUrl: string
  linkUrl: string | null
  category: string
  type: string
  visible: boolean
  views: number
  clicksCount: number
  createdAt: string
}

const EMPTY_FORM = {
  title: '',
  summary: '',
  content: '',
  imageUrl: '',
  linkUrl: '',
  category: 'general',
  type: 'ticker',
}

export function NewsClient() {
  const { toast } = useToast()
  const { dict, formatNumber } = useStudioLanguage()
  const t = dict.news
  const [rows, setRows] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<NewsItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showUploader, setShowUploader] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const fetchNews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/creator/news', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setRows(json.data?.news || [])
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort news operation
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setCreating(true)
  }

  const openEdit = (row: NewsItem) => {
    setCreating(false)
    setEditing(row)
    setForm({
      title: row.title,
      summary: row.summary,
      content: row.content,
      imageUrl: row.imageUrl,
      linkUrl: row.linkUrl || '',
      category: row.category,
      type: row.type,
    })
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowUploader(false)
  }

  const save = async (publish: boolean) => {
    if (form.title.trim().length < 3) {
      toast({ title: t.postTitle, variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content.trim(),
        imageUrl: form.imageUrl.trim(),
        linkUrl: form.linkUrl.trim() || undefined,
        category: form.category,
        type: form.type,
        visible: publish,
      }
      const res = editing
        ? await fetch(`/api/creator/news/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/creator/news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = await res.json()
      if (res.ok) {
        toast({ title: publish ? t.published : t.draft })
        closeForm()
        fetchNews()
      } else {
        toast({ title: json.error?.message || t.postTitle, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.postTitle, variant: 'destructive' })
    }
    setSaving(false)
  }

  const toggleVisible = async (row: NewsItem) => {
    const res = await fetch(`/api/creator/news/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: !row.visible }),
    })
    if (res.ok) fetchNews()
    else {
      const json = await res.json().catch(() => null)
      toast({ title: json?.error?.message || t.postTitle, variant: 'destructive' })
    }
  }

  const remove = async () => {
    if (!pendingDelete) return
    const res = await fetch(`/api/creator/news/${pendingDelete}`, { method: 'DELETE' })
    if (res.ok) {
      setPendingDelete(null)
      fetchNews()
    } else {
      const json = await res.json().catch(() => null)
      toast({ title: json?.error?.message || t.postTitle, variant: 'destructive' })
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((p) => ({ ...p, [k]: value }))

  return (
    <div className="space-y-4">
      {!creating && !editing && (
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 me-1" /> {t.newPost}
        </Button>
      )}

      {(creating || editing) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? t.editPost : t.newPost}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="news-title">{t.postTitle}</Label>
              <Input id="news-title" value={form.title} onChange={(e) => set('title')(e.target.value)} placeholder={t.postTitlePh} dir="auto" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="news-type">{t.type}</Label>
                <select
                  id="news-type"
                  value={form.type}
                  onChange={(e) => set('type')(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="ticker">{t.typeTicker}</option>
                  <option value="featured">{t.typeFeatured}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="news-category">{t.category}</Label>
                <Input id="news-category" value={form.category} onChange={(e) => set('category')(e.target.value)} placeholder="عام" dir="ltr" className="text-left" />
              </div>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="news-summary">{t.summary}</Label>
                <Input id="news-summary" value={form.summary} onChange={(e) => set('summary')(e.target.value)} placeholder={t.summaryPh} dir="auto" />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="news-content">{t.content}</Label>
                <Textarea id="news-content" value={form.content} onChange={(e) => set('content')(e.target.value)} placeholder={t.contentPh} rows={6} dir="auto" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="news-image">{t.imageUrl}</Label>
              <div className="flex gap-2">
                <Input id="news-image" value={form.imageUrl} onChange={(e) => set('imageUrl')(e.target.value)} placeholder={t.imagePh} dir="ltr" className="text-left flex-1" />
                <Button type="button" variant="outline" onClick={() => setShowUploader((v) => !v)}>
                  {t.uploadImage}
                </Button>
              </div>
              {showUploader && (
                <div className="rounded-lg border border-border p-3">
                  <UppyImagePanel
                    endpoint="/api/storage/upload-image"
                    allowedFileTypes={['image/*']}
                    maxFileSize={60 * 1024 * 1024}
                    maxNumberOfFiles={1}
                    onComplete={(files) => {
                      if (files[0]) set('imageUrl')(files[0].url)
                      setShowUploader(false)
                    }}
                    onError={(message) => toast({ title: message, variant: 'destructive' })}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="news-link">{t.linkUrl}</Label>
                <Input id="news-link" value={form.linkUrl} onChange={(e) => set('linkUrl')(e.target.value)} placeholder={t.linkPh} dir="ltr" className="text-left" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => save(true)} disabled={saving}>
                {editing ? t.update : t.publishNow}
              </Button>
              {!editing && (
                <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                  {t.saveDraft}
                </Button>
              )}
              <Button variant="ghost" onClick={closeForm}>
                {t.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="file" title={t.empty} description={t.emptyDesc} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{row.title}</h3>
                      <Badge variant={row.visible ? 'default' : 'outline'} className="text-xs">
                        {row.visible ? t.published : t.draft}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {row.type === 'featured' ? t.typeFeatured : t.typeTicker}
                      </Badge>
                    </div>
                    {row.summary && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{row.summary}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3">
                      <span>
                        {formatNumber(row.views)} {t.views}
                      </span>
                      <span>
                        {formatNumber(row.clicksCount)} {t.clicks}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleVisible(row)}
                      aria-label={row.visible ? t.unpublish : t.publish}
                    >
                      {row.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={t.editPost}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDelete(row.id)}
                      aria-label={t.remove}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
