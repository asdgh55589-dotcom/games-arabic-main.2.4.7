// DEPRECATED: consolidated into /admin/media
'use client'

import { FileText, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  deletePostTemplate,
  listDestinations,
  listPostTemplates,
  SocialApiError,
  type SocialPostTemplate,
  type TelegramDestination,
} from '@/app/admin/social/telegram/posts/social-api'
import {
  listTelegramTemplates,
  type NotificationTemplate,
} from '@/app/admin/social/telegram/templates/templates-api'
import { NotificationTemplateActions } from '@/components/admin/social/notification-template-actions'
import { PostTemplateForm } from '@/components/admin/social/post-template-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ar-SA')
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof SocialApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** صفحة قوالب تليجرام (C4): تبويب قوالب المنشورات + تبويب دورة حياة قوالب الإشعارات P3. */
export default function TelegramTemplatesPage() {
  const { toast } = useToast()

  // قوالب المنشورات
  const [postTemplates, setPostTemplates] = useState<SocialPostTemplate[]>([])
  const [editing, setEditing] = useState<SocialPostTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [errorPosts, setErrorPosts] = useState<string | null>(null)

  // قوالب الإشعارات
  const [notifTemplates, setNotifTemplates] = useState<NotificationTemplate[]>([])
  const [loadingNotif, setLoadingNotif] = useState(true)
  const [errorNotif, setErrorNotif] = useState<string | null>(null)

  const [destinations, setDestinations] = useState<TelegramDestination[]>([])

  const loadPostTemplates = useCallback(async () => {
    setLoadingPosts(true)
    setErrorPosts(null)
    try {
      setPostTemplates(await listPostTemplates())
    } catch (err) {
      setErrorPosts(errMessage(err, 'تعذّر تحميل قوالب المنشورات'))
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  const loadNotifTemplates = useCallback(async () => {
    setLoadingNotif(true)
    setErrorNotif(null)
    try {
      setNotifTemplates(await listTelegramTemplates())
    } catch (err) {
      setErrorNotif(errMessage(err, 'تعذّر تحميل قوالب الإشعارات'))
    } finally {
      setLoadingNotif(false)
    }
  }, [])

  useEffect(() => {
    loadPostTemplates()
    loadNotifTemplates()
    listDestinations()
      .then(setDestinations)
      .catch(() => {
        /* الوجهات اختيارية — الإرسال التجريبي يجرب جلبها لاحقاً */
      })
  }, [loadPostTemplates, loadNotifTemplates])

  const onDeletePostTemplate = async (t: SocialPostTemplate) => {
    if (
      !window.confirm(
        `أرشفة القالب "${t.name}"؟ (القوالب محفوظة للأبد — الاستعادة من أرشيف القوالب)`,
      )
    )
      return
    try {
      await deletePostTemplate(t.id)
      toast({ title: 'تمت أرشفة القالب', description: 'يمكن استعادته من صفحة أرشيف القوالب' })
      await loadPostTemplates()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: errMessage(err, 'تعذّرت أرشفة القالب'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">قوالب تليجرام</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          قوالب المنشورات (للمحرّر) وقوالب الإشعارات (دورة حياة P3) في مكان واحد.
        </p>
      </div>

      <Tabs defaultValue="post-templates">
        <TabsList>
          <TabsTrigger value="post-templates">قوالب المنشورات</TabsTrigger>
          <TabsTrigger value="notification-templates">قوالب الإشعارات (تليجرام)</TabsTrigger>
        </TabsList>

        {/* ===== تبويب قوالب المنشورات ===== */}
        <TabsContent value="post-templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{postTemplates.length} قالب</p>
            <Button
              onClick={() => {
                setEditing(null)
                setShowForm((s) => !s)
              }}
            >
              <Plus className="ml-2 h-4 w-4" /> قالب جديد
            </Button>
          </div>

          {showForm ? (
            <PostTemplateForm
              template={editing}
              onCancel={() => {
                setShowForm(false)
                setEditing(null)
              }}
              onSaved={() => {
                setShowForm(false)
                setEditing(null)
                loadPostTemplates()
              }}
            />
          ) : null}

          {loadingPosts ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">جارٍ تحميل القوالب…</p>
            </div>
          ) : errorPosts ? (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-sm text-destructive">{errorPosts}</p>
              <Button variant="outline" className="mt-4" onClick={loadPostTemplates}>
                إعادة المحاولة
              </Button>
            </div>
          ) : postTemplates.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">لا توجد قوالب منشورات</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                أنشئ قالباً لتوفير وقت تحرير المنشورات المتكررة.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="hidden text-right md:table-cell">العنوان</TableHead>
                    <TableHead className="text-right">الصيغة</TableHead>
                    <TableHead className="hidden text-right md:table-cell">افتراضي</TableHead>
                    <TableHead className="hidden text-right md:table-cell">آخر تحديث</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postTemplates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="hidden max-w-[220px] truncate md:table-cell">
                        {t.title || <span className="text-muted-foreground">بدون عنوان</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.parseMode === 'HTML' ? 'default' : 'secondary'}>
                          {t.parseMode === 'HTML' ? 'HTML' : 'نص عادي'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.isDefault ? (
                          <Badge variant="outline">افتراضي</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {fmtDate(t.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 min-h-[44px] min-w-[44px]"
                            onClick={() => {
                              setEditing(t)
                              setShowForm(true)
                            }}
                            title="تعديل"
                            aria-label="تعديل القالب"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 min-h-[44px] min-w-[44px] text-red-400 hover:bg-red-500/10"
                            onClick={() => onDeletePostTemplate(t)}
                            title="حذف"
                            aria-label="حذف القالب"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ===== تبويب قوالب الإشعارات (P3) ===== */}
        <TabsContent value="notification-templates" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {notifTemplates.length} قالب إشعار — أزرار دورة الحياة (نسخ/تحقق/معاينة/إرسال تجريبي/
            نشر/إصدارات/تراجع/سجل).
          </p>

          {loadingNotif ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">جارٍ تحميل القوالب…</p>
            </div>
          ) : errorNotif ? (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-sm text-destructive">{errorNotif}</p>
              <Button variant="outline" className="mt-4" onClick={loadNotifTemplates}>
                إعادة المحاولة
              </Button>
            </div>
          ) : notifTemplates.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <Send className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">لا توجد قوالب إشعارات لتليجرام</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                أنشئ قالباً من صفحة قوالب الإشعارات ثم أدره من هنا.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifTemplates.map((t) => (
                <Card key={t.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">
                            {NOTIFICATION_TYPE_LABELS[t.type] || t.type}
                          </span>
                          <Badge variant="secondary">{t.channel}</Badge>
                          <Badge variant={t.isActive ? 'default' : 'outline'}>
                            {t.isActive ? 'نشط' : 'مسودة'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">إصدار {t.version}</span>
                        </div>
                        <p className="mt-1 max-w-[520px] truncate text-sm text-muted-foreground">
                          {t.titleTemplate}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          آخر تحديث: {fmtDate(t.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <NotificationTemplateActions
                        template={t}
                        destinations={destinations}
                        onChanged={loadNotifTemplates}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
