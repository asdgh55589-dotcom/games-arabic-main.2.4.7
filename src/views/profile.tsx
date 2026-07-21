'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Crown, Shield, User, Settings, Mail, UserPlus, UserCheck,
  Calendar, CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { createClient } from '@/lib/supabase/client'
import { formatArabicDate } from '@/lib/format'
import { ProfileStats } from '@/components/profile/profile-stats'
import { ProfileBadgesGrid } from '@/components/profile/profile-badges-grid'
import { ProfileXpBar } from '@/components/profile/profile-xp-bar'
import { ProfileModsFilter } from '@/components/profile/profile-mods-filter'
import { ProfileActivityFeed } from '@/components/profile/profile-activity-feed'
import { ProfileSettings } from '@/components/profile/profile-settings'
import { ProfileSocialLinks } from '@/components/profile/profile-social-links'
import { TierBadge } from '@/components/tier-badge'
import type { ModSummary } from '@/lib/types'

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
  onlineStatus?: string
  stats: {
    mods: number
    totalDownloads: number
    totalEndorsements: number
    totalViews: number
    followersCount: number
    followingCount: number
  }
  xp?: {
    level: number
    name: string
    points: number
    progress: number
  }
  isTranslator?: boolean
  firstModDate?: string | null
  rating?: number
}

interface ActivityData {
  comments: { id: string; text: string; createdAt: string; mod: { name: string; slug: string } }[]
  mods: ModSummary[]
  modEdits?: { id: string; name: string; slug: string; updatedAt: string }[]
  endorsements?: { id: string; createdAt: string; mod: { name: string; slug: string } }[]
}

interface BadgeData {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  owner:     { label: 'مالك الموقع', icon: <Crown className="h-3 w-3" />, className: 'bg-amber-500 text-white' },
  admin:     { label: 'مدير',         icon: <Shield className="h-3 w-3" />, className: 'bg-red-500 text-white' },
  moderator: { label: 'مشرف',         icon: <User className="h-3 w-3" />,  className: 'bg-purple-500 text-white' },
  member:    { label: 'عضو',          icon: <User className="h-3 w-3" />,  className: 'bg-blue-500 text-white' },
}

export function ProfilePage() {
  const searchParams = useSearchParams()
  const username = searchParams.get('user') || 'Momen Hani'
  const { toast } = useToast()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [activity, setActivity] = useState<ActivityData>({ comments: [], mods: [] })
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)

  useDocumentTitle(profile?.username || 'الملف الشخصي')

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

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/activity?limit=10`)
      if (res.ok) {
        const data = await res.json()
        setActivity(data)
      }
    } catch {}
  }, [username])

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/badges`)
      if (res.ok) {
        const data = await res.json()
        setBadges(data.badges)
      }
    } catch {}
  }, [username])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        fetch('/api/auth/me').then(r => r.json()).then(d => {
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

  const isOwner = currentUser?.username === profile?.username
  const accent = profile?.accentColor || '#ff8c00'
  const roleBadge = ROLE_BADGE[profile?.role || 'member'] || ROLE_BADGE.member

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white" dir="rtl">
      {/* ===== Banner ===== */}
      <div className="relative h-[280px] overflow-hidden">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="banner" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(135deg, ${accent}33 0%, ${accent}11 50%, #1a1a1a 100%)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />
      </div>

      {/* ===== User Info ===== */}
      <div className="mx-auto max-w-[1200px] px-4 lg:px-6">
        <div style={{ marginTop: '-80px' }} className="relative z-10">
          <div className="flex gap-6">
            {/* Avatar + badges */}
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
                {/* Online status */}
                <div
                  className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-[#121212] ${
                    profile.onlineStatus === 'online' ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
                {/* Role badge */}
                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold shadow-lg ${roleBadge.className}`}>
                  <span className="flex items-center gap-1">
                    {roleBadge.icon}
                    {roleBadge.label}
                  </span>
                </div>
                {/* Tier badge */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                  <TierBadge tier={(profile as any).tier || 0} size="md" />
                </div>
              </div>
            </div>

            {/* Name + actions */}
            <div className="flex-1 pt-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
                {profile.role === 'owner' && (
                  <CheckCircle className="h-5 w-5" style={{ color: accent }} />
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  انضم في {formatArabicDate(profile.joinedAt)}
                </span>
                <span>•</span>
                <span>{profile.onlineStatus === 'online' ? 'متصل الآن' : 'غير متصل'}</span>
              </div>

              {/* Social links */}
              <div className="mt-3">
                <ProfileSocialLinks
                  websiteUrl={profile.websiteUrl}
                  twitterUrl={profile.twitterUrl}
                  githubUrl={profile.githubUrl}
                  discordUrl={profile.discordUrl}
                  accent={accent}
                />
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {isOwner ? (
                  <Link href="/settings">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 border-[#333] text-xs text-gray-300 hover:bg-[#222]">
                      <Settings className="h-3.5 w-3.5" /> تعديل الملف
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-[#333] text-xs text-gray-300 hover:bg-[#222]"
                      onClick={() => toast({ title: 'رسالة', description: 'قريباً' })}
                    >
                      <Mail className="h-3.5 w-3.5" /> رسالة
                    </Button>
                    <Button
                      size="sm"
                      variant={isFollowing ? 'outline' : 'default'}
                      className="h-8 gap-1.5 text-xs"
                      style={isFollowing ? { borderColor: '#333' } : { backgroundColor: accent }}
                      onClick={() => setIsFollowing(!isFollowing)}
                    >
                      {isFollowing ? (
                        <><UserCheck className="h-3.5 w-3.5" /> متابَع</>
                      ) : (
                        <><UserPlus className="h-3.5 w-3.5" /> متابعة</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Stats (full width) ===== */}
      <div className="px-4 lg:px-6">
        <div className="mx-auto max-w-[1400px]">
          <ProfileStats
            stats={profile.stats}
            xp={profile.xp}
            isTranslator={profile.isTranslator}
            translatorStats={{
              badgesCount: badges.filter(b => b.earned).length,
              firstModDate: profile.firstModDate || null,
              rating: profile.rating || 0,
            }}
            accent={accent}
          />
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <div className="mx-auto max-w-[1200px] px-4 lg:px-6">
        <Tabs defaultValue="about" className="mt-8">
          <TabsList className="w-full flex-row justify-start border-b border-[#333] bg-transparent p-0" style={{ direction: 'rtl' }}>
            <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">نبذة عني</TabsTrigger>
            <TabsTrigger value="badges" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">الشارات</TabsTrigger>
            <TabsTrigger value="xp" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">الخبرة</TabsTrigger>
            <TabsTrigger value="mods" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">التعريبات ({profile.stats.mods})</TabsTrigger>
            <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">النشاط</TabsTrigger>
            {isOwner && (
              <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white">الإعدادات</TabsTrigger>
            )}
          </TabsList>

          {/* About tab */}
          <TabsContent value="about" className="mt-6">
            <div className="rounded-lg bg-[#1a1a1a] p-6" dir="rtl">
              <p className="text-right text-sm leading-relaxed text-gray-300">{profile.bio || 'لا توجد نبذة بعد.'}</p>
            </div>
          </TabsContent>

          {/* Badges tab */}
          <TabsContent value="badges" className="mt-6">
            <ProfileBadgesGrid badges={badges} accent={accent} />
          </TabsContent>

          {/* XP tab */}
          <TabsContent value="xp" className="mt-6">
            {profile.xp ? (
              <ProfileXpBar xp={profile.xp} accent={accent} />
            ) : (
              <div className="rounded-lg bg-[#1a1a1a] p-6 text-center">
                <p className="text-sm text-gray-500">لم يبدأ بعد</p>
              </div>
            )}
          </TabsContent>

          {/* Mods tab */}
          <TabsContent value="mods" className="mt-6">
            <ProfileModsFilter mods={activity.mods} accent={accent} loading={loading} />
          </TabsContent>

          {/* Activity tab */}
          <TabsContent value="activity" className="mt-6">
            <ProfileActivityFeed activity={activity} accent={accent} />
          </TabsContent>

          {/* Settings tab */}
          {isOwner && (
            <TabsContent value="settings" className="mt-6">
              <ProfileSettings
                profile={profile}
                accent={accent}
                onSave={(updated) => setProfile(prev => prev ? { ...prev, ...updated } : prev)}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
