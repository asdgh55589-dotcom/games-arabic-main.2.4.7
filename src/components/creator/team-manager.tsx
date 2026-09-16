'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/official-ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateTeamForm } from '@/components/creator/create-team-form'
import { TeamMembersTable, type TeamMemberRow } from '@/components/creator/team-members-table'
import { TeamSettingsForm } from '@/components/creator/team-settings-form'

interface CreatorTeam {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  websiteUrl: string
  telegramUrl: string
  modCount: number
}

export function TeamManager() {
  const [team, setTeam] = useState<CreatorTeam | null>(null)
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [membershipCount, setMembershipCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/team', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setTeam(json.data?.team ?? null)
        setMembershipCount(json.data?.membershipCount ?? 0)
        setNotFound(false)
      } else if (res.status === 404) {
        setTeam(null)
        setNotFound(true)
      } else {
        setError(json?.error?.message || 'فشل تحميل الفريق')
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
    }
    setLoading(false)
  }, [])

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await fetch('/api/creator/team/members?limit=100', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setMembers(json.data ?? [])
      }
    } catch {
      // members list is advisory — team header already loaded
    }
    setMembersLoading(false)
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  useEffect(() => {
    if (team) fetchMembers()
  }, [team, fetchMembers])

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="جارٍ التحميل">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchTeam}>
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (notFound || !team) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon="users"
          title="لا يوجد فريق بعد"
          description="أنشئ فريقك الخاص لإدارة المترجمين والأعضاء من لوحة المبدع"
        />
        <CreateTeamForm onCreated={fetchTeam} />
      </div>
    )
  }

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
        <TabsTrigger value="members">الأعضاء ({membershipCount})</TabsTrigger>
        <TabsTrigger value="settings">الإعدادات</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardHeader>
            <CardTitle>{team.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{team.description || 'لا يوجد وصف بعد'}</p>
            <p>
              الأعضاء: <span className="font-medium">{membershipCount}</span> · التعريبات:{' '}
              <span className="font-medium">{team.modCount}</span>
            </p>
            <Link href={`/teams/${team.slug}`} className="text-primary hover:underline">
              عرض الصفحة العامة للفريق
            </Link>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="members">
        <TeamMembersTable members={members} loading={membersLoading} />
      </TabsContent>

      <TabsContent value="settings">
        <TeamSettingsForm
          initial={{
            name: team.name,
            description: team.description,
            logoUrl: team.logoUrl,
            bannerUrl: team.bannerUrl,
            websiteUrl: team.websiteUrl,
            telegramUrl: team.telegramUrl,
          }}
          onSaved={fetchTeam}
        />
      </TabsContent>
    </Tabs>
  )
}
