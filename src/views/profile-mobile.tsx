'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Settings,
  Mail,
  UserPlus,
  UserCheck,
  Loader2,
  Calendar,
  MessageSquare,
  Package,
  Users,
  Eye,
  Download,
  ThumbsUp,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatNumber, formatArabicDate } from '@/lib/format'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { CreatorBadge } from '@/components/creator-badge'
import { ProfileBadgesGrid } from '@/components/profile/profile-badges-grid'
import { ModCard } from '@/components/mod-card'
import { ReportButton } from '@/components/report-button'
import { ProfileSocialLinks } from '@/components/profile/profile-social-links'
import type { ModSummary } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types — same shape as src/views/profile.tsx (reused, no new API calls)
// ---------------------------------------------------------------------------

export interface ProfileData {
  id: string
  username: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  websiteUrl: string | null
  twitterUrl: string | null
  instagramUrl: string | null
  tiktokUrl: string | null
  youtubeUrl: string | null
  githubUrl: string | null
  discordUrl: string | null
  accentColor: string | null
  hideJoinDate?: boolean
  profileVisibility?: string
  role: string
  tier?: number
  specialRoles?: string | null
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

export interface ActivityData {
  comments: {
    id: string
    text: string
    createdAt: string
    guestName?: string | null
    user?: { username: string; avatarUrl: string | null } | null
    mod: { name: string; slug: string }
  }[]
  mods: ModSummary[]
  modEdits?: { id: string; name: string; slug: string; updatedAt: string }[]
  endorsements?: { id: string; createdAt: string; mod: { name: string; slug: string } }[]
  monthlyStats?: { month: string; comments: number; mods: number; endorsements: number }[]
}

export interface BadgeData {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

export interface ProfileMobileProps {
  profile: ProfileData | null
  activity: ActivityData
  badges: BadgeData[]
  loading: boolean
  error: string | null
  isFollowing: boolean
  followLoading: boolean
  onFollowToggle: () => void
  isOwner: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileMobile({
  profile,
  activity,
  badges,
  loading,
  error,
  isFollowing,
  followLoading,
  onFollowToggle,
  isOwner,
}: ProfileMobileProps) {
  const { toast } = useToast()

  if (loading) {
    return (
      <div
        className="lg:hidden flex min-h-[40vh] items-center justify-center bg-[#121212] p-8"
        dir="rtl"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-transparent"
          aria-label="جاري التحميل"
        />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div
        className="lg:hidden flex min-h-[40vh] flex-col items-center justify-center gap-4 bg-[#121212] p-6 text-center"
        dir="rtl"
      >
        <p className="break-words text-sm text-gray-400">{error || 'المستخدم غير موجود'}</p>
        <Link
          href="/"
          className="text-sm text-primary hover:underline min-h-[44px] touch-manipulation inline-flex items-center"
        >
          العودة للرئيسية
        </Link>
      </div>
    )
  }

  const accent = profile.accentColor || '#ff8c00'
  const accentSoft = `${accent}22`
  const accentMuted = `${accent}14`

  return (
    <div className="lg:hidden bg-[#121212] text-white overflow-x-hidden" dir="rtl">
      {/* 1. Banner h-[140px] — shorter than desktop 300px */}
      <div className="relative h-[140px] overflow-hidden border-b border-[#333]">
        {profile.bannerUrl ? (
          <Image
            src={profile.bannerUrl}
            alt="banner"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${accentSoft} 0%, ${accentMuted} 50%, #1a1a1a 100%)`,
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#121212]/20 via-[#121212]/10 to-transparent pointer-events-none" />
      </div>

      {/* 2. Avatar centered, -mt-10, h-20 w-20, border-4 border-[#121212] */}
      <div className="flex justify-center">
        <div className="relative -mt-10 z-10">
          <Avatar
            className="h-20 w-20 border-4 border-[#121212] shadow-xl"
            style={{ boxShadow: `0 0 18px ${accentSoft}` }}
          >
            <AvatarImage
              src={profile.avatarUrl || undefined}
              alt={profile.displayName || profile.username}
            />
            <AvatarFallback
              className="text-xl sm:text-2xl font-bold"
              style={{ backgroundColor: accentSoft, color: accent }}
            >
              {(profile.displayName || profile.username)[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Online indicator */}
          <span
            className={`absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#121212] ${profile.onlineStatus === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}
            aria-hidden
          />
        </div>
      </div>

      {/* 3. Name + @username centered */}
      <div className="mt-3 px-3 sm:px-4 text-center">
        <h1 className="break-words text-xl font-bold text-white leading-tight">
          {profile.displayName || profile.username}
        </h1>
        <p className="mt-1 break-words text-sm text-gray-400" dir="ltr">
          @{profile.username}
        </p>
        {!profile.hideJoinDate && (
          <p className="mt-1 flex items-center justify-center gap-1 break-words text-xs text-gray-500">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>انضم في {formatArabicDate(profile.joinedAt)}</span>
            <span className="mx-1">•</span>
            <span>{profile.onlineStatus === 'online' ? 'متصل الآن' : 'غير متصل'}</span>
          </p>
        )}
      </div>

      {/* 4. Badges row: flex flex-wrap justify-center gap-1 — RoleBadge, TierBadge, CreatorBadge */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5 px-3 sm:px-4">
        <RoleBadge role={profile.role} size="sm" />
        <TierBadge
          tier={(profile as unknown as { tier?: number }).tier || 0}
          role={profile.role}
          size="sm"
        />
        <CreatorBadge
          role={profile.role}
          specialRoles={
            (profile as unknown as { specialRoles?: string }).specialRoles as string | null
          }
          showLabels
          size="sm"
        />
      </div>

      {/* Social links — compact centered */}
      {(profile.websiteUrl ||
        profile.twitterUrl ||
        profile.instagramUrl ||
        profile.tiktokUrl ||
        profile.youtubeUrl ||
        profile.githubUrl ||
        profile.discordUrl) && (
        <div className="mt-3 flex justify-center px-3 sm:px-4">
          <ProfileSocialLinks
            websiteUrl={profile.websiteUrl}
            twitterUrl={profile.twitterUrl}
            instagramUrl={profile.instagramUrl}
            tiktokUrl={profile.tiktokUrl}
            youtubeUrl={profile.youtubeUrl}
            githubUrl={profile.githubUrl}
            discordUrl={profile.discordUrl}
          />
        </div>
      )}

      {/* 5. Bio: text-center text-sm px-3 sm:px-4 break-words */}
      <div className="mt-4 px-3 sm:px-4">
        <p className="break-words text-center text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
          {profile.bio || 'لا توجد نبذة بعد.'}
        </p>
      </div>

      {/* 6. Action buttons: flex flex-wrap justify-center gap-2 (min-h-[44px] touch-manipulation) */}
      <div className="mt-4 flex flex-wrap justify-center gap-2 px-3 sm:px-4">
        {isOwner ? (
          <Link href="/settings" className="inline-flex">
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px] touch-manipulation h-auto gap-1.5 border-[#333] px-3 py-2 text-xs text-gray-300 hover:bg-[#222]"
            >
              <Settings className="h-4 w-4 shrink-0" />
              إدارة الحساب والإعدادات
            </Button>
          </Link>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px] touch-manipulation h-auto gap-1.5 border-[#333] px-3 py-2 text-xs text-gray-300 hover:bg-[#222]"
              onClick={() => toast({ title: 'رسالة', description: 'قريباً' })}
            >
              <Mail className="h-4 w-4 shrink-0" />
              رسالة
            </Button>
            <Button
              size="sm"
              variant={isFollowing ? 'outline' : 'default'}
              className="min-h-[44px] touch-manipulation h-auto gap-1.5 px-3 py-2 text-xs"
              style={isFollowing ? { borderColor: '#333' } : undefined}
              onClick={onFollowToggle}
              disabled={followLoading}
              aria-busy={followLoading}
            >
              {followLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  جارٍ...
                </>
              ) : isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4 shrink-0" />
                  متابَع
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 shrink-0" />
                  متابعة
                </>
              )}
            </Button>
            {profile.id && (
              <span className="inline-flex min-h-[44px] touch-manipulation items-center">
                <ReportButton targetType="user" targetId={profile.id} variant="outline" size="sm" />
              </span>
            )}
          </>
        )}
      </div>

      {/* 7. Stats: grid grid-cols-3 gap-1 sm:gap-2 px-3 sm:px-4 — تعريبات/تحميلات/إعجابات compact cells */}
      <div className="mt-6 px-3 sm:px-4">
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          <CompactStat
            icon={<Package className="h-4 w-4" />}
            label="تعريبات"
            value={formatNumber(profile.stats.mods)}
          />
          <CompactStat
            icon={<Download className="h-4 w-4" />}
            label="تحميلات"
            value={formatNumber(profile.stats.totalDownloads)}
          />
          <CompactStat
            icon={<ThumbsUp className="h-4 w-4" />}
            label="إعجابات"
            value={formatNumber(profile.stats.totalEndorsements)}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 sm:gap-2">
          <CompactStat
            icon={<Eye className="h-4 w-4" />}
            label="مشاهدات"
            value={formatNumber(profile.stats.totalViews)}
          />
          <CompactStat
            icon={<Users className="h-4 w-4" />}
            label="متابعون"
            value={formatNumber(profile.stats.followersCount)}
          />
          <CompactStat
            icon={<Users className="h-4 w-4" />}
            label="يتابع"
            value={formatNumber(profile.stats.followingCount)}
          />
        </div>
      </div>

      {/* 8. Tabs: TabsList overflow-x-auto (horizontal scroll) — same tabs as desktop: about, badges, comments, mods, فرقي */}
      <div className="mt-6 px-3">
        <Tabs defaultValue="about" className="w-full">
          <TabsList className="flex w-full flex-row justify-start overflow-x-auto whitespace-nowrap border-b border-[#333] bg-transparent p-0 h-auto rounded-none scrollbar-thin gap-0">
            <TabsTrigger
              value="about"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:border-primary data-[state=active]:text-white data-[state=active]:shadow-none min-h-[44px] touch-manipulation"
            >
              نبذة عني
            </TabsTrigger>
            <TabsTrigger
              value="badges"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:border-primary data-[state=active]:text-white data-[state=active]:shadow-none min-h-[44px] touch-manipulation"
            >
              الشارات
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:border-primary data-[state=active]:text-white data-[state=active]:shadow-none min-h-[44px] touch-manipulation"
            >
              التعليقات ({activity.comments?.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="mods"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:border-primary data-[state=active]:text-white data-[state=active]:shadow-none min-h-[44px] touch-manipulation"
            >
              التعريبات ({profile.stats.mods})
            </TabsTrigger>
            <Link
              href={`/profile/${encodeURIComponent(profile.username)}/teams`}
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-white transition-colors min-h-[44px] touch-manipulation"
            >
              <Users className="h-3.5 w-3.5 ml-1 shrink-0" />
              فرقي
            </Link>
          </TabsList>

          {/* 9. Tab content stacked */}
          {/* about → stacked text rows */}
          <TabsContent value="about" className="mt-4">
            <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#333] space-y-3" dir="rtl">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500">النبذة</p>
                <p className="break-words text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
                  {profile.bio || 'لا توجد نبذة بعد.'}
                </p>
              </div>
              {!profile.hideJoinDate && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#333] pt-3 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1 break-words">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    تاريخ الانضمام: {formatArabicDate(profile.joinedAt)}
                  </span>
                </div>
              )}
              {profile.xp && (
                <div className="border-t border-[#333] pt-3">
                  <p className="text-xs font-bold text-gray-500">المستوى</p>
                  <p className="mt-1 break-words text-sm text-gray-300">
                    {profile.xp.name} ({profile.xp.level}) — {formatNumber(profile.xp.points)} نقطة
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* badges → ProfileBadgesGrid */}
          <TabsContent value="badges" className="mt-4">
            <ProfileBadgesGrid badges={badges} />
          </TabsContent>

          {/* comments → stacked list */}
          <TabsContent value="comments" className="mt-4" dir="rtl">
            {activity.comments && activity.comments.length > 0 ? (
              <div className="space-y-2">
                {activity.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-lg bg-[#1a1a1a] p-3 border border-[#333] break-words"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-words text-xs font-bold text-gray-300">
                            {(
                              comment as unknown as {
                                user?: { username: string } | null
                                guestName?: string | null
                              }
                            ).user?.username ||
                              (comment as unknown as { guestName?: string | null }).guestName ||
                              'زائر'}
                          </span>
                          <span className="text-xs text-gray-600">
                            • {new Date(comment.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm text-gray-300 line-clamp-3 whitespace-pre-wrap">
                          {comment.text}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-gray-500">على تعريب</span>
                          <Link
                            href={`/mod/${comment.mod.slug}`}
                            className="break-words text-xs text-primary hover:underline"
                          >
                            {comment.mod.name}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-[#1a1a1a] p-8 text-center border border-[#333]">
                <MessageSquare className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                <p className="break-words text-sm text-gray-500">لا توجد تعليقات بعد</p>
                <p className="mt-1 break-words text-xs text-gray-600">
                  ستظهر تعليقاتك هنا عند المشاركة
                </p>
              </div>
            )}
          </TabsContent>

          {/* mods tab → ModCard grid grid-cols-2 gap-1.5 sm:gap-2 (compact) */}
          <TabsContent value="mods" className="mt-4">
            {activity.mods && activity.mods.length > 0 ? (
              <div className="grid grid-cols-2 gap-0.5 sm:gap-1">
                {activity.mods.map((m) => (
                  <div
                    key={m.id}
                    className="origin-top scale-[0.80] [&_h3]:!text-[10px] [&_h3]:!leading-tight [&_h3]:!h-[2em] [&_h3]:!break-words [&_div.p-2\.5]:!p-1.5"
                  >
                    <ModCard mod={m} variant="compact" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-[#1a1a1a] p-8 text-center border border-[#333]">
                <Package className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                <p className="break-words text-sm text-gray-500">لا يوجد تعريبات</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* bottom spacing */}
      <div className="h-6" />
    </div>
  )
}

function CompactStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-[#1a1a1a] p-3 border border-[#333] text-center min-w-0 overflow-hidden">
      <div className="flex justify-center text-gray-400 mb-1">{icon}</div>
      <div className="break-words text-base font-bold text-white leading-none">{value}</div>
      <div className="mt-1 break-words text-[11px] leading-none text-gray-400">{label}</div>
    </div>
  )
}
