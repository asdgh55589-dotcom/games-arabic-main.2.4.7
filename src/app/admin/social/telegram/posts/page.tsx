// DEPRECATED: consolidated into /admin/media
'use client'

import {
  CalendarClock,
  CalendarPlus,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  checkScheduleInput,
  platformLabel,
  statusLabel,
  toDateTimeLocal,
} from '@/app/admin/social/telegram/posts/post-logic'
import {
  cancelPost,
  canManage,
  deletePost,
  fetchRole,
  listPosts,
  previewPost,
  publishPost,
  SocialApiError,
  type SocialPost,
  schedulePost,
} from '@/app/admin/social/telegram/posts/social-api'
import { PostStatusBadge } from '@/components/admin/social/post-status-badge'
import { TelegramPreview } from '@/components/admin/social/telegram-preview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

const STATUS_FILTERS = [
  { value: '', label: 'كل الحالات' },
  { value: 'draft', label: 'مسودة' },
  { value: 'scheduled', label: 'مجدول' },
  { value: 'publishing', label: 'جارٍ النشر' },
  { value: 'published', label: 'منشور' },
  { value: 'failed', label: 'فشل' },
  { value: 'canceled', label: 'ملغى' },
]

const PLATFORM_FILTERS = [
  { value: '', label: 'كل المنصات' },
  { value: 'telegram', label: 'تليجرام' },
  { value: 'facebook', label: 'فيسبوك' },
  { value: 'youtube', label: 'يوتيوب' },
]

const ALL_POSTS = '__all__'
const PAGE_SIZE = 20

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-SA')
}

function statusTitleOf(err: unknown): string {
  if (err instanceof SocialApiError) {
    if (err.status === 409) return 'تعارض'
    if (err.status === 422) return 'تحقق من البيانات'
    if (err.status === 403) return 'غير مصرح'
  }
  return 'خطأ'
}

/**
 * قائمة منشورات تليجرام (C1): فلاتر + جدول + إجراءات
 * (معاينة / تعديل / نشر الآن / جدولة / إلغاء / حذف).
 */
export default function TelegramPostsPage() {
  const { toast } = useToast()

  const [role, setRole] = useState<string | null>(undefined as unknown as string | null)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [busyId, setBusyId] = useState<string | null>(null)

  // معاينة
  const [previewPostRow, setPreviewPostRow] = useState<SocialPost | null>(null)
  const [previewBody, setPreviewBody] = useState<{ text: string; parseMode: string | null } | null>(
    null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)

  // جدولة
  const [scheduleRow, setScheduleRow] = useState<SocialPost | null>(null)
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduleSaving, setScheduleSaving] = useState(false)

  const manage = canManage(role === undefined ? null : role)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listPosts({
        status: status || undefined,
        platform: platform || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: PAGE_SIZE,
      })
      setPosts(res.data)
      setTotalPages(Math.max(1, res.pagination?.totalPages || 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل المنشورات')
    } finally {
      setLoading(false)
    }
  }, [status, platform, from, to, page])

  useEffect(() => {
    fetchRole()
      .then(setRole)
      .catch(() => setRole(null))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fail = (err: unknown, fallback: string) => {
    toast({
      title: statusTitleOf(err),
      description: err instanceof SocialApiError ? err.message : fallback,
      variant: 'destructive',
    })
  }

  const run = async (id: string, action: () => Promise<unknown>, okMsg: string) => {
    setBusyId(id)
    try {
      await action()
      toast({ title: okMsg })
      await load()
    } catch (err) {
      fail(err, 'تعذّر إتمام الإجراء')
    } finally {
      setBusyId(null)
    }
  }

  const onPreview = async (post: SocialPost) => {
    setPreviewPostRow(post)
    setPreviewBody(null)
    setPreviewLoading(true)
    try {
      const res = await previewPost(post.id, {
        title: post.title,
        body: post.body,
        parseMode: post.parseMode,
        mediaUrl: post.mediaUrl,
      })
      setPreviewBody({ text: res.text, parseMode: res.parseMode })
    } catch (err) {
      fail(err, 'تعذّرت معاينة المنشور')
      setPreviewPostRow(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const onScheduleSubmit = async () => {
    if (!scheduleRow) return
    const check = checkScheduleInput(scheduleValue)
    if (!check.ok) {
      toast({ title: 'جدولة غير صالحة', description: check.message, variant: 'destructive' })
      return
    }
    setScheduleSaving(true)
    try {
      await schedulePost(scheduleRow.id, scheduleValue)
      toast({ title: 'تمت الجدولة' })
      setScheduleRow(null)
      setScheduleValue('')
      await load()
    } catch (err) {
      fail(err, 'تعذّرت جدولة المنشور')
    } finally {
      setScheduleSaving(false)
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">منشورات تليجرام</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أنشئ منشورات، اجُدولها، وانشرها فوراً إلى وجهات تليجرام.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/social/telegram/posts/new">
            <Plus className="ml-2 h-4 w-4" /> منشور جديد
          </Link>
        </Button>
      </div>

      {/* الفلاتر */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">الفلاتر</CardTitle>
          <CardDescription>صفِّ النتائج حسب الحالة والمنصة والفترة الزمنية.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select
              value={status || ALL_POSTS}
              onValueChange={(v) => {
                setStatus(v === ALL_POSTS ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger aria-label="الحالة">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value || ALL_POSTS} value={s.value || ALL_POSTS}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>المنصة</Label>
            <Select
              value={platform || ALL_POSTS}
              onValueChange={(v) => {
                setPlatform(v === ALL_POSTS ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger aria-label="المنصة">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_FILTERS.map((s) => (
                  <SelectItem key={s.value || ALL_POSTS} value={s.value || ALL_POSTS}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-from">من تاريخ</Label>
            <Input
              id="filter-from"
              type="date"
              dir="ltr"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-to">إلى تاريخ</Label>
            <Input
              id="filter-to"
              type="date"
              dir="ltr"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* الجدول */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">جارٍ تحميل المنشورات…</p>
            </div>
          ) : error ? (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={load}>
                إعادة المحاولة
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <Send className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">لا توجد منشورات</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                ابدأ بإنشاء أول منشور من زر «منشور جديد».
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الموعد</TableHead>
                      <TableHead className="hidden text-right md:table-cell">المنصة</TableHead>
                      <TableHead className="hidden text-right md:table-cell">الوجهة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => {
                      const isBusy = busyId === post.id
                      return (
                        <TableRow key={post.id}>
                          <TableCell className="max-w-[240px]">
                            <Link
                              href={`/admin/social/telegram/posts/${post.id}`}
                              className="block truncate font-medium hover:underline"
                            >
                              {post.title || (
                                <span className="text-muted-foreground">بدون عنوان</span>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <PostStatusBadge status={post.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {post.status === 'published'
                              ? fmtDate(post.publishedAt)
                              : fmtDate(post.scheduledFor)}
                          </TableCell>
                          <TableCell className="hidden text-xs md:table-cell">
                            {platformLabel(post.platform)}
                          </TableCell>
                          <TableCell className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:table-cell">
                            {post.destination?.title ||
                              post.destination?.chatId ||
                              'القناة الافتراضية'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 min-h-[44px] min-w-[44px]"
                                onClick={() => onPreview(post)}
                                title="معاينة"
                                aria-label="معاينة المنشور"
                                disabled={isBusy}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 min-h-[44px] min-w-[44px]"
                                asChild
                                title="تعديل"
                                aria-label="تعديل المنشور"
                              >
                                <Link href={`/admin/social/telegram/posts/${post.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {manage ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 min-h-[44px] min-w-[44px]"
                                    disabled={isBusy}
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          'نشر المنشور الآن إلى تليجرام مباشرة؟ لا يمكن التراجع.',
                                        )
                                      )
                                        return
                                      run(post.id, () => publishPost(post.id), 'تم نشر المنشور')
                                    }}
                                    title="نشر الآن"
                                    aria-label="نشر الآن"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 min-h-[44px] min-w-[44px]"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setScheduleRow(post)
                                      setScheduleValue(toDateTimeLocal(post.scheduledFor))
                                    }}
                                    title="جدولة"
                                    aria-label="جدولة المنشور"
                                  >
                                    <CalendarPlus className="h-4 w-4" />
                                  </Button>
                                  {post.status === 'scheduled' ? (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 min-h-[44px] min-w-[44px]"
                                      disabled={isBusy}
                                      onClick={() =>
                                        run(post.id, () => cancelPost(post.id), 'أُلغيت الجدولة')
                                      }
                                      title="إلغاء"
                                      aria-label="إلغاء الجدولة"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 min-h-[44px] min-w-[44px] text-red-400 hover:bg-red-500/10"
                                    disabled={isBusy}
                                    onClick={() => {
                                      if (
                                        !window.confirm('حذف هذا المنشور نهائياً؟ لا يمكن التراجع.')
                                      )
                                        return
                                      run(post.id, () => deletePost(post.id), 'تم الحذف')
                                    }}
                                    title="حذف"
                                    aria-label="حذف المنشور"
                                  >
                                    {isBusy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  التالي
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* نافذة المعاينة */}
      <Dialog
        open={Boolean(previewPostRow)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPostRow(null)
            setPreviewBody(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>معاينة المنشور</DialogTitle>
            <DialogDescription>
              {previewPostRow?.title || 'منشور بدون عنوان'} — {statusLabel(previewPostRow?.status)}
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <TelegramPreview
              title={previewPostRow?.title ?? ''}
              body={previewBody?.text ?? previewPostRow?.body ?? ''}
              parseMode={previewBody?.parseMode ?? previewPostRow?.parseMode ?? null}
              mediaUrl={previewPostRow?.mediaUrl ?? null}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* نافذة الجدولة */}
      <Dialog
        open={Boolean(scheduleRow)}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleRow(null)
            setScheduleValue('')
          }
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>جدولة المنشور</DialogTitle>
            <DialogDescription>اختر وقتاً في المستقبل — يُنشر تلقائياً عند موعده.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="schedule-datetime">وقت النشر</Label>
            <Input
              id="schedule-datetime"
              type="datetime-local"
              dir="ltr"
              value={scheduleValue}
              min={toDateTimeLocal(new Date())}
              onChange={(e) => setScheduleValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleRow(null)}>
              إلغاء
            </Button>
            <Button onClick={onScheduleSubmit} disabled={scheduleSaving}>
              {scheduleSaving ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="ml-2 h-4 w-4" />
              )}
              جدولة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
