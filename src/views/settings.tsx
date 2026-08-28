'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight, User, Lock, Bell, Eye,
  Loader2, Save, Upload, X, Camera, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { CropModal } from '@/components/crop-modal'
import { ImageUpload } from '@/components/admin/image-upload'
import { SOCIAL_PLATFORMS, PLATFORM_KEYS } from '@/lib/social-platforms'
import { NotificationSettings } from '@/views/notification-settings'

interface ProfileData {
  id: string
  username: string
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
  profileVisibility: string
  hideJoinDate: boolean
  role: string
}

type SettingsSection = 'profile' | 'account' | 'notifications' | 'privacy'

const SECTIONS: { key: SettingsSection; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'profile', label: 'تخصيص الملف الشخصي', icon: <User className="h-4 w-4" />, description: 'صورتك وبياناتك العامة' },
  { key: 'account', label: 'الحساب', icon: <Lock className="h-4 w-4" />, description: 'كلمة المرور والأمان' },
  { key: 'notifications', label: 'الإشعارات', icon: <Bell className="h-4 w-4" />, description: 'تفضيلات الإشعارات' },
  { key: 'privacy', label: 'الخصوصية', icon: <Eye className="h-4 w-4" />, description: 'من يرى ملفك الشخصي' },
]

const PROVIDER_INFO: Record<string, { name: string; icon: string; color: string }> = {
  google: { name: 'Google', icon: '🌐', color: '#4285f4' },
  discord: { name: 'Discord', icon: '💬', color: '#5865f2' },
  telegram: { name: 'Telegram', icon: '📱', color: '#0088cc' },
}

export function SettingsPage() {
  const searchParams = useSearchParams()
  const initialSection = (searchParams.get('section') as SettingsSection) || 'profile'
  const { toast } = useToast()
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth()
  useDocumentTitle('إدارة الحساب والإعدادات')

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection)
  const [debugMode, setDebugMode] = useState(false)

   const [bio, setBio] = useState('')
   const [socialLinks, setSocialLinks] = useState<Record<string, string>>({})
  const [newUsername, setNewUsername] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [accentColor, setAccentColor] = useState('#ff8c00')

   const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
   const [bannerPreview, setBannerPreview] = useState<string | null>(null)
   const [avatarFile, setAvatarFile] = useState<File | null>(null)
   const [bannerFile, setBannerFile] = useState<File | null>(null)
   const [avatarRemoved, setAvatarRemoved] = useState(false)
   const [bannerRemoved, setBannerRemoved] = useState(false)
   const avatarInputRef = useRef<HTMLInputElement>(null)
   const bannerInputRef = useRef<HTMLInputElement>(null)

   const [cropModalOpen, setCropModalOpen] = useState(false)
   const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
   const [cropType, setCropType] = useState<'avatar' | 'banner'>('avatar')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [dailySummary, setDailySummary] = useState(true)

  const [profileVisibility, setProfileVisibility] = useState('everyone')
  const [hideJoinDate, setHideJoinDate] = useState(false)

  const [linkedAccounts, setLinkedAccounts] = useState<Array<{
    id: string
    provider: string
    providerEmail: string | null
    providerUsername: string | null
    avatarUrl: string | null
    createdAt: string
  }>>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  const isDirty = useMemo(() => {
    if (!profile) return false
    return (
      bio !== (profile.bio || '') ||
      newUsername !== (profile.username || '') ||
      websiteUrl !== (profile.websiteUrl || '') ||
      twitterUrl !== (profile.twitterUrl || '') ||
      instagramUrl !== (profile.instagramUrl || '') ||
      tiktokUrl !== (profile.tiktokUrl || '') ||
      youtubeUrl !== (profile.youtubeUrl || '') ||
      githubUrl !== (profile.githubUrl || '') ||
      discordUrl !== (profile.discordUrl || '') ||
      accentColor !== (profile.accentColor || '#ff8c00') ||
      profileVisibility !== (profile.profileVisibility || 'everyone') ||
      hideJoinDate !== !!profile.hideJoinDate ||
      !!avatarFile || !!bannerFile || avatarRemoved || bannerRemoved
    )
  }, [profile, bio, newUsername, websiteUrl, twitterUrl, instagramUrl, tiktokUrl, youtubeUrl, githubUrl, discordUrl, accentColor, profileVisibility, hideJoinDate, avatarFile, bannerFile, avatarRemoved, bannerRemoved])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleSectionChange = (key: SettingsSection) => {
    if (isDirty && !confirm('لديك تغييرات غير محفوظة، هل تريد المتابعة دون حفظ؟')) return
    setActiveSection(key)
  }

  useEffect(() => {
    fetch('/api/settings/bootstrap', {
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const payload = data?.data
        if (payload?.profile) {
          const p = payload.profile

          setProfile(p)
          setBio(p.bio || '')
          setNewUsername(p.username || '')
          setWebsiteUrl(p.websiteUrl || '')
          setTwitterUrl(p.twitterUrl || '')
          setInstagramUrl(p.instagramUrl || '')
          setTiktokUrl(p.tiktokUrl || '')
          setYoutubeUrl(p.youtubeUrl || '')
          setGithubUrl(p.githubUrl || '')
          setDiscordUrl(p.discordUrl || '')
          setAccentColor(p.accentColor || '#ff8c00')
          setProfileVisibility(p.profileVisibility || 'everyone')
          setHideJoinDate(p.hideJoinDate || false)
        }

        if (payload?.notifications) {
          setEmailNotifications(payload.notifications.emailEnabled ?? true)
          setPushNotifications(payload.notifications.pushEnabled ?? true)
          setDailySummary(payload.notifications.dailySummary ?? true)
        }

        setLoading(false)
      })
      .catch((err) => {
        console.error('[settings bootstrap] failed:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const fetchLinkedAccounts = async () => {
      try {
        const res = await fetch('/api/settings/linked-accounts')
        if (res.ok) {
          const data = await res.json()
          setLinkedAccounts(data.accounts || [])
        }
      } catch {
        // silent
      } finally {
        setLoadingAccounts(false)
      }
    }
    if (user) fetchLinkedAccounts()
  }, [user])

  const refreshProfile = async (username: string) => {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()

    if (data?.data?.profile) {
      setProfile(data.data.profile)
    }

    return data?.data?.profile || null
  }

  const clearAssetState = () => {
    setAvatarPreview(null)
    setBannerPreview(null)
    setAvatarFile(null)
    setBannerFile(null)
    setAvatarRemoved(false)
    setBannerRemoved(false)
  }

  const saveNotificationSettings = async () => {
    return fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailEnabled: emailNotifications,
        pushEnabled: pushNotifications,
        dailySummary,
      }),
    })
  }

  const saveProfileSettings = async (payload: Record<string, unknown>) => {
    if (!profile) {
      throw new Error('missing_profile')
    }

    return fetch(`/api/users/${encodeURIComponent(profile.username)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const uploadProfileAssets = async () => {
    if (!profile) {
      return { avatarUrl: undefined, bannerUrl: undefined }
    }

    let avatarUrl: string | null | undefined = undefined

    if (avatarFile) {
      const extension = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'

      const signedRes = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'avatars',
          extension,
        }),
      })

      if (!signedRes.ok) {
        throw new Error('avatar_upload_failed')
      }

      const signedData = await signedRes.json()

      const supabase = createSupabaseBrowserClient()

      const { error } = await supabase.storage
        .from('avatars')
        .uploadToSignedUrl(signedData.data.path, signedData.data.token, avatarFile)

      if (error) {
        throw new Error('avatar_upload_failed')
      }

      avatarUrl = signedData.data.publicUrl
    } else if (avatarPreview && typeof avatarPreview === 'string' && avatarPreview.startsWith('http') && avatarPreview !== profile.avatarUrl) {
      // ImageUpload already uploaded to Supabase and returned public URL
      avatarUrl = avatarPreview
    } else if (avatarRemoved) {
      avatarUrl = null
    }

    let bannerUrl: string | null | undefined = undefined

    if (bannerFile) {
      const extension = bannerFile.name.split('.').pop()?.toLowerCase() || 'jpg'

      const signedRes = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'banners',
          extension,
        }),
      })

      if (!signedRes.ok) {
        throw new Error('banner_upload_failed')
      }

      const signedData = await signedRes.json()

      const supabase = createSupabaseBrowserClient()

      const { error } = await supabase.storage
        .from('banners')
        .uploadToSignedUrl(signedData.data.path, signedData.data.token, bannerFile)

      if (error) {
        throw new Error('banner_upload_failed')
      }

      bannerUrl = signedData.data.publicUrl
    } else if (bannerPreview && typeof bannerPreview === 'string' && bannerPreview.startsWith('http') && bannerPreview !== profile.bannerUrl) {
      bannerUrl = bannerPreview
    } else if (bannerRemoved) {
      bannerUrl = null
    }

    return { avatarUrl, bannerUrl }
  }

  const resetAssetState = () => {
    setAvatarPreview(null)
    setBannerPreview(null)
    setAvatarFile(null)
    setBannerFile(null)
    setAvatarRemoved(false)
    setBannerRemoved(false)
  }

  const finishSaveSuccess = async (username: string, message: string) => {
    await refreshProfile(username)
    await refreshAuth()
    resetAssetState()
    setSaved(true)
    toast({ title: message })
    setTimeout(() => setSaved(false), 2000)

    // إذا تغير اسم المستخدم، حدّث الـ URL فوراً لتجنب stale session
    if (profile && username !== profile.username) {
      // استخدم encodeURIComponent لدعم الأسماء العربية والمسافات
      window.location.href = `/profile/${encodeURIComponent(username)}`
    }
  }

  const ensureUsernameAvailable = async () => {
    if (!profile || !newUsername || newUsername === profile.username) {
      return true
    }

    const checkRes = await fetch(`/api/users/${encodeURIComponent(newUsername)}/profile`)

    if (checkRes.ok) {
      toast({ title: 'اسم المستخدم مستخدم بالفعل', variant: 'destructive' })
      return false
    }

    return true
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 5 ميجابايت', variant: 'destructive' })
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        setCropImageSrc(ev.target?.result as string)
        setCropType('avatar')
        setCropModalOpen(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 10 ميجابايت', variant: 'destructive' })
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        setCropImageSrc(ev.target?.result as string)
        setCropType('banner')
        setCropModalOpen(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarCropComplete = (croppedFile: File) => {
    setAvatarFile(croppedFile)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(croppedFile)
  }

  const handleBannerCropComplete = (croppedFile: File) => {
    setBannerFile(croppedFile)
    const reader = new FileReader()
    reader.onload = (ev) => setBannerPreview(ev.target?.result as string)
    reader.readAsDataURL(croppedFile)
  }

  const handleSaveProfileOnly = async () => {
    if (!profile) return
    console.log('[Settings] Saving profile only')
    setSaving(true)
    setSaved(false)
    try {
      const usernameAvailable = await ensureUsernameAvailable()

      if (!usernameAvailable) {
        setSaving(false)
        return
      }

      const { avatarUrl, bannerUrl } = await uploadProfileAssets()

      const profileRes = await fetch(`/api/users/${encodeURIComponent(profile.username)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio,
          username: newUsername !== profile.username ? newUsername : undefined,
          websiteUrl, twitterUrl, instagramUrl, tiktokUrl, youtubeUrl, githubUrl, discordUrl,
          accentColor,
          avatarUrl,
          bannerUrl,
          profileVisibility,
          hideJoinDate,
        }),
      })

      console.log('[Settings] Profile save response:', { status: profileRes.status, ok: profileRes.ok })

      if (profileRes.ok) {
        const data = await profileRes.json()
        await finishSaveSuccess(data.data?.profile?.username || profile.username, 'تم تحديث الملف الشخصي')
      } else {
        toast({ title: 'خطأ', description: 'فشل حفظ الملف الشخصي', variant: 'destructive' })
      }
    } catch (err: any) {
      if (err?.message === 'avatar_upload_failed') {
        toast({ title: 'خطأ', description: 'فشل رفع الصورة الرمزية', variant: 'destructive' })
      } else if (err?.message === 'banner_upload_failed') {
        toast({ title: 'خطأ', description: 'فشل رفع البانر', variant: 'destructive' })
      } else {
        toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
      }
    }
    setSaving(false)
  }

  const handleSaveNotificationsOnly = async () => {
    if (!profile) return
    console.log('[Settings] Saving notifications only')
    setSaving(true)
    setSaved(false)
    try {
      const notifRes = await saveNotificationSettings()

      console.log('[Settings] Notifications save response:', { status: notifRes.status, ok: notifRes.ok })

      if (notifRes.ok) {
        setSaved(true)
        toast({ title: 'تم تحديث إعدادات الإشعارات' })
        setTimeout(() => setSaved(false), 2000)
      } else {
        toast({ title: 'خطأ', description: 'فشل حفظ إعدادات الإشعارات', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleSavePrivacyOnly = async () => {
    if (!profile) return
    console.log('[Settings] Saving privacy only')
    setSaving(true)
    setSaved(false)
    try {
      const profileRes = await saveProfileSettings({
        profileVisibility,
        hideJoinDate,
      })

      console.log('[Settings] Privacy save response:', { status: profileRes.status, ok: profileRes.ok })

      if (profileRes.ok) {
        const data = await profileRes.json()
        await finishSaveSuccess(data.data?.profile?.username || profile.username, 'تم تحديث إعدادات الخصوصية')
      } else {
        toast({ title: 'خطأ', description: 'فشل حفظ إعدادات الخصوصية', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    console.log('[Settings] Starting save profile', { 
      newUsername, 
      bio: bio.substring(0, 50), 
      emailNotifications, 
      pushNotifications, 
      dailySummary,
      avatarRemoved,
      bannerRemoved
    })
    setSaving(true)
    setSaved(false)
    try {
      const usernameAvailable = await ensureUsernameAvailable()

      if (!usernameAvailable) {
        setSaving(false)
        return
      }

      const { avatarUrl, bannerUrl } = await uploadProfileAssets()

      const [profileRes, notifRes] = await Promise.all([
        fetch(`/api/users/${encodeURIComponent(profile.username)}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bio,
            username: newUsername !== profile.username ? newUsername : undefined,
            websiteUrl, twitterUrl, instagramUrl, tiktokUrl, youtubeUrl, githubUrl, discordUrl,
            accentColor,
            avatarUrl,
            bannerUrl,
            profileVisibility,
            hideJoinDate,
          }),
        }),
        fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            emailEnabled: emailNotifications, 
            pushEnabled: pushNotifications, 
            dailySummary 
          }),
        }),
      ])
      
      console.log('[Settings] Save responses:', { 
        profileStatus: profileRes.status, 
        profileOk: profileRes.ok,
        notifStatus: notifRes.status,
        notifOk: notifRes.ok
      })
      
      const profileOk = profileRes.ok
      const notifOk = notifRes.ok
      
      if (profileOk && notifOk) {
        const data = await profileRes.json()
        await finishSaveSuccess(data.data?.profile?.username || profile.username, 'تم تحديث جميع الإعدادات')
      } else {
        let errorMsg = 'لم يتم الحفظ'
        if (!profileOk && !notifOk) {
          errorMsg = 'فشل حفظ الملف الشخصي وإعدادات الإشعارات'
        } else if (!profileOk) {
          errorMsg = 'فشل حفظ الملف الشخصي'
        } else if (!notifOk) {
          errorMsg = 'فشل حفظ إعدادات الإشعارات'
        }
        toast({ title: 'خطأ', description: errorMsg, variant: 'destructive' })
      }
    } catch (err: any) {
      if (err?.message === 'avatar_upload_failed') {
        toast({ title: 'خطأ', description: 'فشل رفع الصورة الرمزية', variant: 'destructive' })
      } else if (err?.message === 'banner_upload_failed') {
        toast({ title: 'خطأ', description: 'فشل رفع البانر', variant: 'destructive' })
      } else {
        toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
      }
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    if (!currentPassword) {
      setPasswordError('كلمة المرور الحالية مطلوبة')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('يجب أن تكون كلمة المرور 6 أحرف على الأقل')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمتا المرور غير متطابقتين')
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, currentPassword }),
      })
      if (res.ok) {
        toast({ title: 'تم تغيير كلمة المرور بنجاح' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        const msg = data?.error?.message || data?.error || ''
        if (msg.includes('Current password') || msg.includes('غير صحيحة')) {
          setPasswordError('كلمة المرور الحالية غير صحيحة')
        } else {
          setPasswordError(msg || 'فشل التغيير')
        }
      }
    } catch {
      setPasswordError('حدث خطأ أثناء التغيير، تحقق من الاتصال')
    }
    setChangingPassword(false)
  }

  const handleUnlink = async (accountId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء ربط هذا الحساب؟')) return
    
    try {
      const res = await fetch('/api/settings/unlink-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      
      if (res.ok) {
        setLinkedAccounts(prev => prev.filter(a => a.id !== accountId))
        toast({ title: 'تم إلغاء الربط بنجاح' })
      } else {
        const data = await res.json()
        toast({ title: data.error || 'حدث خطأ', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ أثناء إلغاء الربط', variant: 'destructive' })
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">يجب تسجيل الدخول أولاً</p>
          <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">تسجيل الدخول</Link>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const accent = profile.accentColor || '#ff8c00'
  const displayAvatar = avatarRemoved ? null : (avatarPreview || profile.avatarUrl)
  const displayBanner = bannerRemoved ? null : (bannerPreview || profile.bannerUrl)

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${encodeURIComponent(profile.username)}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold">إدارة الحساب والإعدادات</h1>
              <p className="text-xs text-muted-foreground">تخصيص ملفك الشخصي وإعدادات حسابك</p>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              className="ml-auto text-xs min-h-[44px]"
              onClick={() => setDebugMode(!debugMode)}
            >
              {debugMode ? 'إيقاف Debug' : 'Debug'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 lg:px-6 py-6">
        {debugMode && (
          <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-yellow-800 dark:text-yellow-300">DEBUG MODE</span>
              <button 
                onClick={() => setDebugMode(false)}
                className="text-yellow-800 dark:text-yellow-300 hover:underline"
              >
                إخفاء
              </button>
            </div>
            <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify({
                username: newUsername,
                bio: bio.substring(0, 100),
                emailNotifications,
                pushNotifications,
                dailySummary,
                profileVisibility,
                hideJoinDate,
                avatarRemoved,
                bannerRemoved
              }, null, 2)}
            </pre>
          </div>
        )}
        {profile?.role === 'member' && (
          <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold flex items-center gap-2 text-base">🎨 كن معرّباً</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    انضم لفريق المُعَرِّبين وشارك تعريباتك مع المجتمع
                  </p>
                </div>
                <Link href="/become-creator">
                  <Button className="min-h-[44px]">ابدأ الآن</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <nav className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-24 space-y-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.key}
                  onClick={() => handleSectionChange(section.key)}
                  className={`flex w-full items-center gap-3 rounded-none px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    activeSection === section.key
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    activeSection === section.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {section.icon}
                  </div>
                  <div className="text-right">
                    <div>{section.label}</div>
                    <div className="text-[10px] text-muted-foreground/70">{section.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {/* ========== Profile Section ========== */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                {/* Banner — مع ImageUpload الجديد */}
                <div className="rounded-none bg-card border-2 border-border p-6">
                  <h3 className="mb-4 text-sm font-bold">البانر الخلفي</h3>
                  <div className="relative h-[180px] overflow-hidden rounded-none border-2 border-border">
                    {displayBanner ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayBanner} alt="banner" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-muted/30" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[44px]" onClick={() => bannerInputRef.current?.click()}>
                        <Upload className="ml-1.5 h-3.5 w-3.5" /> رفع وقص
                      </Button>
                     {displayBanner && (
                        <Button size="sm" variant="destructive" className="cursor-pointer min-h-[44px]" onClick={() => { setBannerPreview(null); setBannerFile(null); setBannerRemoved(true); if (bannerInputRef.current) bannerInputRef.current.value = '' }}>
                          <X className="ml-1.5 h-3.5 w-3.5" /> إزالة
                        </Button>
                      )}
                    </div>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">الحجم المقترح: 1500×400 بكسل</p>
                  <div className="mt-4">
                    <ImageUpload
                      bucket="banners"
                      value={displayBanner || ''}
                      onChange={(url) => {
                        // ImageUpload يرفع مباشرة ويعيد publicUrl — نستخدمه كـ preview ونحتفظ به للحفظ
                        setBannerPreview(url)
                        setBannerFile(null)
                        setBannerRemoved(false)
                      }}
                      label="أو اسحب بانر جديد هنا (سحب وإفلات)"
                      hint="أعلى جودة — سيتم حفظ الرابط تلقائياً عند الضغط على حفظ"
                      folder="banners"
                    />
                  </div>
                </div>

                {/* Avatar */}
                <div className="rounded-none bg-card border-2 border-border p-6">
                  <h3 className="mb-4 text-sm font-bold">الصورة الرمزية</h3>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24 border-4" style={{ borderColor: accent, boxShadow: `0 0 20px ${accent}33` }}>
                        <AvatarImage src={displayAvatar || undefined} />
                        <AvatarFallback className="text-3xl font-bold" style={{ backgroundColor: accent + '33', color: accent }}>
                          {profile.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute bottom-0 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-border cursor-pointer min-h-[44px]" onClick={() => avatarInputRef.current?.click()}>
                          <Upload className="ml-1.5 h-3.5 w-3.5" /> رفع وقص
                        </Button>
                       {displayAvatar && (
                           <Button size="sm" variant="destructive" className="cursor-pointer min-h-[44px]" onClick={() => { setAvatarPreview(null); setAvatarFile(null); setAvatarRemoved(true); if (avatarInputRef.current) avatarInputRef.current.value = '' }}>
                             <X className="ml-1.5 h-3.5 w-3.5" /> إزالة
                           </Button>
                         )}
                      </div>
                      <p className="text-xs text-muted-foreground">الصورة الرمزية التي تظهر في ملفك الشخصي</p>
                      <div className="mt-3">
                        <ImageUpload
                          bucket="avatars"
                          value={displayAvatar || ''}
                          onChange={(url) => {
                            setAvatarPreview(url)
                            setAvatarFile(null)
                            setAvatarRemoved(false)
                          }}
                          label="أو اسحب صورة جديدة هنا (سحب وإفلات)"
                          hint="أعلى جودة — سيتم الحفظ تلقائياً"
                          folder="avatars"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                 {/* Username */}
                 <div className="rounded-none bg-card border-2 border-border p-6">
                   <h3 className="mb-4 text-sm font-bold">اسم المستخدم</h3>
                   <div className="space-y-2">
                     <div className="flex items-center justify-between">
                       <Label htmlFor="username" className="text-sm text-muted-foreground">اسم الملف الشخصي</Label>
                       {newUsername !== profile.username && (
                         <Button 
                           size="sm" 
                           variant="ghost" 
                           className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
                           onClick={() => setNewUsername(profile.username || '')}
                         >
                           تراجع
                         </Button>
                       )}
                     </div>
                     <Input
                       id="username"
                       value={newUsername}
                       onChange={(e) => setNewUsername(e.target.value)}
                       className="bg-background border-border"
                       placeholder="اسم المستخدم"
                     />
                     <p className="text-xs text-muted-foreground">سيتم تحويلك للصفحة الجديدة بعد الحفظ</p>
                   </div>
                 </div>

                 {/* Accent Color */}
                  <div className="rounded-none bg-card border-2 border-border p-6">
                   <h3 className="mb-4 text-sm font-bold">اللون المميز</h3>
                   <div className="flex items-center gap-6">
                     <div className="flex items-center gap-3">
                       <input
                         type="color"
                         value={accentColor}
                         onChange={(e) => setAccentColor(e.target.value)}
                          className="h-12 w-12 cursor-pointer rounded-none border-2 border-border bg-transparent"
                       />
                       <span className="text-sm text-muted-foreground font-mono">{accentColor}</span>
                       <Button 
                         size="sm" 
                         variant="ghost" 
                         className="h-8 px-2 text-xs min-h-[44px]"
                         onClick={() => setAccentColor('#ff8c00')}
                       >
                         افتراضي
                       </Button>
                     </div>
                     <div className="flex items-center gap-4">
                       <Avatar className="h-16 w-16 border-3" style={{ borderColor: accentColor, boxShadow: `0 0 15px ${accentColor}55` }}>
                         <AvatarImage src={displayAvatar || undefined} />
                         <AvatarFallback className="text-xl font-bold" style={{ backgroundColor: accentColor + '33', color: accentColor }}>
                           {profile.username[0]?.toUpperCase()}
                         </AvatarFallback>
                       </Avatar>
                       <div>
                         <p className="text-xs text-muted-foreground">معاينة الهالة</p>
                         <p className="text-xs text-muted-foreground/70">اللون يظهر حول الأفاتار</p>
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Bio */}
                  <div className="rounded-none bg-card border-2 border-border p-6">
                   <h3 className="mb-4 text-sm font-bold">النبذة الشخصية</h3>
                   <div className="flex items-center justify-between mb-2">
                     <Label htmlFor="bio" className="text-sm text-muted-foreground">أخبر الآخرين عن نفسك</Label>
                     {bio && (
                       <Button 
                         size="sm" 
                         variant="ghost" 
                         className="h-6 px-2 text-xs text-destructive hover:text-destructive min-h-[44px]"
                         onClick={() => setBio('')}
                       >
                         مسح
                       </Button>
                     )}
                   </div>
                   <textarea
                     id="bio"
                     value={bio}
                     onChange={(e) => setBio(e.target.value.substring(0, 500))}
                      className="mt-2 w-full rounded-none border-2 border-border bg-background p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                     rows={4}
                     placeholder="اكتب نبذة عن نفسك..."
                   />
                   <p className="text-xs text-muted-foreground mt-1">{bio.length}/500</p>
                 </div>

                {/* Social Links */}
                <div className="rounded-none bg-card border-2 border-border p-6">
                   <h3 className="mb-4 text-sm font-bold">الروابط الاجتماعية</h3>
                   <SocialLinksEditor
                     websiteUrl={websiteUrl}
                     twitterUrl={twitterUrl}
                     instagramUrl={instagramUrl}
                     tiktokUrl={tiktokUrl}
                     youtubeUrl={youtubeUrl}
                     githubUrl={githubUrl}
                     discordUrl={discordUrl}
                     onWebsiteUrlChange={setWebsiteUrl}
                     onTwitterUrlChange={setTwitterUrl}
                     onInstagramUrlChange={setInstagramUrl}
                     onTiktokUrlChange={setTiktokUrl}
                     onYoutubeUrlChange={setYoutubeUrl}
                     onGithubUrlChange={setGithubUrl}
                     onDiscordUrlChange={setDiscordUrl}
                   />
                </div>

                <div className="flex justify-end">
                  <SaveButton onClick={handleSaveProfile} saving={saving} saved={saved} />
                </div>
              </div>
            )}

            {/* ========== Account Section ========== */}
            {activeSection === 'account' && (
              <div className="space-y-6">
                <div className="rounded-none bg-card border-2 border-border p-6">
                  <h3 className="mb-2 text-sm font-bold">تغيير كلمة المرور</h3>
                  <p className="text-xs text-muted-foreground mb-6">تأكد من استخدام كلمة مرور قوية (6 أحرف على الأقل)</p>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="current-password" className="text-sm text-muted-foreground">كلمة المرور الحالية *</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError('') }}
                        className="bg-background border-border"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-sm text-muted-foreground">كلمة المرور الجديدة</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
                        className="bg-background border-border"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">تأكيد كلمة المرور</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
                        className="bg-background border-border"
                        placeholder="••••••••"
                      />
                    </div>
                    {passwordError && (
                      <p className="text-xs text-destructive">{passwordError}</p>
                    )}
                    <Button
                      variant="outline"
                      className="border-border cursor-pointer"
                      onClick={handleChangePassword}
                      disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {changingPassword ? (
                        <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري التحديث...</>
                      ) : (
                        'تحديث كلمة المرور'
                      )}
                    </Button>
                  </div>
                </div>
                <div className="rounded-none bg-card border-2 border-border p-6">
                  <h3 className="mb-2 text-sm font-bold">الحسابات المرتبطة</h3>
                  <p className="text-xs text-muted-foreground mb-6">إدارة حسابات OAuth المرتبطة بحسابك</p>
                  {loadingAccounts ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs">جاري التحميل...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {linkedAccounts.map((account) => {
                        const info = PROVIDER_INFO[account.provider] || { name: account.provider, icon: '🔗', color: '#666' }
                        return (
                          <div key={account.id} className="flex items-center justify-between gap-4 p-3 rounded-none hover:bg-accent/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xl" style={{ backgroundColor: info.color + '20' }}>
                                {info.icon}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{info.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {account.providerEmail || account.providerUsername || 'غير محدد'}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-border text-xs cursor-pointer min-h-[44px]"
                              onClick={() => handleUnlink(account.id)}
                              disabled={linkedAccounts.length <= 1}
                              title={linkedAccounts.length <= 1 ? 'لا يمكن إلغاء ربط الحساب الأخير' : ''}
                            >
                              إلغاء الربط
                            </Button>
                          </div>
                        )
                      })}
                      {linkedAccounts.length === 0 && (
                        <p className="text-xs text-muted-foreground">لم تقم بربط أي حسابات بعد</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== Notifications Section ========== */}
            {activeSection === 'notifications' && (
              <NotificationSettings />
            )}

            {/* ========== Privacy Section ========== */}
            {activeSection === 'privacy' && (
              <div className="space-y-6">
                <div className="rounded-none bg-card border-2 border-border p-6">
                  <h3 className="mb-2 text-sm font-bold">إعدادات الخصوصية</h3>
                  <p className="text-xs text-muted-foreground mb-6">تحكم في من يمكنه رؤية معلومات ملفك الشخصي</p>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="visibility" className="text-sm text-muted-foreground">من يرى ملفك الشخصي</Label>
                      <select
                        id="visibility"
                        value={profileVisibility}
                        onChange={(e) => setProfileVisibility(e.target.value)}
                        className="w-full rounded-none border-2 border-border bg-background p-2.5 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="everyone">الجميع</option>
                        <option value="followers">المتابعين فقط</option>
                        <option value="nobody">لا أحد</option>
                      </select>
                    </div>
                    <ToggleSetting
                      label="إخفاء تاريخ الانضمام"
                      description="إخفاء تاريخ انضمامك للمنصة من الزوار"
                      checked={hideJoinDate}
                      onChange={setHideJoinDate}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <SaveButton onClick={handleSaveProfile} saving={saving} saved={saved} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <CropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false)
          setCropImageSrc(null)
          if (avatarInputRef.current) avatarInputRef.current.value = ''
          if (bannerInputRef.current) bannerInputRef.current.value = ''
        }}
        onCropComplete={cropType === 'avatar' ? handleAvatarCropComplete : handleBannerCropComplete}
        imageSrc={cropImageSrc || ''}
        aspectRatio={cropType === 'avatar' ? 1 : 3.75}
        cropShape={cropType === 'avatar' ? 'round' : 'rect'}
        title={cropType === 'avatar' ? 'قص الصورة الرمزية' : 'قص البانر'}
      />
    </div>
  )
}

// ========== Reusable Components ==========

function SettingsInput({ label, value, onChange, placeholder, id, type = 'text', onClear }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  id: string
  type?: string
  onClear?: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm text-muted-foreground">{label}</Label>
        {value && onClear && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 px-2 text-xs text-destructive hover:text-destructive min-h-[44px]"
            onClick={onClear}
          >
            مسح
          </Button>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background border-border"
        placeholder={placeholder}
      />
    </div>
  )
}

function ToggleSetting({ label, description, checked, onChange }: {
  label: string
  description?: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-none hover:bg-accent/30 transition-colors">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  )
}

function SaveButton({ onClick, saving, saved }: {
  onClick: () => void
  saving: boolean
  saved: boolean
}) {
  return (
    <Button
      onClick={onClick}
      disabled={saving}
      className={`cursor-pointer transition-all duration-200 ${
        saved
          ? 'bg-status-new text-status-new-foreground hover:bg-status-new/90'
          : 'bg-primary text-primary-foreground hover:bg-primary/90'
      }`}
    >
      {saving ? (
        <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...</>
      ) : saved ? (
        <><Check className="ml-2 h-4 w-4" /> تم الحفظ</>
      ) : (
        <><Save className="ml-2 h-4 w-4" /> حفظ التغييرات</>
      )}
    </Button>
  )
}

interface SocialLinksEditorProps {
  websiteUrl: string
  twitterUrl: string
  instagramUrl: string
  tiktokUrl: string
  youtubeUrl: string
  githubUrl: string
  discordUrl: string
  onWebsiteUrlChange: (value: string) => void
  onTwitterUrlChange: (value: string) => void
  onInstagramUrlChange: (value: string) => void
  onTiktokUrlChange: (value: string) => void
  onYoutubeUrlChange: (value: string) => void
  onGithubUrlChange: (value: string) => void
  onDiscordUrlChange: (value: string) => void
}

function SocialLinksEditor({
  websiteUrl,
  twitterUrl,
  instagramUrl,
  tiktokUrl,
  youtubeUrl,
  githubUrl,
  discordUrl,
  onWebsiteUrlChange,
  onTwitterUrlChange,
  onInstagramUrlChange,
  onTiktokUrlChange,
  onYoutubeUrlChange,
  onGithubUrlChange,
  onDiscordUrlChange,
}: SocialLinksEditorProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const urlMap: Record<string, { value: string; onChange: (v: string) => void }> = {
    websiteUrl: { value: websiteUrl, onChange: onWebsiteUrlChange },
    twitterUrl: { value: twitterUrl, onChange: onTwitterUrlChange },
    instagramUrl: { value: instagramUrl, onChange: onInstagramUrlChange },
    tiktokUrl: { value: tiktokUrl, onChange: onTiktokUrlChange },
    youtubeUrl: { value: youtubeUrl, onChange: onYoutubeUrlChange },
    githubUrl: { value: githubUrl, onChange: onGithubUrlChange },
    discordUrl: { value: discordUrl, onChange: onDiscordUrlChange },
  }

  const activePlatforms = PLATFORM_KEYS.filter(
    (key) => urlMap[SOCIAL_PLATFORMS[key].column]?.value
  )

  const availablePlatforms = PLATFORM_KEYS.filter(
    (key) => !urlMap[SOCIAL_PLATFORMS[key].column]?.value
  )

  const handleAddPlatform = (key: string) => {
    const platform = SOCIAL_PLATFORMS[key]
    const entry = urlMap[platform.column]
    if (entry) {
      entry.onChange('')
    }
    setShowDropdown(false)
  }

  const handleRemovePlatform = (key: string) => {
    const platform = SOCIAL_PLATFORMS[key]
    const entry = urlMap[platform.column]
    if (entry) {
      entry.onChange('')
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-3">
      {activePlatforms.length === 0 && (
        <p className="text-xs text-muted-foreground">لم تضف أي روابط اجتماعية بعد</p>
      )}

      {activePlatforms.map((key) => {
        const platform = SOCIAL_PLATFORMS[key]
        const entry = urlMap[platform.column]
        const Icon = platform.icon

        return (
          <div key={key} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">{platform.label}</p>
              <Input
                value={entry?.value || ''}
                onChange={(e) => entry?.onChange(e.target.value)}
                placeholder={platform.placeholder}
                className="h-9 text-xs bg-background border-border"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0 min-h-[44px]"
              onClick={() => handleRemovePlatform(key)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      })}

      {availablePlatforms.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border text-xs gap-1.5 min-h-[44px]"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span className="text-lg leading-none">+</span>
            إضافة رابط اجتماعي
          </Button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
              {availablePlatforms.map((key) => {
                const platform = SOCIAL_PLATFORMS[key]
                const Icon = platform.icon

                return (
                  <button
                    key={key}
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-right"
                    onClick={() => handleAddPlatform(key)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{platform.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
