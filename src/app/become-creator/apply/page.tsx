'use client'

import { ArrowRight, CheckCircle, Clock, Link2, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

interface CreatorRequestStatus {
  id: string
  status: string
  rejectReason?: string | null
  createdAt: string
}

export default function BecomeCreatorApplyPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [experience, setExperience] = useState('')
  const [preferredGames, setPreferredGames] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState('')
  const [reason, setReason] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [discordHandle, setDiscordHandle] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [existing, setExisting] = useState<CreatorRequestStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoadingStatus(false)
      return
    }
    fetch('/api/creator-requests', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setExisting(json.data)
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false))
  }, [user, authLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!experience.trim() || !reason.trim()) {
      toast({
        title: 'الحقول المطلوبة',
        description: 'الخبرة وسبب الرغبة مطلوبان',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/creator-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience: experience.trim(),
          preferredGames: preferredGames.trim(),
          portfolioLinks: portfolioLinks.trim(),
          reason: reason.trim(),
          twitterUrl: twitterUrl.trim() || undefined,
          youtubeUrl: youtubeUrl.trim() || undefined,
          discordHandle: discordHandle.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'تم إرسال طلبك بنجاح، سيتم مراجعته قريباً' })
        setExisting({
          id: json.data?.id || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
        })
        setExperience('')
        setPreferredGames('')
        setPortfolioLinks('')
        setReason('')
        setTwitterUrl('')
        setYoutubeUrl('')
        setDiscordHandle('')
        setWebsiteUrl('')
      } else {
        const msg =
          (typeof json?.error?.details === 'string' ? json.error.details : null) ||
          json?.error?.message ||
          json?.error ||
          'فشل الإرسال'
        toast({ title: msg, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ، حاول مرة أخرى', variant: 'destructive' })
    }
    setSubmitting(false)
  }

  if (authLoading || loadingStatus) {
    return (
      <div
        className="container mx-auto py-12 max-w-2xl px-4 flex items-center justify-center min-h-[50vh]"
        dir="rtl"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir="rtl">
        <Card>
          <CardContent className="p-8">
            <h2 className="text-xl font-bold mb-2">يجب تسجيل الدخول أولاً</h2>
            <p className="text-sm text-muted-foreground mb-6">سجّل دخولك لتقديم طلب أن تصبح معرّباً</p>
            <Link href="/login">
              <Button size="lg" className="min-h-[44px]">
                تسجيل الدخول
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (user.role !== 'member') {
    return (
      <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir="rtl">
        <Card>
          <CardContent className="p-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">أنت بالفعل معرّب أو لديك صلاحيات أعلى</h2>
            <p className="text-sm text-muted-foreground mb-6">
              لديك صلاحيات تفوق العضو العادي — لا حاجة لتقديم الطلب
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/upload">
                <Button>رفع تعريب</Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline">الإعدادات</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (existing) {
    if (existing.status === 'pending') {
      return (
        <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir="rtl">
          <Card>
            <CardContent className="p-8">
              <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">لديك طلب قيد المراجعة بالفعل</h2>
              <p className="text-sm text-muted-foreground mb-2">
                تم إرسال طلبك بتاريخ {new Date(existing.createdAt).toLocaleDateString('ar-EG')}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                سيتم مراجعته خلال 48 ساعة وستصلك إشعار بالنتيجة
              </p>
              <Link href="/become-creator">
                <Button variant="outline">العودة</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )
    }
    if (existing.status === 'approved') {
      return (
        <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir="rtl">
          <Card>
            <CardContent className="p-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">مبروك! تم قبول طلبك</h2>
              <p className="text-sm text-muted-foreground mb-6">
                أنت الآن معرّب رسمي — يمكنك رفع تعريباتك
              </p>
              <Link href="/upload">
                <Button>ابدأ رفع تعريب</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )
    }
    if (existing.status === 'rejected') {
      // لا نعود مبكراً — نسمح بإعادة التقديم مع إظهار سبب الرفض أعلى النموذج
    }
  }

  const isRejected = existing?.status === 'rejected'

  return (
    <div className="container mx-auto py-12 max-w-2xl px-4" dir="rtl">
      <div className="mb-6">
        <Link
          href="/become-creator"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> العودة
        </Link>
      </div>
      {isRejected && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <XCircle className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <h3 className="font-bold text-sm">تم رفض طلبك السابق</h3>
                {existing?.rejectReason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    السبب: {existing.rejectReason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  يمكنك تقديم طلب جديد بعد معالجة الملاحظات
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">قدّم طلبك لتصبح معرّباً</CardTitle>
          <CardDescription>املأ البيانات التالية وسيتم مراجعة طلبك خلال 48 ساعة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="experience">الخبرة في الترجمة *</Label>
              <Textarea
                id="experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="صف خبرتك في ترجمة الألعاب، عدد السنوات، الأدوات التي تستخدمها..."
                rows={4}
                required
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredGames">الألعاب المفضلة للترجمة</Label>
              <Input
                id="preferredGames"
                value={preferredGames}
                onChange={(e) => setPreferredGames(e.target.value)}
                placeholder="مثال: The Witcher 3, Elden Ring, God of War"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolioLinks">روابط أعمال سابقة (اختياري)</Label>
              <Textarea
                id="portfolioLinks"
                value={portfolioLinks}
                onChange={(e) => setPortfolioLinks(e.target.value)}
                placeholder="ضع روابط لأعمالك السابقة إن وجدت (كل رابط في سطر)"
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                اختياري — لكن وجود أعمال سابقة يزيد فرصة القبول
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">سبب الرغبة في أن تكون معرّباً *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="لماذا تريد أن تصبح معرّباً في Games Arabic؟"
                rows={4}
                required
                className="resize-none"
              />
            </div>

            {/* Social links */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <Link2 className="h-5 w-5 text-primary" />
                روابط التواصل الاجتماعي (اختياري)
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="twitterUrl">حساب تويتر / X</Label>
                  <Input
                    id="twitterUrl"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://twitter.com/username"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="youtubeUrl">قناة يوتيوب</Label>
                  <Input
                    id="youtubeUrl"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/@channel"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discordHandle">حساب ديسكورد</Label>
                  <Input
                    id="discordHandle"
                    value={discordHandle}
                    onChange={(e) => setDiscordHandle(e.target.value)}
                    placeholder="username#1234"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="websiteUrl">موقع شخصي / مدونة</Label>
                  <Input
                    id="websiteUrl"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full min-h-[48px] text-base" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الإرسال...
                </>
              ) : (
                'إرسال الطلب'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
