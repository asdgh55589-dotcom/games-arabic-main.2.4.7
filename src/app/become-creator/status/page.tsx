'use client'

import { AlertTriangle, CheckCircle, Clock, Inbox, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { isReviewSlaBreached } from '@/lib/creator-status'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

interface RequestStatus {
  id: string
  status: string
  track?: string | null
  rejectReason?: string | null
  approveNote?: string | null
  createdAt: string
}

export default function BecomeCreatorStatusPage() {
  const { user, loading: authLoading } = useAuth()
  const { dict, dir, locale } = useStudioLanguage()
  const t = dict.applyStatus
  const tag = locale === 'ar' ? 'ar-EG' : 'en-US'

  const [request, setRequest] = useState<RequestStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetch('/api/creator-requests', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setRequest(json.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, authLoading])

  if (authLoading || loading) {
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

  if (!request) {
    return (
      <div className="container mx-auto py-12 max-w-2xl px-4 text-center" dir={dir}>
        <Card>
          <CardContent className="p-8">
            <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t.noRequest}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t.noRequestDesc}</p>
            <Link href="/become-creator/apply">
              <Button size="lg" className="min-h-[44px]">
                {t.applyNow}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const trackName =
    request.track === 'publisher' ? t.trackPublisher : t.trackTranslator
  const submitted = new Date(request.createdAt).toLocaleDateString(tag)
  const breached = request.status === 'pending' && isReviewSlaBreached(request.createdAt)

  return (
    <div className="container mx-auto py-12 max-w-2xl px-4" dir={dir}>
      <h1 className="text-2xl font-bold mb-6 text-center">{t.title}</h1>

      {request.status === 'pending' && (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t.pendingTitle}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t.pendingDesc}</p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>
                {t.submittedOn} {submitted}
              </span>
              <span>•</span>
              <span>
                {t.trackIs} <Badge variant="outline">{trackName}</Badge>
              </span>
            </div>
            {breached && (
              <div className="mt-6 rounded-none border-[3px] border-destructive/40 bg-destructive/5 p-4 text-start">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">{t.slaBreachTitle}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {t.slaBreachDesc}
                    </p>
                    <Link href="/support" className="mt-2 inline-block">
                      <Button variant="outline" size="sm">
                        {t.supportLink}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {request.status === 'approved' && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t.approvedTitle}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t.approvedDesc}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {t.trackIs} <Badge variant="outline">{trackName}</Badge>
            </p>
            {request.approveNote && (
              <div className="rounded-none border bg-muted/50 p-4 text-start mb-6">
                <p className="text-xs font-bold text-muted-foreground mb-1">{t.reviewerNote}</p>
                <p className="text-sm leading-relaxed">{request.approveNote}</p>
              </div>
            )}
            <Link href="/creator">
              <Button size="lg" className="min-h-[44px]">
                {t.openDashboard}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {request.status === 'rejected' && (
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t.rejectedTitle}</h2>
            {request.rejectReason && (
              <p className="text-sm text-muted-foreground mb-2">
                {t.rejectReasonLabel} {request.rejectReason}
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-6">{t.rejectedDesc}</p>
            <div className="flex justify-center gap-3">
              <Link href="/become-creator/apply">
                <Button size="lg" className="min-h-[44px]">
                  {t.resubmit}
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="outline" size="lg" className="min-h-[44px]">
                  {t.supportLink}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
