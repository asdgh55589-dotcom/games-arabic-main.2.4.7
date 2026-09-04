'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  Crown,
  Shield,
  User,
  Settings,
  Mail,
  UserPlus,
  UserCheck,
  Calendar,
  CheckCircle,
  Download,
  ThumbsUp,
  MessageSquare,
  Package,
  Eye,
  Users,
  Loader2,
  Trophy,
  TrendingUp,
  History,
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useAuth } from '@/contexts/auth-context'
import { formatArabicDate, formatNumber } from '@/lib/format'
import { ProfileStats } from '@/components/profile/profile-stats'
import { ProfileBadgesGrid } from '@/components/profile/profile-badges-grid'
import { ProfileXpBar } from '@/components/profile/profile-xp-bar'
import { getTierLabel } from '@/lib/tiers'
import { getRoleLabel } from '@/lib/roles'
import { ProfileModsFilter } from '@/components/profile/profile-mods-filter'
import { ProfileSocialLinks } from '@/components/profile/profile-social-links'
import { TierBadge } from '@/components/tier-badge'
import { ReportButton } from '@/components/report-button'
import { CreatorBadge } from '@/components/creator-badge'
import { RoleBadge } from '@/components/role-badge'
import { TierProgress } from '@/components/tier-progress'
import { ProfileMobile } from './profile-mobile'
import type { ModSummary } from '@/lib/types'

interface ProfileData {
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

interface BadgeData {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  owner: {
    label: 'مالك الموقع',
    icon: <Crown className="h-3 w-3" />,
    className: 'bg-amber-500 text-white',
  },
  manager: {
    label: 'مدير',
    icon: <Shield className="h-3 w-3" />,
    className: 'bg-orange-500 text-white',
  },
  admin: {
    label: 'مسؤول',
    icon: <Shield className="h-3 w-3" />,
    className: 'bg-red-500 text-white',
  },
  moderator: {
    label: 'مشرف',
    icon: <User className="h-3 w-3" />,
    className: 'bg-purple-500 text-white',
  },
  publisher: {
    label: 'ناشر',
    icon: <User className="h-3 w-3" />,
    className: 'bg-teal-500 text-white',
  },
  creator: {
    label: 'مُعَرِّب',
    icon: <User className="h-3 w-3" />,
    className: 'bg-sky-500 text-white',
  },
  member: { label: 'عضو', icon: <User className="h-3 w-3" />, className: 'bg-blue-500 text-white' },
}

export function ProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const username = (params.user as string) || ''
  const defaultTab = searchParams.get('tab') || 'about'
  const { toast } = useToast()

  const { user: currentUser } = useAuth()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [activity, setActivity] = useState<ActivityData>({ comments: [], mods: [] })
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useDocumentTitle(profile?.displayName || profile?.username || 'الملف الشخصي')

  const fetchProfile = useCallback(
    async (retry = true) => {
      if (!username) {
        setError('لم يُحدد مستخدم')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const doFetch = async () => {
        const res = await fetch(
          `/api/users/${encodeURIComponent(username)}/full-profile?limit=10`,
          {
            next: { revalidate: 60 },
          },
        )
        if (res.ok) {
          const data = await res.json()
          const payload = data.data
          setProfile(payload.profile)
          setActivity(payload.activity || { comments: [], mods: [] })
          setBadges(payload.badges || [])
          setIsFollowing(Boolean(payload.follow?.isFollowing))
          setError(null)
          setLoading(false)
          return true
        } else {
          const data = await res.json().catch(() => null)
          const errCode = data?.error?.code
          if (errCode === 'FORBIDDEN') {
            setError('هذا الملف الشخصي خاص')
          } else if (res.status === 404) {
            setError('المستخدم غير موجود — تأكد من كتابة الاسم بشكل صحيح')
          } else if (res.status >= 500) {
            throw new Error('server_error')
          } else {
            setError('المستخدم غير موجود — تأكد من كتابة الاسم بشكل صحيح')
          }
          setProfile(null)
          setLoading(false)
          return false
        }
      }

      try {
        return await doFetch()
      } catch (err) {
        // Retry once for transient network/server errors
        if (retry && (err instanceof TypeError || (err as Error).message === 'server_error')) {
          await new Promise((r) => setTimeout(r, 1000))
          try {
            return await doFetch()
          } catch (retryErr) {
            console.error('[profile] fetch retry failed:', retryErr)
          }
        }
        console.error('[profile] fetch failed:', err)
        const isNetwork =
          err instanceof TypeError && String((err as Error).message).includes('fetch')
        const msg = isNetwork
          ? 'تحقق من اتصال الإنترنت وحاول مرة أخرى'
          : 'حدث خطأ أثناء تحميل البيانات'
        setError(msg)
        toast({ title: 'خطأ في التحميل', description: msg, variant: 'destructive' })
        setProfile(null)
        setLoading(false)
        return false
      }
    },
    [username, toast],
  )

  const handleFollowToggle = async () => {
    if (!currentUser) {
      toast({
        title: 'يجب تسجيل الدخول أولاً',
        description: 'سجل دخولك لمتابعة المستخدمين',
        variant: 'destructive',
      })
      return
    }
    if (followLoading) return

    // تأكيد عند إلغاء المتابعة
    if (isFollowing) {
      if (!confirm(`هل أنت متأكد من إلغاء متابعة ${username}؟`)) return
    }

    const prevFollowing = isFollowing
    const prevFollowers = profile?.stats.followersCount ?? 0

    // Optimistic UI
    setIsFollowing(!prevFollowing)
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            stats: {
              ...prev.stats,
              followersCount: prevFollowing ? Math.max(0, prevFollowers - 1) : prevFollowers + 1,
            },
          }
        : prev,
    )
    setFollowLoading(true)

    try {
      const method = prevFollowing ? 'DELETE' : 'POST'
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, { method })
      const data = await res.json().catch(() => null)

      if (res.ok) {
        const payload = data.data
        setIsFollowing(payload.isFollowing)
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                stats: {
                  ...prev.stats,
                  followersCount: payload.followersCount,
                  followingCount: payload.followingCount,
                },
              }
            : prev,
        )
        toast({
          title: payload.isFollowing ? 'تمت المتابعة بنجاح' : 'تم إلغاء المتابعة',
          description: payload.isFollowing
            ? `أنت الآن تتابع ${username}`
            : `لم تعد تتابع ${username}`,
        })
      } else {
        // Revert optimistic
        setIsFollowing(prevFollowing)
        setProfile((prev) =>
          prev ? { ...prev, stats: { ...prev.stats, followersCount: prevFollowers } } : prev,
        )

        const code = data?.error?.code
        const msg = data?.error?.message
        if (res.status === 401) {
          toast({
            title: 'يجب تسجيل الدخول',
            description: 'سجل دخولك أولاً',
            variant: 'destructive',
          })
        } else if (code === 'FORBIDDEN' || msg?.includes('yourself')) {
          toast({ title: 'لا يمكنك متابعة نفسك', variant: 'destructive' })
        } else if (code === 'CONFLICT' || res.status === 409) {
          toast({ title: 'أنت تتابع هذا المستخدم بالفعل', variant: 'destructive' })
          // مزامنة الحالة
          setIsFollowing(true)
        } else {
          toast({
            title: 'حدث خطأ',
            description: msg || 'فشل العملية، حاول مرة أخرى',
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      // Revert optimistic
      setIsFollowing(prevFollowing)
      setProfile((prev) =>
        prev ? { ...prev, stats: { ...prev.stats, followersCount: prevFollowers } } : prev,
      )
      console.error('[profile] follow toggle failed:', error)
      const isNetwork = error instanceof TypeError && String(error.message).includes('fetch')
      toast({
        title: 'حدث خطأ في الاتصال',
        description: isNetwork
          ? 'تحقق من اتصال الإنترنت وحاول مرة أخرى'
          : 'فشل العملية، حاول مرة أخرى',
        variant: 'destructive',
      })
    } finally {
      setFollowLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      await fetchProfile()
    }

    load()
  }, [fetchProfile])

  const isOwner = currentUser?.username === profile?.username
  const accent = profile?.accentColor || '#ff8c00'
  const accentSoft = `${accent}22`
  const accentMuted = `${accent}14`
  const roleBadge = ROLE_BADGE[profile?.role || 'member'] || ROLE_BADGE.member

  if (loading) {
    return (
      <>
        <div className="hidden lg:block">
          <div className="min-h-screen bg-[#121212] flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
          </div>
        </div>
        <ProfileMobile
          profile={null}
          activity={activity}
          badges={badges}
          loading={loading}
          error={null}
          isFollowing={isFollowing}
          followLoading={followLoading}
          onFollowToggle={handleFollowToggle}
          isOwner={isOwner}
        />
      </>
    )
  }

  if (error || !profile) {
    return (
      <>
        <div className="hidden lg:block">
          <div className="min-h-screen bg-[#121212] flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-400">{error || 'المستخدم غير موجود'}</p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={() => fetchProfile()}
                  variant="outline"
                  className="border-[#333] text-gray-300"
                >
                  إعادة المحاولة
                </Button>
                <Link href="/" className="inline-block text-sm text-primary hover:underline">
                  العودة للرئيسية
                </Link>
              </div>
            </div>
          </div>
        </div>
        <ProfileMobile
          profile={null}
          activity={activity}
          badges={badges}
          loading={false}
          error={error}
          isFollowing={isFollowing}
          followLoading={followLoading}
          onFollowToggle={handleFollowToggle}
          isOwner={isOwner}
        />
      </>
    )
  }

  return (
    <>
      <div className="hidden lg:block">
        <div className="min-h-screen bg-[#121212] text-white" dir="rtl">
          {/* ===== Banner — ينتهي عند الخط مباشرة بدون مساحة سوداء ===== */}
          <div className="relative h-[300px] overflow-hidden border-b border-[#333]">
            {profile.bannerUrl ? (
              <Image
                src={profile.bannerUrl}
                alt="banner"
                fill
                quality={100}
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
            {/* تعتيم خفيف جداً لدمج البنر — 20% فقط */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#121212]/20 via-[#121212]/10 to-transparent pointer-events-none" />
          </div>

          {/* ===== User Info — داخل البنر ليكون الخط نهاية البنر فعلاً ===== */}
          <div className="mx-auto max-w-[1200px] px-4 lg:px-6">
            <div style={{ marginTop: '-130px' }} className="relative z-10 pb-4">
              <div className="flex gap-6">
                {/* Avatar + badges */}
                <div className="shrink-0">
                  <div className="relative">
                    <Avatar
                      className="h-24 w-24 border-4 border-[#121212] shadow-xl"
                      style={{ boxShadow: `0 0 18px ${accentSoft}` }}
                    >
                      <AvatarImage
                        src={profile.avatarUrl || undefined}
                        alt={profile.displayName || profile.username}
                      />
                      <AvatarFallback
                        className="text-3xl font-bold"
                        style={{ backgroundColor: accentSoft, color: accent }}
                      >
                        {(profile.displayName || profile.username)[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online status */}
                    <div
                      className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-[#121212] ${
                        profile.onlineStatus === 'online' ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    />
                    {/* Tier badge — مخفي عند التكرار مع RoleBadge */}
                    {profile.role !== 'member' &&
                      getTierLabel(profile.role, (profile as any).tier || 0) !==
                        getRoleLabel(profile.role) && (
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                          <TierBadge
                            tier={(profile as any).tier || 0}
                            role={profile.role}
                            size="md"
                          />
                        </div>
                      )}
                  </div>
                </div>

                {/* Name + actions */}
                <div className="flex-1 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">
                      {profile.displayName || profile.username}
                    </h1>
                    <RoleBadge role={profile.role} size="sm" />
                    <CreatorBadge
                      role={profile.role}
                      specialRoles={(profile as unknown as { specialRoles?: string }).specialRoles}
                      showLabels
                      size="sm"
                    />
                    {profile.role === 'owner' && (
                      <CheckCircle className="h-5 w-5" style={{ color: accent }} />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    {!profile.hideJoinDate && (
                      <>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          انضم في {formatArabicDate(profile.joinedAt)}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>{profile.onlineStatus === 'online' ? 'متصل الآن' : 'غير متصل'}</span>
                  </div>

                  {/* Social links */}
                  <div className="mt-3">
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

                  {/* Action buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {isOwner ? (
                      <Link href="/settings">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-[#333] text-xs text-gray-300 hover:bg-[#222] min-h-[44px]"
                        >
                          <Settings className="h-3.5 w-3.5" /> إدارة الحساب والإعدادات
                        </Button>
                      </Link>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-[#333] text-xs text-gray-300 hover:bg-[#222] min-h-[44px]"
                          onClick={() => toast({ title: 'رسالة', description: 'قريباً' })}
                        >
                          <Mail className="h-3.5 w-3.5" /> رسالة
                        </Button>
                        <Button
                          size="sm"
                          variant={isFollowing ? 'outline' : 'default'}
                          className="h-8 gap-1.5 text-xs min-h-[44px]"
                          style={isFollowing ? { borderColor: '#333' } : {}}
                          onClick={handleFollowToggle}
                          disabled={followLoading}
                          aria-busy={followLoading}
                        >
                          {followLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ...
                            </>
                          ) : isFollowing ? (
                            <>
                              <UserCheck className="h-3.5 w-3.5" /> متابَع
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-3.5 w-3.5" /> متابعة
                            </>
                          )}
                        </Button>
                        {profile?.id && (
                          <ReportButton
                            targetType="user"
                            targetId={profile.id}
                            variant="outline"
                            size="sm"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== Stats — مسافة أكبر بين الخط والصناديق ===== */}
          <div className="px-4 lg:px-6 mt-8">
            <div className="mx-auto max-w-[1400px]">
              <ProfileStats
                stats={profile.stats}
                xp={profile.xp}
                isTranslator={profile.isTranslator}
                translatorStats={{
                  badgesCount: badges.filter((b) => b.earned).length,
                  firstModDate: profile.firstModDate || null,
                  rating: profile.rating || 0,
                }}
                role={profile.role}
              />
            </div>
          </div>

          {/* ===== Tier Progress (for creator/publisher/moderator) ===== */}
          <TierProgressSection
            username={profile.username}
            role={profile.role}
            tier={(profile as unknown as { tier?: number }).tier || 0}
          />

          {/* ===== Tabs ===== */}
          <div className="mx-auto max-w-[1200px] px-4 lg:px-6 mt-8">
            <Tabs defaultValue={defaultTab} className="mt-0">
              <TabsList
                className="w-full flex-row justify-start overflow-x-auto whitespace-nowrap border-b border-[#333] bg-transparent p-0 scrollbar-thin"
                style={{ direction: 'rtl' }}
              >
                <TabsTrigger
                  value="about"
                  className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white"
                >
                  نبذة عني
                </TabsTrigger>
                <TabsTrigger
                  value="badges"
                  className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white"
                >
                  الشارات
                </TabsTrigger>
                <TabsTrigger
                  value="comments"
                  className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white"
                >
                  التعليقات ({activity.comments?.length || 0})
                </TabsTrigger>
                <TabsTrigger
                  value="mods"
                  className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:text-white"
                >
                  التعريبات ({profile.stats.mods})
                </TabsTrigger>
                <Link
                  href={`/profile/${encodeURIComponent(profile.username)}/teams`}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-white transition-colors min-h-[44px]"
                >
                  <Users className="h-3.5 w-3.5 ml-1" />
                  فرقي
                </Link>
              </TabsList>

              {/* About tab */}
              <TabsContent value="about" className="mt-6">
                <div className="rounded-lg bg-[#1a1a1a] p-6" dir="rtl">
                  <p className="text-right text-sm leading-relaxed text-gray-300">
                    {profile.bio || 'لا توجد نبذة بعد.'}
                  </p>
                </div>
              </TabsContent>

              {/* Badges tab */}
              <TabsContent value="badges" className="mt-6">
                <ProfileBadgesGrid badges={badges} />
              </TabsContent>

              {/* Comments tab — التعليقات (يمين) */}
              <TabsContent value="comments" className="mt-6" dir="rtl">
                {activity.comments && activity.comments.length > 0 ? (
                  <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#333]" dir="rtl">
                    <h3 className="text-sm font-bold text-white mb-3 text-right">
                      آخر التعليقات ({activity.comments.length})
                    </h3>
                    <div className="space-y-2">
                      {activity.comments.map((comment) => (
                        <div
                          key={comment.id}
                          dir="rtl"
                          className="flex flex-row items-start gap-3 p-3 rounded-lg hover:bg-[#222] transition-colors border border-transparent hover:border-[#333] text-right"
                        >
                          <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0 text-right">
                            <div className="flex flex-row items-center justify-start gap-2 mb-1">
                              <span className="text-xs font-bold text-gray-300">
                                {(comment as any).user?.username ||
                                  (comment as any).guestName ||
                                  'زائر'}
                              </span>
                              {(comment as any).parentId && (
                                <span className="text-[10px] bg-[#222] border border-[#333] px-1.5 py-0.5 rounded text-gray-400">
                                  رد
                                </span>
                              )}
                              <span className="text-xs text-gray-600">
                                • {new Date(comment.createdAt).toLocaleDateString('ar-EG')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 line-clamp-2 text-right" dir="rtl">
                              {comment.text}
                            </p>
                            <div className="flex flex-row items-center justify-start gap-2 mt-1">
                              <span className="text-xs text-gray-500">على تعريب</span>
                              <Link
                                href={`/mod/${comment.mod.slug}`}
                                className="text-xs text-primary hover:underline truncate"
                              >
                                {comment.mod.name}
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#1a1a1a] p-8 text-center border border-[#333]">
                    <MessageSquare className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">لا توجد تعليقات بعد</p>
                    <p className="mt-1 text-xs text-gray-600">ستظهر تعليقاتك هنا عند المشاركة</p>
                  </div>
                )}
              </TabsContent>

              {/* Mods tab */}
              <TabsContent value="mods" className="mt-6">
                <ProfileModsFilter mods={activity.mods} loading={loading} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      <ProfileMobile
        profile={profile}
        activity={activity}
        badges={badges}
        loading={loading}
        error={error}
        isFollowing={isFollowing}
        followLoading={followLoading}
        onFollowToggle={handleFollowToggle}
        isOwner={isOwner}
      />
    </>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#333]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-gray-400">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  )
}

function TierProgressSection({
  username,
  role,
  tier,
}: {
  username: string
  role: string
  tier: number
}) {
  const [data, setData] = useState<null | {
    currentTier: number
    suggestedTier: number
    shouldUpgrade: boolean
    requiresAdminApproval: boolean
    progress: {
      publishedCount: number
      averageRating: number
      reviewsCount: number
      monthsActive: number
    }
    nextTierRequirements: {
      minPublishedCount?: number
      minAverageRating?: number
      minReviewsCount?: number
      minMonthsActive?: number
      requiresAdminApproval?: boolean
    } | null
  }>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!['creator', 'publisher', 'moderator'].includes(role)) {
      setLoading(false)
      return
    }
    fetch(`/api/users/${encodeURIComponent(username)}/tier-progress`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setData(json.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username, role])

  if (!['creator', 'publisher', 'moderator'].includes(role)) return null
  if (loading)
    return (
      <div className="mx-auto max-w-[1400px] px-4 lg:px-6 mt-4">
        <div className="h-20 rounded-lg bg-[#1a1a1a] border border-[#333] animate-pulse" />
      </div>
    )
  if (!data) return null

  return (
    <div className="px-4 lg:px-6 mt-4">
      <div className="mx-auto max-w-[1400px]">
        <div className="rounded-lg bg-[#1a1a1a] p-6 border border-[#333]">
          <h3 className="font-bold mb-4 flex items-center gap-2">📈 تقدم المستوى</h3>
          <TierProgress
            role={role as unknown as import('@/lib/roles').UserRole}
            currentTier={tier}
            progress={data.progress}
            nextRequirements={data.nextTierRequirements}
          />
        </div>
      </div>
    </div>
  )
}

function LevelTab({ username, role, tier }: { username: string; role: string; tier: number }) {
  const [data, setData] = useState<null | {
    user: { username: string; role: string; tier: number }
    currentConfig: { label: string; description: string }
    tierProgress: {
      currentTier: number
      suggestedTier: number
      shouldUpgrade: boolean
      requiresAdminApproval: boolean
      progress: {
        publishedCount: number
        averageRating: number
        reviewsCount: number
        monthsActive: number
      }
      nextTierRequirements: {
        minPublishedCount?: number
        minAverageRating?: number
        minReviewsCount?: number
        minMonthsActive?: number
        requiresAdminApproval?: boolean
      } | null
    }
    tierHistory: {
      id: string
      fromTier: number
      toTier: number
      reason: string
      createdAt: string
    }[]
  }>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${encodeURIComponent(username)}/level`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setData(json.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-lg bg-[#1a1a1a] border border-[#333] animate-pulse" />
        <div className="h-32 rounded-lg bg-[#1a1a1a] border border-[#333] animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg bg-[#1a1a1a] p-6 text-center border border-[#333]">
        <p className="text-sm text-gray-500">فشل تحميل بيانات المستوى</p>
      </div>
    )
  }

  // استخدام getTierLabel لعرض أسماء المستويات في السجل
  const getLabel = (t: number) => {
    try {
      // استيراد ديناميكي بسيط — نستخدم نفس منطق getTierLabel
      const labels: Record<string, Record<number, string>> = {
        member: { 0: 'عضو عادي' },
        creator: {
          1: 'مُعَرِّب جديد',
          2: 'مُعَرِّب نشط',
          3: 'مُعَرِّب محترف',
          4: 'مُعَرِّب معتمد',
          5: 'مُعَرِّب أسطوري',
        },
        publisher: { 1: 'ناشر جديد', 2: 'ناشر موثوق', 3: 'ناشر رئيسي' },
        moderator: { 1: 'مشرف جديد', 2: 'مشرف', 3: 'مشرف كبير' },
        admin: { 1: 'مسؤول', 2: 'مسؤول أول' },
        manager: { 1: 'مدير', 2: 'مدير عام', 3: 'مدير تنفيذي' },
        owner: { 1: 'مالك الموقع' },
      }
      return labels[role]?.[t] || `المستوى ${t}`
    } catch {
      return `المستوى ${t}`
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Current Tier Card — مطابق لـ src/app/profile/[user]/level/page.tsx:55 */}
      <div className="rounded-lg bg-[#1a1a1a] border border-[#333] p-6">
        <h3 className="flex items-center gap-2 font-bold text-white mb-4">
          <Trophy className="h-5 w-5 text-yellow-500" />
          المستوى الحالي
        </h3>
        <div className="flex items-center gap-4">
          <TierBadge
            role={role as unknown as import('@/lib/roles').UserRole}
            tier={data.user.tier}
            size="lg"
          />
          <div>
            <div className="font-bold text-white">{data.currentConfig.label}</div>
            <div className="text-sm text-gray-400">{data.currentConfig.description}</div>
          </div>
        </div>
      </div>

      {/* Progress to Next Tier — مطابق لـ level/page.tsx:71 */}
      <div className="rounded-lg bg-[#1a1a1a] border border-[#333] p-6">
        <h3 className="flex items-center gap-2 font-bold text-white mb-4">
          <TrendingUp className="h-5 w-5 text-green-500" />
          التقدم نحو المستوى التالي
        </h3>
        <TierProgress
          role={role as unknown as import('@/lib/roles').UserRole}
          currentTier={data.user.tier}
          progress={data.tierProgress.progress}
          nextRequirements={data.tierProgress.nextTierRequirements}
        />
      </div>

      {/* Tier History — مطابق لـ level/page.tsx:84 */}
      {data.tierHistory.length > 0 && (
        <div className="rounded-lg bg-[#1a1a1a] border border-[#333] p-6">
          <h3 className="flex items-center gap-2 font-bold text-white mb-4">
            <History className="h-5 w-5 text-blue-500" />
            سجل الترقيات
          </h3>
          <div className="space-y-3">
            {data.tierHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-[#222] rounded-lg border border-[#333]"
              >
                <div className="flex items-center gap-3">
                  {entry.toTier > entry.fromTier ? (
                    <span className="text-green-500">⬆️</span>
                  ) : (
                    <span className="text-red-500">⬇️</span>
                  )}
                  <div>
                    <div className="text-sm font-medium text-white">
                      من {getLabel(entry.fromTier)} إلى {getLabel(entry.toTier)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {entry.reason === 'auto'
                        ? 'ترقية تلقائية'
                        : entry.reason === 'manual'
                          ? 'قرار إداري'
                          : entry.reason === 'admin'
                            ? 'إجراء إداري'
                            : entry.reason}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
