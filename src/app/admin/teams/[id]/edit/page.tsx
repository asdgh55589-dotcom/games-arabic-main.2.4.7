'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { TeamGeneralTab, type TeamGeneralFormData } from '@/components/admin/teams/team-general-tab'
import { TeamContactTab } from '@/components/admin/teams/team-contact-tab'
import { TeamMembersTab } from '@/components/admin/teams/team-members-tab'
import { TeamModsTab } from '@/components/admin/teams/team-mods-tab'
import { TeamTabsTab } from '@/components/admin/teams/team-tabs-tab'
import type {
  TeamAdminData,
  TeamContactLinkInput,
  TeamCustomTabData,
} from '@/components/admin/teams/types'

const emptyForm: TeamGeneralFormData = {
  name: '',
  description: '',
  logoUrl: '',
  bannerUrl: '',
  order: 0,
  isFeatured: false,
  isOfficial: false,
  ownerId: '',
}

export default function TeamEditPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [team, setTeam] = useState<TeamAdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<TeamGeneralFormData>(emptyForm)
  const [contactLinks, setContactLinks] = useState<TeamContactLinkInput[]>([])
  const [hiddenTabs, setHiddenTabs] = useState('')
  const [customTabs, setCustomTabs] = useState<TeamCustomTabData[]>([])

  useEffect(() => {
    fetch(`/api/admin/teams/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        const t = data?.data ?? data?.team
        if (!t) throw new Error('الفريق غير موجود')
        setTeam(t)
        setForm({
          name: t.name ?? '',
          description: t.description ?? '',
          logoUrl: t.logoUrl ?? '',
          bannerUrl: t.bannerUrl ?? '',
          order: t.order ?? 0,
          isFeatured: Boolean(t.isFeatured),
          isOfficial: Boolean(t.isOfficial),
          ownerId: t.ownerId || '',
        })
        setContactLinks(
          (t.contactLinks || []).map((c: { type: string; label: string; url: string }) => ({
            type: c.type,
            label: c.label,
            url: c.url,
          })),
        )
        setHiddenTabs(t.hiddenTabs || '')
        setCustomTabs(
          (t.customTabs || []).map((ct: TeamCustomTabData) => ({
            title: ct.title,
            content: ct.content,
            order: ct.order,
            visible: ct.visible,
          })),
        )
      })
      .catch(() => setError('فشل تحميل بيانات الفريق'))
      .finally(() => setLoading(false))
  }, [id])

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ownerId: form.ownerId || null,
          contactLinks,
          hiddenTabs,
          customTabs,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          'فشل الحفظ'
        throw new Error(msg)
      }
      toast({ title: 'تم الحفظ' })
      const updated = data?.data ?? data?.team
      if (updated) setTeam(updated)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  if (error || !team)
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error || 'الفريق غير موجود'}</p>
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/teams" className="hover:text-foreground">
          فرق التعريب
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{team.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">تعديل الفريق</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {team.mods.length} تعريب · {team.memberships.length} عضو · {team._count.follows} متابع
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            رجوع
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            حفظ
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">عام</TabsTrigger>
          <TabsTrigger value="contact">روابط التواصل</TabsTrigger>
          <TabsTrigger value="members">الأعضاء</TabsTrigger>
          <TabsTrigger value="mods">التعريبات</TabsTrigger>
          <TabsTrigger value="tabs">التبويبات</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="rounded-xl border border-border bg-card p-6">
          <TeamGeneralTab
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            memberships={team.memberships}
          />
        </TabsContent>
        <TabsContent value="contact" className="rounded-xl border border-border bg-card p-6">
          <TeamContactTab links={contactLinks} onChange={setContactLinks} />
        </TabsContent>
        <TabsContent value="members" className="rounded-xl border border-border bg-card p-6">
          <TeamMembersTab
            teamId={id}
            memberships={team.memberships}
            onMembersChange={(members) =>
              setTeam((t) =>
                t
                  ? {
                      ...t,
                      memberships: members,
                      _count: { ...t._count, memberships: members.length },
                    }
                  : t,
              )
            }
          />
        </TabsContent>
        <TabsContent value="mods" className="rounded-xl border border-border bg-card p-6">
          <TeamModsTab
            teamId={id}
            mods={team.mods}
            onModsChange={(mods) =>
              setTeam((t) => (t ? { ...t, mods, _count: { ...t._count, mods: mods.length } } : t))
            }
          />
        </TabsContent>
        <TabsContent value="tabs" className="rounded-xl border border-border bg-card p-6">
          <TeamTabsTab
            hiddenTabs={hiddenTabs}
            customTabs={customTabs}
            onChange={(patch) => {
              if (patch.hiddenTabs !== undefined) setHiddenTabs(patch.hiddenTabs)
              if (patch.customTabs !== undefined) setCustomTabs(patch.customTabs)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
