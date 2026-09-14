'use client'

import { ArrowLeft, ArrowRight, CheckCircle, Clock, Link2, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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

  const [step, setStep] = useState(1)
  const [track, setTrack] = useState<'' | 'publisher' | 'translator'>('')
  const [portfolioInput, setPortfolioInput] = useState('')
  const [years, setYears] = useState('')
  const [samples, setSamples] = useState('')
  const [agree, setAgree] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [experience, setExperience] = useState('')
  const [preferredGames, setPreferredGames] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState('')
  const [reason, setReason] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
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

  const splitUrls = (input: string) =>
    input
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

  const isHttpUrl = (val: string) => {
    try {
      const u = new URL(val)
      return ['http:', 'https:'].includes(u.protocol)
    } catch {
      return false
    }
  }

  const validateStep = (n: number): string | null => {
    if (n === 1 && !track) return t.trackRequired
    if (n === 2) {
      const urls = splitUrls(portfolioInput)
      if (urls.length < 3 || urls.length > 5) return t.portfolioCountError
      if (!urls.every(isHttpUrl)) return t.portfolioUrlError
    }
    if (n === 3) {
      if (years === '') return t.yearsRequired
      if (!experience.trim()) return t.requiredFieldsDesc
    }
    if (n === 4) {
      const v = Number(samples)
      if (samples.trim() === '' || !Number.isInteger(v) || v < 0 || v > 100)
        return t.samplesRequired
    }
    if (n === 6) {
      const len = reason.trim().length
      if (len < 100 || len > 1000) return t.reasonRange
    }
    if (n === 7 && !agree) return t.termsRequired
    return null
  }

  const goNext = () => {
    const err = validateStep(step)
    setFieldError(err)
    if (!err) setStep((s) => Math.min(7, s + 1))
  }

  const goPrev = () => {
    setFieldError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    for (let n = 1; n <= 7; n++) {
      const err = validateStep(n)
      if (err) {
        setStep(n)
        setFieldError(err)
        return
      }
    }
    setFieldError(null)
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
          websiteUrl: websiteUrl.trim() || undefined,
          track,
          portfolioUrls: splitUrls(portfolioInput).join('\n'),
          experienceYears: years === 'plus' ? 20 : Number(years),
          samplesCount: Number(samples),
          agreeToTerms: true,
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
        setWebsiteUrl('')
        setTrack('')
        setPortfolioInput('')
        setYears('')
        setSamples('')
        setAgree(false)
        setStep(1)
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
              <div className="flex justify-center gap-3">
                <Link href="/become-creator/status">
                  <Button>{t.viewStatus}</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline">{t.back}</Button>
                </Link>
              </div>
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
            {/* Progress */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {t.step} {step} / 7
              </p>
              <div className="flex gap-1.5" aria-hidden>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
            </div>

            {/* Step 1: track */}
            {step === 1 && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold">{t.trackTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{t.trackDesc}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={track === 'translator'}
                    onClick={() => {
                      setTrack('translator')
                      setFieldError(null)
                    }}
                    className={`rounded-none border-[3px] p-4 text-start shadow-[4px_4px_0_0_var(--border)] transition-colors ${
                      track === 'translator'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <p className="font-bold text-sm">🌐 {t.trackTranslator}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {t.trackTranslatorDesc}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-pressed={track === 'publisher'}
                    onClick={() => {
                      setTrack('publisher')
                      setFieldError(null)
                    }}
                    className={`rounded-none border-[3px] p-4 text-start shadow-[4px_4px_0_0_var(--border)] transition-colors ${
                      track === 'publisher'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <p className="font-bold text-sm">📦 {t.trackPublisher}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {t.trackPublisherDesc}
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: portfolio */}
            {step === 2 && (
              <div className="space-y-2">
                <h3 className="font-bold">{t.portfolioTitle}</h3>
                <Label htmlFor="portfolioUrls">{t.portfolioUrlsLabel}</Label>
                <Textarea
                  id="portfolioUrls"
                  value={portfolioInput}
                  onChange={(e) => {
                    setPortfolioInput(e.target.value)
                    setFieldError(null)
                  }}
                  placeholder={t.portfolioUrlsPh}
                  rows={5}
                  dir="ltr"
                  className="resize-none text-left"
                />
                <p className="text-xs text-muted-foreground">
                  {splitUrls(portfolioInput).length} / 5
                </p>
              </div>
            )}

            {/* Step 3: experience */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="years">{t.yearsLabel}</Label>
                  <select
                    id="years"
                    value={years}
                    onChange={(e) => {
                      setYears(e.target.value)
                      setFieldError(null)
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i}
                      </option>
                    ))}
                    <option value="plus">{t.yearsPlus}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience">{t.expLabel}</Label>
                  <Textarea
                    id="experience"
                    value={experience}
                    onChange={(e) => {
                      setExperience(e.target.value)
                      setFieldError(null)
                    }}
                    placeholder={t.expPlaceholder}
                    rows={4}
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
              </div>
            )}

            {/* Step 4: samples */}
            {step === 4 && (
              <div className="space-y-2">
                <Label htmlFor="samples">{t.samplesLabel}</Label>
                <Input
                  id="samples"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={samples}
                  onChange={(e) => {
                    setSamples(e.target.value)
                    setFieldError(null)
                  }}
                  placeholder="0"
                  dir="ltr"
                  className="text-left"
                />
                <p className="text-xs text-muted-foreground">{t.samplesHint}</p>
              </div>
            )}

            {/* Step 5: socials */}
            {step === 5 && (
              <div className="space-y-4">
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
            )}

            {/* Step 6: motivation */}
            {step === 6 && (
              <div className="space-y-2">
                <Label htmlFor="reason">{t.reasonLabel}</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setFieldError(null)
                  }}
                  placeholder={t.reasonPlaceholder}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  <span dir="ltr">{reason.trim().length} / 1000</span>
                  {reason.trim().length < 100 && ` — ${t.reasonRange}`}
                </p>
              </div>
            )}

            {/* Step 7: terms */}
            {step === 7 && (
              <div className="space-y-2">
                <h3 className="font-bold text-sm">{t.termsLabel}</h3>
                <label className="flex items-start gap-3 rounded-none border-[3px] border-border bg-card p-4 cursor-pointer">
                  <Checkbox
                    checked={agree}
                    onCheckedChange={(v) => {
                      setAgree(v === true)
                      setFieldError(null)
                    }}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-relaxed">{t.termsText}</span>
                </label>
              </div>
            )}

            {fieldError && (
              <p role="alert" className="text-sm font-bold text-destructive">
                {fieldError}
              </p>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={goPrev} className="flex-1 min-h-[48px]">
                  {t.prev}
                </Button>
              )}
              {step < 7 && (
                <Button type="button" onClick={goNext} className="flex-1 min-h-[48px]">
                  {t.next}
                </Button>
              )}
              {step === 7 && (
                <Button type="submit" className="flex-1 min-h-[48px] text-base" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t.submitting}
                    </>
                  ) : (
                    t.submit
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
