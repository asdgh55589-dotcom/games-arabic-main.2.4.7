'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Download,
  ThumbsUp,
  Eye,
  MessageSquare,
  Calendar,
  HardDrive,
  FileArchive,
  Tag,
  Clock,
  Shield,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  BarChart3,
  FileText,
  User,
  Award,
  Star,
  Crown,
  Gamepad2,
  Languages,
  Layers,
  CheckCircle,
  Users,
  Youtube,
  Twitter,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { ModDownloadSection } from '@/components/mod-download-section'
import { ModGallery } from '@/components/mod-gallery'
import { ModVideos } from '@/components/mod-videos'
import { ModComments } from '@/components/mod-comments'
import { ReportButton } from '@/components/report-button'
import { ModTranslationTeam } from '@/components/mod-translation-team'
import { formatNumber, formatDate, formatArabicDate, timeAgo, parseGalleryUrls, parseTags } from '@/lib/format'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { apiFetch } from '@/lib/api-client'
import type { ModDetail, PaginatedMods, EndorseResponse } from '@/lib/types'

export function ModDetailPage() {
  const searchParams = useSearchParams()
  const slug = searchParams.get('slug') || ''
  const [tab, setTab] = useState('description')
  const [endorsed, setEndorsed] = useState(false)
  const [endorsementCount, setEndorsementCount] = useState<number | null>(null)
  const [downloadCount, setDownloadCount] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const { toast } = useToast()
  const downloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const galleryScrollRef = useRef<HTMLDivElement>(null)

  const { data, loading, refetch } = useFetch<{ mod: ModDetail }>(slug ? `/api/mods/${slug}` : null, [slug])

  const [lastSlug, setLastSlug] = useState(slug)
  if (slug !== lastSlug) {
    setLastSlug(slug)
    setActiveImage(0)
    setEndorsed(false)
    setEndorsementCount(null)
    setDownloadCount(null)
  }

  useEffect(() => {
    return () => {
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current)
        downloadTimeoutRef.current = null
      }
    }
  }, [])

  const mod = data?.mod
  useDocumentTitle(mod?.name ?? null)

  const relatedUrl = useMemo(() => {
    if (!mod?.game?.slug) return null
    return `/api/games/${mod.game.slug}/mods?sort=downloads&limit=6`
  }, [mod?.game?.slug])
  const { data: relatedData, loading: relatedLoading } = useFetch<PaginatedMods>(relatedUrl, [relatedUrl])

  if (!loading && !mod) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Mod not found</h1>
        <Button asChild className="mt-4">
          <Link href="/?view=mods">Back to Mods</Link>
        </Button>
      </div>
    )
  }

  const gallery = mod ? parseGalleryUrls(mod.galleryUrls) : []
  const tags = mod ? parseTags(mod.tags) : []
  const safeActiveImage = Math.min(activeImage, Math.max(0, gallery.length - 1))
  // Banner = first gallery image (the header image in nexusmods)
  const bannerImage = gallery[0] || mod?.imageUrl || ''

  const shownEndorsements = endorsementCount ?? mod?.endorsements ?? 0
  const shownDownloads = downloadCount ?? mod?.downloads ?? 0
  const shownViews = mod?.views ?? 0

  const onEndorse = async () => {
    if (!mod) return
    try {
      const result = await apiFetch<EndorseResponse>(
        `/api/mods/${mod.slug}/endorse`,
        {
          method: 'POST',
        }
      )
      setEndorsed(result.endorsed)
      setEndorsementCount(result.endorsements)
      toast({
        title: result.endorsed ? 'Endorsed!' : 'Endorsement removed',
        description: result.endorsed
          ? 'Thanks for supporting this mod author.'
          : 'Your endorsement has been removed.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update endorsement'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const onDownload = async () => {
    if (!mod || downloading) return
    setDownloading(true)
    try {
      const result = await apiFetch<{ downloads: number }>(
        `/api/mods/${mod.slug}/download`,
        { method: 'POST' }
      )
      setDownloadCount(result.downloads)
      toast({
        title: 'Download started',
        description: `${mod.name} v${mod.version} (${mod.fileSize})`,
      })
      if (downloadTimeoutRef.current) clearTimeout(downloadTimeoutRef.current)
      downloadTimeoutRef.current = setTimeout(() => {
        setDownloading(false)
        toast({
          title: 'Download complete',
          description: `${formatNumber(result.downloads)} total downloads`,
        })
        downloadTimeoutRef.current = null
      }, 2000)
    } catch (err) {
      setDownloading(false)
      const message = err instanceof Error ? err.message : 'Download failed'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const scrollGallery = (dir: 'prev' | 'next') => {
    if (!galleryScrollRef.current) return
    const scrollAmount = 300
    galleryScrollRef.current.scrollBy({
      left: dir === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div>
      {loading ? (
        <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6">
          <div className="aspect-[21/9] animate-pulse rounded-lg bg-muted" />
          <div className="mt-6 h-24 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-10 animate-pulse rounded bg-muted" />
        </div>
      ) : mod ? (
        <>
          {/* ===== HEADER: banner background + breadcrumb + title + stats ===== */}
          {/* البنر الخلفي طويل — يحتوي شريط التنقل + العنوان + شريط الإحصائيات.
              البنر كبير بحدود واضحة (border-bottom) عشان يتحدد بصرياً.
              المحتوى الرئيسي (الصورة + البطاقة) يبدأ بعد البنر مباشرة. */}
          <div className="relative overflow-hidden" dir="rtl" style={{ minHeight: '360px' }}>
            {/* الصورة الخلفية */}
            <div className="absolute inset-0">
              <img
                src={mod.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
              <div className="absolute inset-0 bg-background/25" />
            </div>

            {/* المحتوى فوق البنر — محاذى لأسفل عشان يبقى قريب من الصورة */}
            <div className="relative mx-auto flex min-h-[360px] max-w-[1200px] flex-col justify-end px-4 pb-4 pt-6 lg:px-6 lg:pb-6 lg:pt-8">
              {/* Breadcrumb — يبدأ من اليمين في RTL: التعريب / المنصة */}
              <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-foreground/70" aria-label="مسار التنقل">
                <Link href="/" className="transition-colors hover:text-foreground">
                  الرئيسية
                </Link>
                <span className="text-foreground/40">/</span>
                <Link href={`/?view=platform&platform=${mod.game.platform}`} className="transition-colors hover:text-foreground">
                  ARABIC {mod.game.platform}
                </Link>
                <span className="text-foreground/40">/</span>
                <span className="truncate font-medium text-foreground">{mod.name}</span>
              </nav>

              {/* العنوان — اسم التعريب فقط، بدون لمحة/ملخص */}
              <h1 className="text-4xl font-bold tracking-tight text-foreground drop-shadow-2xl sm:text-5xl lg:text-6xl">
                {mod.name}
              </h1>

              {/* شريط الإحصائيات — كل عنصر يظهر فقط إذا كانت بياناته موجودة */}
              <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2">
                <StatBadge
                  icon={<ThumbsUp className="h-3.5 w-3.5" />}
                  value={formatNumber(shownEndorsements)}
                  label="تأييدات"
                />
                <span className="text-foreground/30">•</span>
                <StatBadge
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  value={formatNumber(shownDownloads)}
                  label="إجمالي التحميلات"
                />
                <span className="text-foreground/30">•</span>
                <StatBadge
                  icon={<Eye className="h-3.5 w-3.5" />}
                  value={formatNumber(shownViews)}
                  label="المشاهدات"
                />
                {mod.version && (
                  <>
                    <span className="text-foreground/30">•</span>
                    <StatBadge
                      icon={<FileText className="h-3.5 w-3.5" />}
                      value={mod.version}
                      label="الإصدار"
                    />
                  </>
                )}
                <span className="text-foreground/30">•</span>
                <StatBadge
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  value={formatArabicDate(mod.releaseDate)}
                  label="تاريخ النشر"
                />
                {mod.series && mod.series.trim() !== '' && (
                  <>
                    <span className="text-foreground/30">•</span>
                    <Link
                      href={`/?view=series-detail&series=${encodeURIComponent(mod.series)}`}
                      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-background/40 px-2 py-1 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/10"
                    >
                      <span className="text-primary">
                        <Tag className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-bold text-foreground">{mod.series}</span>
                        <span className="text-[10px] text-muted-foreground">السلسلة</span>
                      </div>
                    </Link>
                  </>
                )}
                {mod.translationTeam && mod.translationTeam.trim() !== '' && (
                  <>
                    <span className="text-foreground/30">•</span>
                    <Link
                      href={`/?view=translation-team-detail&team=${encodeURIComponent(mod.translationTeam)}`}
                      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-background/40 px-2 py-1 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/10"
                    >
                      <span className="text-primary">
                        <Users className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-bold text-foreground">{mod.translationTeam}</span>
                        <span className="text-[10px] text-muted-foreground">فريق التعريب</span>
                      </div>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* المحتوى الرئيسي — خلفية فاتحة تحت البنر */}
          <div className="relative z-10 min-h-screen rounded-t-3xl bg-zinc-950 px-4 pb-12 pt-6 lg:px-6" dir="rtl">
            <div className="mx-auto max-w-[1200px]">
            {/* ===== صورة كبيرة + بطاقة بيانات بجوارها ===== */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* الصورة الكبيرة — أكبر عرض و طول */}
              <div className="relative shrink-0 overflow-hidden rounded-lg border border-border bg-secondary sm:w-[72%]">
                <img
                  src={mod.imageUrl}
                  alt={mod.name}
                  className="aspect-[16/10] h-full w-full object-cover"
                />
                {/* شارات على الصورة */}
                <div className="absolute right-3 top-3 flex gap-2">
                  {mod.game?.platform && (
                    <Badge variant="outline" className="border-border bg-background/80 backdrop-blur shadow-md">
                      {mod.game.platform}
                    </Badge>
                  )}
                </div>
              </div>

              {/* بطاقة معلومات التعريب — أعرض، ما تتجاوزش طول الصورة، فصل بخطوط فاصلة */}
              <div className="flex w-[32%] shrink-0 flex-col self-stretch rounded-xl border border-border bg-gradient-to-br from-card to-card p-4 shadow-lg">
                {/* البيانات — موزعة بالتساوي لتمليء ارتفاع البطاقة */}
                <div className="flex flex-1 flex-col justify-between text-xs">
                  <div className="space-y-0.5">
                    <InfoRow icon={<Gamepad2 className="h-3.5 w-3.5" />} label="اسم اللعبة" value={mod.game.name} />
                    {mod.arabicTitle && (
                      <>
                        <Divider />
                        <InfoRow icon={<Languages className="h-3.5 w-3.5" />} label="الاسم بالعربي" value={mod.arabicTitle} />
                      </>
                    )}
                    {mod.series && (
                      <>
                        <Divider />
                        <Link href={`/?view=series-detail&series=${encodeURIComponent(mod.series)}`} className="flex items-center justify-between gap-2 px-1 py-2 transition-colors hover:bg-accent/50 rounded">
                          <span className="flex items-center gap-2 font-medium text-foreground"><Layers className="h-3.5 w-3.5 text-sky-400" />السلسلة</span>
                          <span className="font-bold text-primary">{mod.series}</span>
                        </Link>
                      </>
                    )}
                    <Divider />
                    <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="تاريخ النشر" value={formatArabicDate(mod.releaseDate)} />
                    {mod.translationType && (
                      <>
                        <Divider />
                        <InfoRow icon={<Shield className="h-3.5 w-3.5" />} label="نوع التعريب" value={mod.translationType} />
                      </>
                    )}
                    {mod.version && (
                      <>
                        <Divider />
                        <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="إصدار التعريب" value={`v${mod.version}`} />
                      </>
                    )}
                    {mod.compatibility && (
                      <>
                        <Divider />
                        <InfoRow icon={<CheckCircle className="h-3.5 w-3.5" />} label="التوافق" value={mod.compatibility} />
                      </>
                    )}
                    {mod.translationTeam && (
                      <>
                        <Divider />
                        <Link href={`/?view=translation-team-detail&team=${encodeURIComponent(mod.translationTeam)}`} className="flex items-center justify-between gap-2 px-1 py-2.5 transition-colors hover:bg-accent/50 rounded">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <span className="text-sky-400"><Users className="h-3.5 w-3.5" /></span>
                            فريق التعريب
                          </span>
                          <span className="font-bold text-primary">{mod.translationTeam}</span>
                        </Link>
                      </>
                    )}
                    {mod.fileSize && mod.fileSize.trim() !== '' && (
                      <>
                        <Divider />
                        <InfoRow icon={<FileArchive className="h-3.5 w-3.5" />} label="الحجم" value={`${mod.fileSize} .${mod.fileFormat}`} />
                      </>
                    )}
                  </div>

                  {/* زر التأييد — في أسفل البيانات */}
                  <div className="mt-3">
                    <Button
                      onClick={onEndorse}
                      variant={endorsed ? 'default' : 'outline'}
                      className={`w-full gap-2 ${endorsed ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                      <ThumbsUp className={`h-4 w-4 ${endorsed ? 'fill-current' : ''}`} />
                      {endorsed ? 'تم التأييد' : 'أعجبني'}
                      <span className="text-xs opacity-70">({formatNumber(shownEndorsements)})</span>
                    </Button>
                  </div>
                  <div className="mt-2">
                    <ReportButton targetType="mod" targetId={mod.id} />
                  </div>
                </div>

                {/* الأوسمة في أسفل بطاقة البيانات — badges ديناميكية من tags */}
                {tags.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 bg-primary/10 text-primary">
                          <Tag className="h-3 w-3" />{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== الأقسام (Tabs) — بعرض كامل ===== */}
            <div className="mt-6 w-full">
              <div className="min-w-0" dir="rtl">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="w-full justify-start gap-2 overflow-x-auto p-1.5" dir="rtl">
                    <TabsTrigger value="description" className="flex-none whitespace-nowrap px-4 py-1.5">الوصف</TabsTrigger>
                    <TabsTrigger value="changelog" className="flex-none whitespace-nowrap px-4 py-1.5">سجل التغييرات</TabsTrigger>
                    <TabsTrigger value="install" className="flex-none whitespace-nowrap px-4 py-1.5">طريقة التركيب</TabsTrigger>
                    <TabsTrigger value="translationTeam" className="flex-none whitespace-nowrap px-4 py-1.5">فريق التعريب</TabsTrigger>
                    <TabsTrigger value="images" className="flex-none whitespace-nowrap px-4 py-1.5">
                      معرض الصور <span className="mr-1 text-xs text-muted-foreground">({gallery.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="videos" className="flex-none whitespace-nowrap px-4 py-1.5">فيديوهات</TabsTrigger>
                    <TabsTrigger value="files" className="flex-none whitespace-nowrap px-4 py-1.5">التحميل</TabsTrigger>
                    {/* التبويبات المخصصة من الـ DB — قبل التعليقات */}
                    {mod.customTabs?.map((ct) => (
                      <TabsTrigger key={ct.id} value={`custom-${ct.slug}`} className="flex-none whitespace-nowrap px-4 py-1.5">
                        {ct.name}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="comments" className="flex-none whitespace-nowrap px-4 py-1.5">
                      التعليقات <span className="mr-1 text-xs text-muted-foreground">({formatNumber(mod.comments)})</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Description tab */}
                  <TabsContent value="description" className="mt-4" dir="rtl">
                    <Card className="p-6">
                      <h2 className="mb-4 text-xl font-bold">عن هذا التعريب</h2>
                      <p className="mb-4 text-foreground/80">{mod.summary}</p>
                      <Separator className="my-4" />
                      <MarkdownRenderer content={mod.description} />
                    </Card>
                  </TabsContent>

                  {/* Changelog tab — سجل التغييرات */}
                  <TabsContent value="changelog" className="mt-4" dir="rtl">
                    <Card className="p-6">
                      <h2 className="mb-4 text-xl font-bold">سجل التغييرات</h2>
                      <div className="mb-4 rounded-lg border border-border/60 bg-card/40 p-3">
                        <div className="text-xs text-muted-foreground">الإصدار الحالي</div>
                        <div className="text-lg font-bold text-foreground">v{mod.version}</div>
                      </div>
                      {mod.changelog ? (
                        <div className="prose prose-invert max-w-none">
                          <MarkdownRenderer content={mod.changelog} />
                        </div>
                      ) : (
                        <ul className="space-y-2 text-sm text-foreground/70">
                          <li className="flex gap-2"><span className="text-primary">•</span> الإصدار الأول العام</li>
                          <li className="flex gap-2"><span className="text-primary">•</span> إصلاحات توافق مع التعديلات الشائعة</li>
                          <li className="flex gap-2"><span className="text-primary">•</span> تحسينات في الأداء للأجهزة الضعيفة</li>
                          <li className="flex gap-2"><span className="text-primary">•</span> إصلاح أخطاء أبلغ عنها المجتمع</li>
                        </ul>
                      )}
                    </Card>
                  </TabsContent>

                  {/* Install guide tab — طريقة التركيب */}
                  <TabsContent value="install" className="mt-4" dir="rtl">
                    <Card className="p-6">
                      <h2 className="mb-4 text-xl font-bold">طريقة التركيب</h2>
                      {(mod as any).installGuide && (mod as any).installGuide.trim() !== '' ? (
                        <MarkdownRenderer content={(mod as any).installGuide} />
                      ) : (
                        <div className="space-y-4">
                          <div className="flex gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">1</div>
                            <div>
                              <div className="font-semibold">حمّل ملف التعريب</div>
                              <p className="mt-1 text-sm text-muted-foreground">اضغط على زر «التحميل» في قسم التحميل لتحميل ملف التعريب بصيغة {`.${mod.fileFormat}`} بحجم {mod.fileSize}.</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">2</div>
                            <div>
                              <div className="font-semibold">افتح ضغط الملف</div>
                              <p className="mt-1 text-sm text-muted-foreground">استخدم برنامج فك الضغط (WinRAR / 7-Zip) لاستخراج محتويات الملف في مجلد مؤقت.</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">3</div>
                            <div>
                              <div className="font-semibold">انسخ ملفات التعريب</div>
                              <p className="mt-1 text-sm text-muted-foreground">انسخ كل الملفات المستخرجة إلى مجلد تثبيت اللعبة الرئيسي.</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">4</div>
                            <div>
                              <div className="font-semibold">فعّل التعريب من إعدادات اللعبة</div>
                              <p className="mt-1 text-sm text-muted-foreground">شغّل اللعبة، ادخل على إعدادات اللغة، واختر «العربية». أعد تشغيل اللعبة إذا لزم الأمر.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </TabsContent>

                  {/* Translation Team tab — فريق التعريب */}
                  <TabsContent value="translationTeam" className="mt-4" dir="rtl">
                    <ModTranslationTeam teamMembers={mod.teamMembers || []} contactLinks={mod.contactLinks || []} />
                  </TabsContent>

                  {/* Images tab — معرض الصور الجديد */}
                  <TabsContent value="images" className="mt-4" dir="rtl">
                    <ModGallery images={gallery.length > 0 ? gallery : [mod.imageUrl]} modName={mod.name} />
                  </TabsContent>

                  {/* Videos tab — فيديوهات */}
                  <TabsContent value="videos" className="mt-4" dir="rtl">
                    <ModVideos videoGroups={mod.videoGroups || []} />
                  </TabsContent>

                  {/* Files / Download tab — التحميل */}
                  <TabsContent value="files" className="mt-4" dir="rtl">
                    <ModDownloadSection files={mod.files || []} />
                  </TabsContent>

                  {/* Comments tab */}
                  <TabsContent value="comments" className="mt-4" dir="rtl">
                    <Card className="p-6">
                      <ModComments modSlug={mod.slug} modOwnerName={mod.author?.username} />
                    </Card>
                  </TabsContent>

                  {/* ===== التبويبات المخصصة (من الـ DB) ===== */}
                  {mod.customTabs?.map((tab) => (
                    <TabsContent key={tab.id} value={`custom-${tab.slug}`} className="mt-4" dir="rtl">
                      <Card className="p-6">
                        <h2 className="mb-4 text-xl font-bold">{tab.name}</h2>
                        <MarkdownRenderer content={tab.content} />
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>

                {/* Related mods */}
                <div className="mt-8">
                  <h2 className="mb-4 text-xl font-bold">قد يعجبك أيضاً</h2>
                  {relatedLoading ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => <ModCardSkeleton key={i} />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {relatedData?.mods
                        ?.filter((m) => m.id !== mod.id)
                        .slice(0, 4)
                        .map((m) => <ModCard key={m.id} mod={m} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** خط فاصل بسيط بين صفوف المعلومات */
function Divider() {
  return <div className="h-px bg-border/50" />
}

/** صف معلومات: أيقونة + تسمة + قيمة، بدون إطار (الفصل بخط فاصل خارجي) */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-2.5">
      <span className="flex items-center gap-2 font-medium text-foreground">
        <span className="text-sky-400">{icon}</span>
        {label}
      </span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  )
}

/** بطاقة إحصائية احترافية فوق البنر — خلفية شفافة بـ backdrop blur،
 *  حدود رفيعة، أيقونة ملونة + قيمة كبيرة + تسمية صغيرة.
 *  تصميم مدمج (compact) عشان البطاقات تبان قريبة من بعض و ما تأخذش مساحة كبيرة. */
function StatBadge({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-background/40 px-2 py-1 backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-background/60">
      <span className="text-primary">{icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-bold text-foreground">{value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
