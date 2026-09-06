'use client'

import { ArrowLeft, ArrowRight, CheckCircle, Clock, Link2, Loader2, XCircle } from 'lucide-react'
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
import { useStudioLanguage } from '@/lib/studio-i18n/context'

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
  const { dict, dir, locale } = useStudioLanguage()
  const t = dict.apply
  const tag = locale === 'ar' ? 'ar-EG' : 'en-US'
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft

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
        title: t.requiredFields,
        description: t.requiredFieldsDesc,
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
        toast({ title: t.submitOk })
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
          t.submitFailed
        toast({ title: msg, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.unexpectedRetry, variant: 'destructive' })
    }
    setSubmitting(false)
  }

  if (authLoading || loadingStatus) {
    return (
      <div
        className="container mx-auto py-12 max-w-2xl px-4 flex items-center justify-center min-h-[50vh]"
        dir={dir}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir={dir}>
        <Card>
          <CardContent className="p-8">
            <h2 className="text-xl font-bold mb-2">{t.loginRequired}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t.loginRequiredDesc}</p>
            <Link href="/login">
              <Button size="lg" className="min-h-[44px]">
                {t.login}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (user.role !== 'member') {
    const isStaff = ['moderator', 'admin', 'manager', 'owner'].includes(user.role)
    return (
      <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir={dir}>
        <Card>
          <CardContent className="p-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t.alreadyCreator}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t.alreadyCreatorDesc}
            </p>
            <div className="flex justify-center gap-3">
              <Link href={isStaff ? '/admin' : '/creator'}>
                <Button>{isStaff ? t.adminPanel : t.creatorPanel}</Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline">{t.settings}</Button>
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
        <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir={dir}>
          <Card>
            <CardContent className="p-8">
              <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">{t.pendingTitle}</h2>
              <p className="text-sm text-muted-foreground mb-2">
                {t.pendingDatePrefix} {new Date(existing.createdAt).toLocaleDateString(tag)}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {t.pendingSla}
              </p>
              <Link href="/settings">
                <Button variant="outline">{t.back}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )
    }
    if (existing.status === 'approved') {
      return (
        <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir={dir}>
          <Card>
            <CardContent className="p-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">{t.approvedTitle}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t.approvedDesc}
              </p>
              <Link href="/upload">
                <Button>{t.startUpload}</Button>
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
    <div className="container mx-auto py-12 max-w-2xl px-4" dir={dir}>
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackIcon className="h-4 w-4" /> {t.backLink}
        </Link>
      </div>
      {isRejected && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <XCircle className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <h3 className="font-bold text-sm">{t.rejectedTitle}</h3>
                {existing?.rejectReason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.rejectReasonLabel} {existing.rejectReason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {t.rejectedHint}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t.formTitle}</CardTitle>
          <CardDescription>{t.formDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="experience">{t.expLabel}</Label>
              <Textarea
                id="experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder={t.expPlaceholder}
                rows={4}
                required
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredGames">{t.favGames}</Label>
              <Input
                id="preferredGames"
                value={preferredGames}
                onChange={(e) => setPreferredGames(e.target.value)}
                placeholder="The Witcher 3, Elden Ring, God of War"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolioLinks">{t.portfolio}</Label>
              <Textarea
                id="portfolioLinks"
                value={portfolioLinks}
                onChange={(e) => setPortfolioLinks(e.target.value)}
                placeholder={t.portfolioPlaceholder}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {t.portfolioHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{t.reasonLabel}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.reasonPlaceholder}
                rows={4}
                required
                className="resize-none"
              />
            </div>

            {/* Social links */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <Link2 className="h-5 w-5 text-primary" />
                {t.socials}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="twitterUrl">{t.twitter}</Label>
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
                  <Label htmlFor="youtubeUrl">{t.youtube}</Label>
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
                  <Label htmlFor="discordHandle">{t.discord}</Label>
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
                  <Label htmlFor="websiteUrl">{t.website}</Label>
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
                  <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t.submitting}
                </>
              ) : (
                t.submit
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
