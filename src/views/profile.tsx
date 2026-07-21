'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ThumbsUp, Eye, Heart, Calendar, Star, Mail, Package, BookOpen,
  Image as ImageIcon, Crown, Shield, User, ExternalLink, Settings,
  MessageCircle, Award, Trophy, Download, ArrowUpRight, Github, Twitter, Globe, MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { TierBadge } from '@/components/tier-badge'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { formatNumber, formatArabicDate } from '@/lib/format'
import type { AuthorModsResponse, ModSummary } from '@/lib/types'

interface ProfileData {
  id: string
  username: string
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  websiteUrl: string | null
  twitterUrl: string | null
  githubUrl: string | null
  discordUrl: string | null
  accentColor: string | null
  role: string
  joinedAt: string
  lastLoginAt: string
  stats: { mods: number; totalDownloads: number; totalEndorsements: number; totalViews: number }
}

interface ActivityData {
  comments: { id: string; text: string; createdAt: string; mod: { name: string; slug: string } }[]
  mods: ModSummary[]
}

interface BadgeData {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

const FALLBACK_PROFILE: ProfileData = {
  id: '1',
  username: 'Momen Hani',
  avatarUrl: 'https://i.pravatar.cc/300?img=68',
  bannerUrl: null,
  bio: 'مترجم و معرب ألعاب. متخصص في تعريب ألعاب PC و PlayStation. مؤسس منصة ألعاب بالعربي.',
  websiteUrl: null,
  twitterUrl: null,
  githubUrl: null,
  discordUrl: null,
  accentColor: '#ff8c00',
  role: 'owner',
  joinedAt: '2024-05-25T00:00:00.000Z',
  lastLoginAt: new Date().toISOString(),
  stats: { mods: 0, totalDownloads: 0, totalEndorsements: 0, totalViews: 0 },
}

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string; ring: string }> = {
  owner:     { label: 'مالك الموقع', icon: <Crown className="h-3 w-3" />, className: 'bg-amber-500 text-white', ring: 'ring-amber-500/50' },
  admin:     { label: 'مدير',         icon: <Shield className="h-3 w-3" />, className: 'bg-red-500 text-white', ring: 'ring-red-500/50' },
  moderator: { label: 'مشرف',         icon: <Star className="h-3 w-3" />,  className: 'bg-purple-500 text-white', ring: 'ring-purple-500/50' },
  member:    { label: 'عضو',          icon: <User className="h-3 w-3" />,  className: 'bg-blue-500 text-white', ring: 'ring-blue-500/50' },
}

export function ProfilePage() {
  const searchParams = useSearchParams()
  const username = searchParams.get('user') || FALLBACK_PROFILE.username
  const { toast } = useToast()

  const [profile, setProfile] = useState<ProfileData>(FALLBACK_PROFILE)
  const [activity, setActivity] = useState<ActivityData>({ comments: [], mods: [] })
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null)

  useDocumentTitle(profile.username)

  // جلب الملف الشخصي
  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
      }
    } catch {}
    setLoading(false)
  }, [username])

  // جلب النشاط
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/activity?limit=10`)
      if (res.ok) {
        const data = await res.json()
        setActivity(data)
      }
    } catch {}
  }, [username])

  // جلب الشارات
  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/badges`)
      if (res.ok) {
        const data = await res.json()
        setBadges(data.badges)
      }
    } catch {}
  }, [username])

  // جلب المستخدم الحالي
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        fetch(`/api/auth/me`).then(r => r.json()).then(d => {
          if (d.user) setCurrentUser(d.user)
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchActivity()
    fetchBadges()
  }, [fetchProfile, fetchActivity, fetchBadges])

  const isOwner = currentUser?.username === profile.username
  const accent = profile.accentColor || '#ff8c00'
  const roleBadge = ROLE_BADGE[profile.role] || ROLE_BADGE.member

  const socialLinks = useMemo(() => {
    const links: { icon: React.ReactNode; url: string; label: string }[] = []
    if (profile.websiteUrl) links.push({ icon: <Globe className="h-4 w-4" />, url: profile.websiteUrl, label: 'الموقع' })
    if (profile.twitterUrl) links.push({ icon: <Twitter className="h-4 w-4" />, url: profile.twitterUrl, label: 'تويتر' })
    if (profile.githubUrl) links.push({ icon: <Github className="h-4 w-4" />, url: profile.githubUrl, label: 'GitHub' })
    if (profile.discordUrl) links.push({ icon: <MessageSquare className="h-4 w-4" />, url: profile.discordUrl, label: 'Discord' })
    return links
  }, [profile])

  return (
    <div className="min-h-screen bg-[#121212] text-white" dir="rtl">
      {/* ===== Banner ===== */}
      <div className="relative h-[280px] overflow-hidden">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="banner" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${accent}33 0%, ${accent}11 50%, #1a1a1a 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />
      </div>

      {/* ===== معلومات المستخدم ===== */}
      <div className="mx-auto max-w-[1200px] px-4 lg:px-6">
        <div style={{ marginTop: '-80px' }} className="relative z-10">
          <div className="flex gap-6">
            {/* Avatar + شارة الرتبة */}
            <div className="shrink-0">
              <div className="relative">
                <Avatar
                  className="h-24 w-24 border-4 border-[#121212] shadow-xl"
                  style={{ boxShadow: `0 0 20px ${accent}33` }}
                >
                  <AvatarImage src={profile.avatarUrl || undefined} />
                  <AvatarFallback className="text-3xl font-bold" style={{ backgroundColor: accent + '33', color: accent }}>
                    {profile.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold shadow-lg ${roleBadge.className}`}
                >
                  <span className="flex items-center gap-1">
                    {roleBadge.icon}
                    {roleBadge.label}
                  </span>
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                  <TierBadge tier={(profile as any).tier || 0} size="md" />
                </div>
              </div>
            </div>

            {/* الاسم + الأزرار */}
            <div className="flex-1 pt-2">
              <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                <svg className="h-3.5 w-3.5" style={{ color: accent }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span>مؤلف تعريبات موثّق</span>
              </div>

              {/* روابط اجتماعية */}
              {socialLinks.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  {socialLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a] text-gray-400 transition-colors hover:text-white"
                      style={{ borderColor: '#333' }}
                      title={link.label}
                    >
                      {link.icon}
                    </a>
                  ))}
                </div>
              )}

              {/* أزرار */}
              <div className="mt-4 flex flex-wrap gap-2">
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 border-[#333] text-xs text-gray-300 hover:bg-[#222]"
                    onClick={() => setEditOpen(true)}
                  >
                    <Settings className="h-3.5 w-3.5" /> تعديل الملف
                  </Button>
                )}
                {!isOwner && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 border-[#333] text-xs text-gray-300 hover:bg-[#222]" onClick={() => toast({ title: 'رسالة', description: 'قريباً' })}>
                      <Mail className="h-3.5 w-3.5" /> رسالة
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== الإحصائيات ===== */}
        <div className="mx-auto mt-8 grid max-w-[800px] grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox icon={<Package className="h-5 w-5" style={{ color: accent }} />} label="التعريبات" value={formatNumber(profile.stats.mods)} accent={accent} />
          <StatBox icon={<Download className="h-5 w-5" style={{ color: accent }} />} label="التحميلات" value={formatNumber(profile.stats.totalDownloads)} accent={accent} />
          <StatBox icon={<ThumbsUp className="h-5 w-5" style={{ color: accent }} />} label="التأييدات" value={formatNumber(profile.stats.totalEndorsements)} accent={accent} />
          <StatBox icon={<Eye className="h-5 w-5" style={{ color: accent }} />} label="المشاهدات" value={formatNumber(profile.stats.totalViews)} accent={accent} />
        </div>

        {/* ===== معلومات إضافية ===== */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> انضم في {formatArabicDate(profile.joinedAt)}</span>
        </div>

        {/* ===== التبويبات ===== */}
        <Tabs defaultValue="about" className="mt-8">
          <TabsList className="w-full flex-row justify-start border-b border-[#333] bg-transparent p-0" style={{ direction: 'rtl' }}>
            <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white" style={{ '--tw-border-opacity': 1 } as React.CSSProperties} data-active-color={accent}>نبذة عني</TabsTrigger>
            <TabsTrigger value="mods" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">التعريبات ({profile.stats.mods})</TabsTrigger>
            <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">النشاط</TabsTrigger>
            <TabsTrigger value="badges" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">الشارات</TabsTrigger>
          </TabsList>

          {/* نبذة عني */}
          <TabsContent value="about" className="mt-6">
            <div className="rounded-lg bg-[#1a1a1a] p-6" dir="rtl">
              <p className="text-right text-sm leading-relaxed text-gray-300">{profile.bio || 'لا توجد نبذة بعد.'}</p>
            </div>
          </TabsContent>

          {/* التعريبات */}
          <TabsContent value="mods" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <ModCardSkeleton key={i} />)}
              </div>
            ) : activity.mods.length === 0 ? (
              <EmptyState icon={<Package className="h-12 w-12" />} text="لا يوجد تعريبات بعد" />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {activity.mods.map((m) => <ModCard key={m.id} mod={m} />)}
              </div>
            )}
          </TabsContent>

          {/* النشاط */}
          <TabsContent value="activity" className="mt-6">
            {activity.comments.length === 0 ? (
              <EmptyState icon={<MessageCircle className="h-12 w-12" />} text="لا يوجد نشاط بعد" />
            ) : (
              <div className="space-y-3">
                {activity.comments.map((c) => (
                  <Link
                    key={c.id}
                    href={`/?view=mod&slug=${c.mod.slug}`}
                    className="block rounded-lg bg-[#1a1a1a] p-4 transition-colors hover:bg-[#222]"
                  >
                    <div className="flex items-start gap-3">
                      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-300">{c.text}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          على تعريب <span className="text-gray-400">{c.mod.name}</span> — {formatArabicDate(c.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* الشارات */}
          <TabsContent value="badges" className="mt-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className={`rounded-lg bg-[#1a1a1a] p-4 text-center transition-all ${
                    b.earned ? 'ring-1' : 'opacity-40 grayscale'
                  }`}
                  style={b.earned ? { borderColor: accent, '--tw-ring-color': accent + '50' } as CSSProperties : {}}
                >
                  <div className="text-3xl mb-2">{b.icon}</div>
                  <h4 className="text-sm font-bold text-white">{b.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{b.description}</p>
                  {b.earned && (
                    <Badge className="mt-2 text-[10px]" style={{ backgroundColor: accent + '33', color: accent }}>
                      مكتسبة
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== Edit Modal ===== */}
      {editOpen && isOwner && (
        <EditProfileModal
          profile={profile}
          accent={accent}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => {
            setProfile(prev => ({ ...prev, ...updated }))
            setEditOpen(false)
            toast({ title: 'تم الحفظ' })
          }}
        />
      )}
    </div>
  )
}

/* ===== مكونات مساعدة ===== */

function StatBox({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg bg-[#1a1a1a] p-4 text-center">
      <div className="mb-2 flex items-center justify-center gap-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="mb-3 text-gray-600">{icon}</div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  )
}

/* ===== نافذة تعديل الملف الشخصي ===== */
function EditProfileModal({
  profile,
  accent,
  onClose,
  onSave,
}: {
  profile: ProfileData
  accent: string
  onClose: () => void
  onSave: (data: Partial<ProfileData>) => void
}) {
  const { toast } = useToast()
  const [bio, setBio] = useState(profile.bio || '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl || '')
  const [twitterUrl, setTwitterUrl] = useState(profile.twitterUrl || '')
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl || '')
  const [discordUrl, setDiscordUrl] = useState(profile.discordUrl || '')
  const [accentColor, setAccentColor] = useState(profile.accentColor || '#ff8c00')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(profile.username)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, websiteUrl, twitterUrl, githubUrl, discordUrl, accentColor }),
      })
      if (res.ok) {
        const data = await res.json()
        onSave(data.profile)
      } else {
        toast({ title: 'خطأ', description: 'لم يتم الحفظ', variant: 'destructive' })
      }
    } catch {}
    setSaving(false)
  }

  const handleUpload = async (type: 'avatar' | 'banner', file: File) => {
    const setProgress = type === 'avatar' ? setUploadingAvatar : setUploadingBanner
    setProgress(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/users/${encodeURIComponent(profile.username)}/${type}`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        onSave(type === 'avatar' ? { avatarUrl: data.avatarUrl } : { bannerUrl: data.bannerUrl })
        toast({ title: type === 'avatar' ? 'تم رفع الصورة' : 'تم رفع البانر' })
      }
    } catch {}
    setProgress(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-lg rounded-xl bg-[#1a1a1a] p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">تعديل الملف الشخصي</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">✕</Button>
        </div>

        {/* صورة شخصية */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">الصورة الشخصية</label>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatarUrl || undefined} />
              <AvatarFallback style={{ backgroundColor: accent + '33', color: accent }}>{profile.username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload('avatar', file)
                }}
              />
              <Button variant="outline" size="sm" className="border-[#333] text-gray-300" disabled={uploadingAvatar}>
                {uploadingAvatar ? 'جاري الرفع...' : 'تغيير الصورة'}
              </Button>
            </label>
          </div>
        </div>

        {/* بانر */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">البانر</label>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload('banner', file)
              }}
            />
            <Button variant="outline" size="sm" className="border-[#333] text-gray-300" disabled={uploadingBanner}>
              {uploadingBanner ? 'جاري الرفع...' : 'تغيير البانر'}
            </Button>
          </label>
        </div>

        {/* لون مميز */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">اللون المميز</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
            />
            <span className="text-sm text-gray-400">{accentColor}</span>
          </div>
        </div>

        {/* نبذة عني */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">نبذة عني</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[#333] bg-[#222] p-3 text-sm text-white placeholder-gray-500 focus:border-[#ff8c00] focus:outline-none"
            placeholder="اكتب نبذة عن نفسك..."
          />
        </div>

        {/* روابط اجتماعية */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">الموقع الإلكتروني</label>
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." className="border-[#333] bg-[#222] text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">تويتر</label>
            <Input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://twitter.com/..." className="border-[#333] bg-[#222] text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">GitHub</label>
            <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className="border-[#333] bg-[#222] text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Discord</label>
            <Input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="username#0000" className="border-[#333] bg-[#222] text-sm" />
          </div>
        </div>

        {/* أزرار */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">إلغاء</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} style={{ backgroundColor: accent }} className="text-white hover:opacity-90">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </div>
      </div>
    </div>
  )
}
