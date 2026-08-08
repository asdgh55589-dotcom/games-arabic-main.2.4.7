'use client'

import { useState, useEffect, useRef } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'

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

export function SettingsPage() {
  const searchParams = useSearchParams()
  const initialSection = (searchParams.get('section') as SettingsSection) || 'profile'
  const { toast } = useToast()
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

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [dailySummary, setDailySummary] = useState(true)

  const [profileVisibility, setProfileVisibility] = useState('everyone')
  const [hideJoinDate, setHideJoinDate] = useState(false)

  useEffect(() => {
    fetch('/api/settings/bootstrap', {
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.profile) {
          const p = data.profile

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

        if (data?.notifications) {
          setEmailNotifications(data.notifications.emailEnabled ?? true)
          setPushNotifications(data.notifications.pushEnabled ?? true)
          setDailySummary(data.notifications.dailySummary ?? true)
        }

        setLoading(false)
      })
      .catch((err) => {
        console.error('[settings bootstrap] failed:', err)
        setLoading(false)
      })
  }, [])

  const refreshProfile = async (username: string) => {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()

    if (data?.profile) {
      setProfile(data.profile)
    }

    return data?.profile || null
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
        .uploadToSignedUrl(signedData.path, signedData.token, avatarFile)

      if (error) {
        throw new Error('avatar_upload_failed')
      }

      avatarUrl = signedData.publicUrl
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
        .uploadToSignedUrl(signedData.path, signedData.token, bannerFile)

      if (error) {
        throw new Error('banner_upload_failed')
      }

      bannerUrl = signedData.publicUrl
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
    resetAssetState()
    setSaved(true)
    toast({ title: message })
    setTimeout(() => setSaved(false), 2000)
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
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
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
      setBannerFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setBannerPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
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
        await finishSaveSuccess(data.profile.username || profile.username, 'تم تحديث الملف الشخصي')

        if (newUsername && newUsername !== profile.username) {
          window.location.href = `/?view=settings`
        }
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
        await finishSaveSuccess(data.profile.username || profile.username, 'تم تحديث إعدادات الخصوصية')
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
        await finishSaveSuccess(data.profile.username || profile.username, 'تم تحديث جميع الإعدادات')

        if (newUsername && newUsername !== profile.username) {
          window.location.href = `/?view=settings`
        }
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
        body: JSON.stringify({ password: newPassword }),
      })
      if (res.ok) {
        toast({ title: 'تم تغيير كلمة المرور' })
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        setPasswordError(data.error || 'فشل التغيير')
      }
    } catch {
      setPasswordError('حدث خطأ أثناء التغيير')
    }
    setChangingPassword(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">يجب تسجيل الدخول أولاً</p>
          <Link href="/?view=login" className="mt-4 inline-block text-sm text-primary hover:underline">تسجيل الدخول</Link>
        </div>
      </div>
    )
  }

  const accent = profile.accentColor || '#ff8c00'
  const displayAvatar = avatarPreview || profile.avatarUrl
  const displayBanner = bannerPreview || profile.bannerUrl

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/?view=profile&user=${encodeURIComponent(profile.username)}`}
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
              className="ml-auto text-xs"
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
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <nav className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-24 space-y-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer ${
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
                {/* Banner */}
                <div className="rounded-xl bg-card border border-border p-6">
                  <h3 className="mb-4 text-sm font-bold">البانر الخلفي</h3>
                  <div className="relative h-[180px] overflow-hidden rounded-xl border border-border">
                    {displayBanner ? (
                      <img src={displayBanner} alt="banner" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-muted/30" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" onClick={() => bannerInputRef.current?.click()}>
                        <Upload className="ml-1.5 h-3.5 w-3.5" /> رفع صورة
                      </Button>
                     {displayBanner && (
                       <Button size="sm" variant="destructive" className="cursor-pointer" onClick={() => { setBannerPreview(null); setBannerFile(null); setBannerRemoved(true); if (bannerInputRef.current) bannerInputRef.current.value = '' }}>
                         <X className="ml-1.5 h-3.5 w-3.5" /> إزالة
                       </Button>
                     )}
                    </div>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">الحجم المقترح: 1500×400 بكسل</p>
                </div>

                {/* Avatar */}
                <div className="rounded-xl bg-card border border-border p-6">
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
                        <Button size="sm" variant="outline" className="border-border cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                          <Upload className="ml-1.5 h-3.5 w-3.5" /> رفع صورة
                        </Button>
                       {displayAvatar && (
                           <Button size="sm" variant="destructive" className="cursor-pointer" onClick={() => { setAvatarPreview(null); setAvatarFile(null); setAvatarRemoved(true); if (avatarInputRef.current) avatarInputRef.current.value = '' }}>
                             <X className="ml-1.5 h-3.5 w-3.5" /> إزالة
                           </Button>
                         )}
                      </div>
                      <p className="text-xs text-muted-foreground">الصورة الرمزية التي تظهر في ملفك الشخصي</p>
                    </div>
                  </div>
                </div>

                 {/* Username */}
                 <div className="rounded-xl bg-card border border-border p-6">
                   <h3 className="mb-4 text-sm font-bold">اسم المستخدم</h3>
                   <div className="space-y-2">
                     <div className="flex items-center justify-between">
                       <Label htmlFor="username" className="text-sm text-muted-foreground">اسم الملف الشخصي</Label>
                       {newUsername !== profile.username && (
                         <Button 
                           size="sm" 
                           variant="ghost" 
                           className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
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
                 <div className="rounded-xl bg-card border border-border p-6">
                   <h3 className="mb-4 text-sm font-bold">اللون المميز</h3>
                   <div className="flex items-center gap-6">
                     <div className="flex items-center gap-3">
                       <input
                         type="color"
                         value={accentColor}
                         onChange={(e) => setAccentColor(e.target.value)}
                         className="h-12 w-12 cursor-pointer rounded-xl border border-border bg-transparent"
                       />
                       <span className="text-sm text-muted-foreground font-mono">{accentColor}</span>
                       <Button 
                         size="sm" 
                         variant="ghost" 
                         className="h-8 px-2 text-xs"
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
                 <div className="rounded-xl bg-card border border-border p-6">
                   <h3 className="mb-4 text-sm font-bold">النبذة الشخصية</h3>
                   <div className="flex items-center justify-between mb-2">
                     <Label htmlFor="bio" className="text-sm text-muted-foreground">أخبر الآخرين عن نفسك</Label>
                     {bio && (
                       <Button 
                         size="sm" 
                         variant="ghost" 
                         className="h-6 px-2 text-xs text-destructive hover:text-destructive"
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
                     className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                     rows={4}
                     placeholder="اكتب نبذة عن نفسك..."
                   />
                   <p className="text-xs text-muted-foreground mt-1">{bio.length}/500</p>
                 </div>

                {/* Social Links */}
                <div className="rounded-xl bg-card border border-border p-6">
                  <h3 className="mb-4 text-sm font-bold">الروابط الاجتماعية</h3>
                   <div className="space-y-4">
                     <SettingsInput label="الموقع الإلكتروني" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://..." id="website" onClear={() => setWebsiteUrl('')} />
                     <SettingsInput label="تويتر / X" value={twitterUrl} onChange={setTwitterUrl} placeholder="https://twitter.com/..." id="twitter" onClear={() => setTwitterUrl('')} />
                     <SettingsInput label="إنستجرام" value={instagramUrl} onChange={setInstagramUrl} placeholder="https://instagram.com/..." id="instagram" onClear={() => setInstagramUrl('')} />
                     <SettingsInput label="تيك توك" value={tiktokUrl} onChange={setTiktokUrl} placeholder="https://tiktok.com/@..." id="tiktok" onClear={() => setTiktokUrl('')} />
                     <SettingsInput label="يوتيوب" value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://youtube.com/..." id="youtube" onClear={() => setYoutubeUrl('')} />
                     <SettingsInput label="GitHub" value={githubUrl} onChange={setGithubUrl} placeholder="https://github.com/..." id="github" onClear={() => setGithubUrl('')} />
                     <SettingsInput label="Discord" value={discordUrl} onChange={setDiscordUrl} placeholder="username#0000" id="discord" onClear={() => setDiscordUrl('')} />
                   </div>
                </div>

                <div className="flex justify-end">
                  <SaveButton onClick={handleSaveProfile} saving={saving} saved={saved} />
                </div>
              </div>
            )}

            {/* ========== Account Section ========== */}
            {activeSection === 'account' && (
              <div className="space-y-6">
                <div className="rounded-xl bg-card border border-border p-6">
                  <h3 className="mb-2 text-sm font-bold">تغيير كلمة المرور</h3>
                  <p className="text-xs text-muted-foreground mb-6">تأكد من استخدام كلمة مرور قوية (6 أحرف على الأقل)</p>
                  <div className="space-y-4 max-w-md">
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
                      disabled={changingPassword || !newPassword || !confirmPassword}
                    >
                      {changingPassword ? (
                        <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري التحديث...</>
                      ) : (
                        'تحديث كلمة المرور'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ========== Notifications Section ========== */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div className="rounded-xl bg-card border border-border p-6">
                  <h3 className="mb-2 text-sm font-bold">تفضيلات الإشعارات</h3>
                  <p className="text-xs text-muted-foreground mb-6">اختر كيفية استلام الإشعارات</p>
                  <div className="space-y-4">
                    <ToggleSetting
                      label="إشعارات البريد الإلكتروني"
                      description="استلام إشعارات عبر البريد عند حدث جديد"
                      checked={emailNotifications}
                      onChange={setEmailNotifications}
                    />
                    <ToggleSetting
                      label="إشعارات الدفع (Push)"
                      description="استلام إشعارات فورية على الجهاز"
                      checked={pushNotifications}
                      onChange={setPushNotifications}
                    />
                    <ToggleSetting
                      label="ملخص يومي"
                      description="استلام ملخص يومي للنشاطات الجديدة"
                      checked={dailySummary}
                      onChange={setDailySummary}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <SaveButton onClick={handleSaveProfile} saving={saving} saved={saved} />
                </div>
              </div>
            )}

            {/* ========== Privacy Section ========== */}
            {activeSection === 'privacy' && (
              <div className="space-y-6">
                <div className="rounded-xl bg-card border border-border p-6">
                  <h3 className="mb-2 text-sm font-bold">إعدادات الخصوصية</h3>
                  <p className="text-xs text-muted-foreground mb-6">تحكم في من يمكنه رؤية معلومات ملفك الشخصي</p>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="visibility" className="text-sm text-muted-foreground">من يرى ملفك الشخصي</Label>
                      <select
                        id="visibility"
                        value={profileVisibility}
                        onChange={(e) => setProfileVisibility(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background p-2.5 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
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
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-accent/30 transition-colors">
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
          ? 'bg-green-600 text-white hover:bg-green-700'
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
