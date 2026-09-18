'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  BarChart3,
  Bell,
  Camera,
  Check,
  ChevronLeft,
  Eye,
  Loader2,
  Lock,
  Save,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { ImageUpload } from '@/components/admin/image-upload'
import { CropModal } from '@/components/crop-modal'
import { SetupPasswordCard } from '@/components/settings/setup-password-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'
import { needsSecuritySetup } from '@/lib/onboarding'
import { getImageDimensions, checkImageDimensions } from '@/lib/image-dims'
import { ProfileUpdateSchema, SettingsPasswordSchema } from '@/lib/schemas'
import { PLATFORM_KEYS, SOCIAL_PLATFORMS } from '@/lib/social-platforms'
import { NotificationSettings } from '@/views/notification-settings'
import { SimpleNotificationSettings } from '@/views/simple-notification-settings'

type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>
type SettingsPasswordInput = z.infer<typeof SettingsPasswordSchema>

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
  accentColor: string | null
  profileVisibility: string
  hideJoinDate: boolean
  role: string
}

type SettingsSection = 'profile' | 'account' | 'notifications' | 'privacy' | 'translation'

const SECTIONS: {
  key: SettingsSection
  label: string
  icon: React.ReactNode
  description: string
}[] = [
  {
    key: 'profile',
    label: 'تخصيص الملف الشخصي',
    icon: <User className="h-[18px] w-[18px]" />,
    description: 'صورتك وبياناتك العامة',
  },
  {
    key: 'account',
    label: 'الحساب',
    icon: <Lock className="h-[18px] w-[18px]" />,
    description: 'كلمة المرور والأمان',
  },
  {
    key: 'notifications',
    label: 'الإشعارات',
    icon: <Bell className="h-[18px] w-[18px]" />,
    description: 'تفضيلات الإشعارات',
  },
  {
    key: 'privacy',
    label: 'الخصوصية',
    icon: <Eye className="h-[18px] w-[18px]" />,
    description: 'من يرى ملفك الشخصي',
  },
  {
    key: 'translation',
    label: 'برنامج منشئ المحتوى',
    icon: <Upload className="h-[18px] w-[18px]" />,
    description: 'انضم كمعرّب أو ناشر وشارك المحتوى العربي',
  },
]

const TRANSLATOR_ROLES = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']

const TRANSLATOR_BENEFITS = [
  {
    icon: <Upload className="h-5 w-5" />,
    title: 'انشر تعريباتك',
    description: 'ارفع تعريباتك وشاركها مع آلاف اللاعبين',
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'تفاعل مع الجمهور',
    description: 'استقبل التعليقات والتقييمات وابنِ جمهورك',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'تابع إحصائياتك',
    description: 'شاهد التحميلات والمشاهدات والتقدم',
  },
]

const TRANSLATOR_STEPS = [
  { title: 'قدّم طلبك', desc: 'املأ نموذج التقديم من زر «قدّم طلبك الآن» — يستغرق دقيقتين فقط.' },
  { title: 'استلم الرد', desc: 'تُراجع الطلبات خلال 48 ساعة، وتصلك الموافقة على حسابك.' },
  {
    title: 'ابدأ بالنشر',
    desc: 'بعد الموافقة تحصل على دور منشئ محتوى رسمي ويمكنك النشر من لوحة منشئ المحتوى.',
  },
  { title: 'تابع النتائج', desc: 'تتبع تحميلاتك ومشاهداتك واستقبل تعليقات وتقييمات جمهورك.' },
]

const PROVIDER_INFO: Record<string, { name: string; icon: string; color: string }> = {
  google: { name: 'Google', icon: '🌐', color: '#4285f4' },
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

  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({})
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
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

  const profileForm = useForm<ProfileUpdateInput>({
    resolver: zodResolver(ProfileUpdateSchema),
    defaultValues: { username: '', displayName: '', bio: '' },
  })

  const passwordForm = useForm<SettingsPasswordInput>({
    resolver: zodResolver(SettingsPasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const profileValues = profileForm.watch()

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [dailySummary, setDailySummary] = useState(true)

  const [profileVisibility, setProfileVisibility] = useState('everyone')
  const [hideJoinDate, setHideJoinDate] = useState(false)

  const [linkedAccounts, setLinkedAccounts] = useState<
    Array<{
      id: string
      provider: string
      providerEmail: string | null
      providerUsername: string | null
      avatarUrl: string | null
      createdAt: string
    }>
  >([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  const isDirty = useMemo(() => {
    if (!profile) return false
    return (
      (profileValues.bio || '') !== (profile.bio || '') ||
      (profileValues.username || '') !== (profile.username || '') ||
      (profileValues.displayName || '') !== (profile.displayName || '') ||
      firstName !== (profile.firstName || '') ||
      lastName !== (profile.lastName || '') ||
      websiteUrl !== (profile.websiteUrl || '') ||
      twitterUrl !== (profile.twitterUrl || '') ||
      instagramUrl !== (profile.instagramUrl || '') ||
      tiktokUrl !== (profile.tiktokUrl || '') ||
      youtubeUrl !== (profile.youtubeUrl || '') ||
      githubUrl !== (profile.githubUrl || '') ||
      accentColor !== (profile.accentColor || '#ff8c00') ||
      profileVisibility !== (profile.profileVisibility || 'everyone') ||
      hideJoinDate !== !!profile.hideJoinDate ||
      !!avatarFile ||
      !!bannerFile ||
      avatarRemoved ||
      bannerRemoved
    )
  }, [
    profile,
    profileValues.bio,
    profileValues.username,
    profileValues.displayName,
    firstName,
    lastName,
    websiteUrl,
    twitterUrl,
    instagramUrl,
    tiktokUrl,
    youtubeUrl,
    githubUrl,
    accentColor,
    profileVisibility,
    hideJoinDate,
    avatarFile,
    bannerFile,
    avatarRemoved,
    bannerRemoved,
  ])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
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
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const payload = data?.data
        if (payload?.profile) {
          const p = payload.profile

          setProfile(p)
          profileForm.reset({
            username: p.username || '',
            displayName: p.displayName || '',
            bio: p.bio || '',
          })
          setFirstName(p.firstName || '')
          setLastName(p.lastName || '')
          setWebsiteUrl(p.websiteUrl || '')
          setTwitterUrl(p.twitterUrl || '')
          setInstagramUrl(p.instagramUrl || '')
          setTiktokUrl(p.tiktokUrl || '')
          setYoutubeUrl(p.youtubeUrl || '')
          setGithubUrl(p.githubUrl || '')
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
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort settings operation
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

    let avatarUrl: string | null | undefined

    if (avatarFile) {
      // Upload avatar via Cloudinary endpoint (handles old image deletion + quota)
      const formData = new FormData()
      formData.append('file', avatarFile)

      const res = await fetch(`/api/users/${encodeURIComponent(profile.username)}/avatar`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'avatar_upload_failed')
      }

      const data = await res.json()
      avatarUrl = data?.data?.url
    } else if (avatarRemoved) {
      // Delete avatar via Cloudinary endpoint
      await fetch(`/api/users/${encodeURIComponent(profile.username)}/avatar`, {
        method: 'DELETE',
      })
      avatarUrl = null
    }

    let bannerUrl: string | null | undefined

    if (bannerFile) {
      // Upload banner via Cloudinary endpoint (handles old image deletion + quota)
      const formData = new FormData()
      formData.append('file', bannerFile)

      const res = await fetch(`/api/users/${encodeURIComponent(profile.username)}/banner`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'banner_upload_failed')
      }

      const data = await res.json()
      bannerUrl = data?.data?.url
    } else if (bannerRemoved) {
      // Delete banner via Cloudinary endpoint
      await fetch(`/api/users/${encodeURIComponent(profile.username)}/banner`, {
        method: 'DELETE',
      })
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
    const refreshedProfile = await refreshProfile(username)
    await refreshAuth()
    resetAssetState()
    setSaved(true)
    toast({ title: message })
    setTimeout(() => setSaved(false), 2000)

    // Reset form with new profile values to prevent false dirty state
    if (refreshedProfile) {
      profileForm.reset({
        username: refreshedProfile.username || '',
        displayName: refreshedProfile.displayName || '',
        bio: refreshedProfile.bio || '',
      })
      setFirstName(refreshedProfile.firstName || '')
      setLastName(refreshedProfile.lastName || '')
      setWebsiteUrl(refreshedProfile.websiteUrl || '')
      setTwitterUrl(refreshedProfile.twitterUrl || '')
      setInstagramUrl(refreshedProfile.instagramUrl || '')
      setTiktokUrl(refreshedProfile.tiktokUrl || '')
      setYoutubeUrl(refreshedProfile.youtubeUrl || '')
      setGithubUrl(refreshedProfile.githubUrl || '')
      setAccentColor(refreshedProfile.accentColor || '#ff8c00')
      setProfileVisibility(refreshedProfile.profileVisibility || 'everyone')
      setHideJoinDate(refreshedProfile.hideJoinDate || false)
    }

    // إذا تغير اسم المستخدم، حدّث الـ URL فوراً لتجنب stale session
    if (profile && username !== profile.username) {
      // استخدم encodeURIComponent لدعم الأسماء العربية والمسافات
      window.location.href = `/profile/${encodeURIComponent(username)}`
    }
  }

  const ensureUsernameAvailable = async () => {
    const currentUsername = profileValues.username || ''
    if (!profile || !currentUsername || currentUsername === profile.username) {
      return true
    }

    const checkRes = await fetch(`/api/users/${encodeURIComponent(currentUsername)}/profile`)

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
        toast({
          title: 'الملف كبير جداً',
          description: 'الحد الأقصى 5 ميجابايت',
          variant: 'destructive',
        })
        return
      }
      // P2: min 200×200px
      void getImageDimensions(file).then((dims) => {
        const check = checkImageDimensions(dims, 'avatar')
        if (!check.ok) {
          toast({ title: 'الصورة صغيرة جدًا', description: check.error, variant: 'destructive' })
          return
        }
        const reader = new FileReader()
        reader.onload = (ev) => {
          setCropImageSrc(ev.target?.result as string)
          setCropType('avatar')
          setCropModalOpen(true)
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 60 * 1024 * 1024) {
        toast({
          title: 'الملف كبير جداً',
          description: 'الحد الأقصى 60 ميجابايت',
          variant: 'destructive',
        })
        return
      }
      // P2: min 200×200px error; below 1200×630 recommendation warns only.
      void getImageDimensions(file).then((dims) => {
        const check = checkImageDimensions(dims, 'banner')
        if (!check.ok) {
          toast({ title: 'الصورة صغيرة جدًا', description: check.error, variant: 'destructive' })
          return
        }
        if (check.warning) {
          toast({ title: 'تنبيه', description: check.warning })
        }
        const reader = new FileReader()
        reader.onload = (ev) => {
          setCropImageSrc(ev.target?.result as string)
          setCropType('banner')
          setCropModalOpen(true)
        }
        reader.readAsDataURL(file)
      })
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

  const handleSaveProfileOnly = async (values: ProfileUpdateInput) => {
    if (!profile) return
    console.log('[Settings] Saving profile only')
    setSaving(true)
    setSaved(false)
    try {
      const usernameAvailable = await ensureUsernameAvailable()

      if (!usernameAvailable) {
        setSaving(false)
        profileForm.setError('username', { message: 'اسم المستخدم مستخدم بالفعل' })
        return
      }

      const { avatarUrl, bannerUrl } = await uploadProfileAssets()

      const profileRes = await fetch(`/api/users/${encodeURIComponent(profile.username)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: values.bio,
          username: values.username !== profile.username ? values.username : undefined,
          displayName: values.displayName,
          firstName,
          lastName,
          websiteUrl,
          twitterUrl,
          instagramUrl,
          tiktokUrl,
          youtubeUrl,
          githubUrl,
          accentColor,
          avatarUrl,
          bannerUrl,
          profileVisibility,
          hideJoinDate,
        }),
      })

      console.log('[Settings] Profile save response:', {
        status: profileRes.status,
        ok: profileRes.ok,
      })

      if (profileRes.ok) {
        const data = await profileRes.json()
        await finishSaveSuccess(
          data.data?.profile?.username || profile.username,
          'تم تحديث الملف الشخصي',
        )
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

      console.log('[Settings] Notifications save response:', {
        status: notifRes.status,
        ok: notifRes.ok,
      })

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

      console.log('[Settings] Privacy save response:', {
        status: profileRes.status,
        ok: profileRes.ok,
      })

      if (profileRes.ok) {
        const data = await profileRes.json()
        await finishSaveSuccess(
          data.data?.profile?.username || profile.username,
          'تم تحديث إعدادات الخصوصية',
        )
      } else {
        toast({ title: 'خطأ', description: 'فشل حفظ إعدادات الخصوصية', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleSaveProfile = async (values: ProfileUpdateInput) => {
    if (!profile) return
    console.log('[Settings] Starting save profile', {
      newUsername: values.username,
      bio: (values.bio || '').substring(0, 50),
      emailNotifications,
      pushNotifications,
      dailySummary,
      avatarRemoved,
      bannerRemoved,
    })
    setSaving(true)
    setSaved(false)
    try {
      const usernameAvailable = await ensureUsernameAvailable()

      if (!usernameAvailable) {
        setSaving(false)
        profileForm.setError('username', { message: 'اسم المستخدم مستخدم بالفعل' })
        return
      }

      const { avatarUrl, bannerUrl } = await uploadProfileAssets()

      const [profileRes, notifRes] = await Promise.all([
        fetch(`/api/users/${encodeURIComponent(profile.username)}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bio: values.bio,
            username: values.username !== profile.username ? values.username : undefined,
            displayName: values.displayName,
            firstName,
            lastName,
            websiteUrl,
            twitterUrl,
            instagramUrl,
            tiktokUrl,
            youtubeUrl,
            githubUrl,
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
            dailySummary,
          }),
        }),
      ])

      console.log('[Settings] Save responses:', {
        profileStatus: profileRes.status,
        profileOk: profileRes.ok,
        notifStatus: notifRes.status,
        notifOk: notifRes.ok,
      })

      const profileOk = profileRes.ok
      const notifOk = notifRes.ok

      if (profileOk && notifOk) {
        const data = await profileRes.json()
        await finishSaveSuccess(
          data.data?.profile?.username || profile.username,
          'تم تحديث جميع الإعدادات',
        )
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

  const handleChangePassword = async (values: SettingsPasswordInput) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        }),
      })
      if (res.ok) {
        toast({ title: '✅ تم تغيير كلمة المرور بنجاح' })
        passwordForm.reset()
      } else {
        const data = await res.json()
        const msg = data?.error?.message || data?.error || ''
        if (msg.includes('Current password') || msg.includes('غير صحيحة')) {
          passwordForm.setError('currentPassword', { message: 'كلمة المرور الحالية غير صحيحة' })
        } else {
          passwordForm.setError('root', {
            message: msg || '⚠️ تعذر تغيير كلمة المرور — تحقق من كلمة المرور الحالية وحاول مجددًا',
          })
        }
      }
    } catch {
      passwordForm.setError('root', { message: 'حدث خطأ أثناء التغيير، تحقق من الاتصال' })
    }
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
        setLinkedAccounts((prev) => prev.filter((a) => a.id !== accountId))
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
          <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
            تسجيل الدخول
          </Link>
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
  const isCreator = TRANSLATOR_ROLES.includes(user?.role || '')
  const displayAvatar = avatarRemoved ? null : avatarPreview || profile.avatarUrl
  const displayBanner = bannerRemoved ? null : bannerPreview || profile.bannerUrl

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
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 lg:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <nav className="lg:w-64 shrink-0">
            <div className="space-y-3 lg:sticky lg:top-24">
              {SECTIONS.map((section) => (
                <button
                  key={section.key}
                  onClick={() => handleSectionChange(section.key)}
                  className={`group flex w-full items-center gap-3 rounded-none border-[3px] px-4 py-3 text-start cursor-pointer transition-all duration-150 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--border)] ${
                    activeSection === section.key
                      ? 'border-primary bg-primary/10 shadow-[4px_4px_0_0_var(--border)]'
                      : 'border-border bg-card shadow-[4px_4px_0_0_var(--border)] hover:bg-card-hover'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-colors ${
                      activeSection === section.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-transparent text-muted-foreground'
                    }`}
                  >
                    {section.icon}
                  </div>
                  <div className="min-w-0 text-start">
                    <div className="text-sm font-bold text-foreground">{section.label}</div>
                    <div className="text-[10px] font-medium text-muted-foreground">
                      {section.description}
                    </div>
                  </div>
                  <ChevronLeft
                    className={`ms-auto h-4 w-4 shrink-0 text-primary transition-opacity ${
                      activeSection === section.key
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {/* ========== Profile Section ========== */}
            {activeSection === 'profile' && (
              <Form {...profileForm}>
                <div className="space-y-6">
                  {/* Banner — مع ImageUpload الجديد */}
                  <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                    <h3 className="mb-4 text-sm font-bold">البانر الخلفي</h3>
                    <div className="relative h-[180px] overflow-hidden rounded-none border-2 border-border">
                      {displayBanner ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayBanner}
                          alt="banner"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted/30" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 right-3 flex gap-2">
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[44px]"
                          onClick={() => bannerInputRef.current?.click()}
                        >
                          <Upload className="ml-1.5 h-3.5 w-3.5" /> رفع وقص
                        </Button>
                        {displayBanner && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="cursor-pointer min-h-[44px]"
                            onClick={() => {
                              setBannerPreview(null)
                              setBannerFile(null)
                              setBannerRemoved(true)
                              if (bannerInputRef.current) bannerInputRef.current.value = ''
                            }}
                          >
                            <X className="ml-1.5 h-3.5 w-3.5" /> إزالة
                          </Button>
                        )}
                      </div>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleBannerChange}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      الحجم المقترح: 1500×400 بكسل
                    </p>
                    <div className="mt-4">
                      <ImageUpload
                        bucket="banners"
                        value={displayBanner || ''}
                        onFileSelect={(file) => {
                          setBannerFile(file)
                          setBannerPreview(URL.createObjectURL(file))
                          setBannerRemoved(false)
                        }}
                        label="أو اسحب بانر جديد هنا (سحب وإفلات)"
                        hint="أعلى جودة — سيتم حفظ الرابط تلقائياً عند الضغط على حفظ"
                        folder="banners"
                        skipUpload
                      />
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                    <h3 className="mb-4 text-sm font-bold">الصورة الرمزية</h3>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <Avatar
                          className="h-24 w-24 border-4"
                          style={{ borderColor: accent, boxShadow: `0 0 20px ${accent}33` }}
                        >
                          <AvatarImage
                            src={displayAvatar || undefined}
                            alt={profileValues.displayName || profile.username}
                          />
                          <AvatarFallback
                            className="text-3xl font-bold"
                            style={{ backgroundColor: accent + '33', color: accent }}
                          >
                            {(profileValues.displayName || profile.username)[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute bottom-0 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border cursor-pointer min-h-[44px]"
                            onClick={() => avatarInputRef.current?.click()}
                          >
                            <Upload className="ml-1.5 h-3.5 w-3.5" /> رفع وقص
                          </Button>
                          {displayAvatar && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="cursor-pointer min-h-[44px]"
                              onClick={() => {
                                setAvatarPreview(null)
                                setAvatarFile(null)
                                setAvatarRemoved(true)
                                if (avatarInputRef.current) avatarInputRef.current.value = ''
                              }}
                            >
                              <X className="ml-1.5 h-3.5 w-3.5" /> إزالة
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          الصورة الرمزية التي تظهر في ملفك الشخصي
                        </p>
                        <div className="mt-3">
                          <ImageUpload
                            bucket="avatars"
                            value={displayAvatar || ''}
                            onFileSelect={(file) => {
                              setAvatarFile(file)
                              setAvatarPreview(URL.createObjectURL(file))
                              setAvatarRemoved(false)
                            }}
                            label="أو اسحب صورة جديدة هنا (سحب وإفلات)"
                            hint="أعلى جودة — سيتم الحفظ تلقائياً"
                            folder="avatars"
                            skipUpload
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Username */}
                  <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                    <h3 className="mb-4 text-sm font-bold">اسم المستخدم</h3>
                    <FormField
                      control={profileForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm text-muted-foreground">
                              اسم الملف الشخصي
                            </FormLabel>
                            {field.value !== profile?.username && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
                                onClick={() =>
                                  profileForm.setValue('username', profile?.username || '')
                                }
                              >
                                تراجع
                              </Button>
                            )}
                          </div>
                          <FormControl>
                            <Input
                              className="bg-background border-border"
                              placeholder="اسم المستخدم"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-[11px]" />
                          <p className="text-xs text-muted-foreground">
                            سيتم تحويلك للصفحة الجديدة بعد الحفظ
                          </p>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Display Name + Bio — خانة واحدة */}
                  <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                    <h3 className="mb-4 text-sm font-bold">الاسم والنبذة</h3>
                    <div className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm text-muted-foreground">
                              اسم العرض
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-background border-border"
                                placeholder="الاسم اللي هيظهر للمستخدمين"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                            <p className="text-xs text-muted-foreground">
                              هذا الاسم سيظهر للآخرين بدلاً من اسم المستخدم
                            </p>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-sm text-muted-foreground">
                            الاسم الأول
                          </Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="bg-background border-border"
                            placeholder="الاسم الأول"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-sm text-muted-foreground">
                            اسم العائلة
                          </Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="bg-background border-border"
                            placeholder="اسم العائلة"
                          />
                        </div>
                      </div>
                      <FormField
                        control={profileForm.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel className="text-sm text-muted-foreground">
                                النبذة — أخبر الآخرين عن نفسك
                              </FormLabel>
                              {field.value && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs text-destructive hover:text-destructive min-h-[44px]"
                                  onClick={() => profileForm.setValue('bio', '')}
                                >
                                  مسح
                                </Button>
                              )}
                            </div>
                            <FormControl>
                              <textarea
                                className="w-full rounded-none border-2 border-border bg-background p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                rows={4}
                                placeholder="اكتب نبذة عن نفسك..."
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.substring(0, 500))}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                            <p className="text-xs text-muted-foreground">
                              {(field.value || '').length}/500
                            </p>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                    <h3 className="mb-4 text-sm font-bold">اللون المميز</h3>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="h-12 w-12 cursor-pointer rounded-none border-2 border-border bg-transparent"
                        />
                        <span className="text-sm text-muted-foreground font-mono">
                          {accentColor}
                        </span>
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
                        <Avatar
                          className="h-16 w-16 border-3"
                          style={{
                            borderColor: accentColor,
                            boxShadow: `0 0 15px ${accentColor}55`,
                          }}
                        >
                          <AvatarImage
                            src={displayAvatar || undefined}
                            alt={profileValues.displayName || profile.username}
                          />
                          <AvatarFallback
                            className="text-xl font-bold"
                            style={{ backgroundColor: accentColor + '33', color: accentColor }}
                          >
                            {(profileValues.displayName || profile.username)[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs text-muted-foreground">معاينة الهالة</p>
                          <p className="text-xs text-muted-foreground/70">
                            اللون يظهر حول الأفاتار
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                    <h3 className="mb-4 text-sm font-bold">الروابط الاجتماعية</h3>
                    <SocialLinksEditor
                      websiteUrl={websiteUrl}
                      twitterUrl={twitterUrl}
                      instagramUrl={instagramUrl}
                      tiktokUrl={tiktokUrl}
                      youtubeUrl={youtubeUrl}
                      githubUrl={githubUrl}
                      onWebsiteUrlChange={setWebsiteUrl}
                      onTwitterUrlChange={setTwitterUrl}
                      onInstagramUrlChange={setInstagramUrl}
                      onTiktokUrlChange={setTiktokUrl}
                      onYoutubeUrlChange={setYoutubeUrl}
                      onGithubUrlChange={setGithubUrl}
                    />
                  </div>

                  <div className="flex justify-end">
                    <SaveButton
                      onClick={profileForm.handleSubmit(handleSaveProfile)}
                      saving={saving || profileForm.formState.isSubmitting}
                      saved={saved}
                    />
                  </div>
                </div>
              </Form>
            )}

            {/* ========== Account Section ========== */}
            {activeSection === 'account' && (
              <div className="space-y-6">
                {/* P0-flexible: optional security setup (hidden once complete) */}
                {user &&
                  needsSecuritySetup({
                    hasPassword: user.hasPassword,
                    email: user.email,
                    emailVerified: user.emailVerified,
                  }) && <SetupPasswordCard />}
                <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <h3 className="mb-2 text-sm font-bold">
                    {user?.hasPassword ? 'تغيير كلمة المرور' : 'كلمة المرور'}
                  </h3>
                  {!user?.hasPassword ? (
                    <p className="text-xs text-muted-foreground">
                      لم يتم تعيين كلمة مرور بعد — قم بتعيينها من قسم تأمين الحساب أعلاه.
                    </p>
                  ) : (
                  <>
                  <p className="text-xs text-muted-foreground mb-6">
                    تأكد من استخدام كلمة مرور قوية (٨ أحرف على الأقل)
                  </p>
                  <Form {...passwordForm}>
                    <form
                      onSubmit={passwordForm.handleSubmit(handleChangePassword)}
                      className="space-y-4 max-w-md"
                    >
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm text-muted-foreground">
                              كلمة المرور الحالية *
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                className="bg-background border-border"
                                placeholder="••••••••"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm text-muted-foreground">
                              كلمة المرور الجديدة
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                className="bg-background border-border"
                                placeholder="••••••••"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm text-muted-foreground">
                              تأكيد كلمة المرور
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                className="bg-background border-border"
                                placeholder="••••••••"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </FormItem>
                        )}
                      />
                      {passwordForm.formState.errors.root && (
                        <p className="text-xs text-destructive">
                          {passwordForm.formState.errors.root.message}
                        </p>
                      )}
                      <Button
                        type="submit"
                        variant="outline"
                        className="border-border cursor-pointer"
                        disabled={passwordForm.formState.isSubmitting}
                      >
                        {passwordForm.formState.isSubmitting ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري التحديث...
                          </>
                        ) : (
                          'تحديث كلمة المرور'
                        )}
                      </Button>
                    </form>
                  </Form>
                  </>
                  )}
                </div>
                <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <h3 className="mb-2 text-sm font-bold">الحسابات المرتبطة</h3>
                  <p className="text-xs text-muted-foreground mb-6">
                    إدارة حسابات OAuth المرتبطة بحسابك
                  </p>
                  {loadingAccounts ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs">جاري التحميل...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {linkedAccounts.map((account) => {
                        const info = PROVIDER_INFO[account.provider] || {
                          name: account.provider,
                          icon: '🔗',
                          color: '#666',
                        }
                        return (
                          <div
                            key={account.id}
                            className="flex items-center justify-between gap-4 p-3 rounded-none hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                                style={{ backgroundColor: info.color + '20' }}
                              >
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
                              title={
                                linkedAccounts.length <= 1 ? 'لا يمكن إلغاء ربط الحساب الأخير' : ''
                              }
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
            {activeSection === 'notifications' &&
              (TRANSLATOR_ROLES.includes(user?.role) ? (
                <NotificationSettings />
              ) : (
                <SimpleNotificationSettings />
              ))}

            {/* ========== Privacy Section ========== */}
            {activeSection === 'privacy' && (
              <div className="space-y-6">
                <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <h3 className="mb-2 text-sm font-bold">إعدادات الخصوصية</h3>
                  <p className="text-xs text-muted-foreground mb-6">
                    تحكم في من يمكنه رؤية معلومات ملفك الشخصي
                  </p>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="visibility" className="text-sm text-muted-foreground">
                        من يرى ملفك الشخصي
                      </Label>
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
                  <SaveButton
                    onClick={profileForm.handleSubmit(handleSaveProfile)}
                    saving={saving || profileForm.formState.isSubmitting}
                    saved={saved}
                  />
                </div>
              </div>
            )}

            {/* ========== Become Translator Section ========== */}
            {activeSection === 'translation' && (
              <div className="space-y-6">
                {/* Hero */}
                <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none border-2 border-primary bg-primary/10 text-primary">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold">انضم لبرنامج منشئ المحتوى — شارك المحتوى العربي مع آلاف اللاعبين</h3>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        برنامج منشئ المحتوى يفتح لك مسارين: معرّب ينشر تعريبات الألعاب، أو ناشر
                        يشارك المحتوى والأخبار. كل ما تحتاجه حساب نشط وشغف بالمحتوى العربي —
                        قدّم طلبك وستصلك المراجعة خلال 48 ساعة.
                      </p>
                    </div>
                  </div>
                </div>

                {/* What it means */}
                <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <h3 className="mb-3 text-sm font-bold">ما هو برنامج منشئ المحتوى؟</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    منشئ المحتوى هو عضو معتمد ينشر المحتوى العربي على المنصة عبر مسارين: مسار
                    المعرّب الذي يحوّل الألعاب إلى العربية، ومسار الناشر الذي يشارك المحتوى
                    والأخبار. كل ما تنشره يصبح متاحاً للآلاف، وتُحفظ حقوقك بذكر اسمك وفريقك
                    كاملين في صفحة المحتوى.
                  </p>
                </div>

                {/* Benefits */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {TRANSLATOR_BENEFITS.map((benefit) => (
                    <div
                      key={benefit.title}
                      className="rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)]"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-none border-2 border-primary bg-primary/10 text-primary">
                        {benefit.icon}
                      </div>
                      <h4 className="text-sm font-bold">{benefit.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Steps */}
                <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <h3 className="mb-4 text-sm font-bold">كيف تنضم للبرنامج؟</h3>
                  <ol className="space-y-4">
                    {TRANSLATOR_STEPS.map((step, i) => (
                      <li key={step.title} className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border-2 border-primary bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{step.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                            {step.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Instructions */}
                <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <h3 className="mb-4 text-sm font-bold">تعليمات المشاركة مع الآخرين</h3>
                  <ul className="space-y-3">
                    {[
                      'اصنع في صفحة التعريب قسم «فريق التعريب» وضيف روابط التواصل والدعم الخاصة بك.',
                      'حافظ على تحديث نسخة تعريبك وترفعها أولاً بأول حتى يستفيد الجميع.',
                      'تابع تعليقات وتقييمات اللاعبين على تعريباتك وردّ عليها لبناء جمهورك.',
                      'روّج لتعريباتك في المجتمع وشاركها ليصل أثر تعريبك لأكبر عدد ممكن.',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="rounded-none border-[3px] border-primary/40 bg-primary/5 p-6 shadow-[4px_4px_0_0_var(--border)]">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold">
                        {isCreator ? 'أنت منشئ محتوى بالفعل' : 'جاهز تبدأ رحلتك؟'}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isCreator
                          ? 'من لوحة منشئ المحتوى تقدر تنشر أعمالك وتتابع إحصائياتك مباشرة.'
                          : 'يستغرق التقديم دقيقتين فقط — سيتم مراجعة طلبك خلال 48 ساعة.'}
                      </p>
                    </div>
                    <Link href={isCreator ? '/creator' : '/become-creator/apply'}>
                      <Button className="min-h-[44px]">
                        {isCreator ? 'لوحة منشئ المحتوى' : 'قدّم طلبك الآن'}
                      </Button>
                    </Link>
                  </div>
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

function SettingsInput({
  label,
  value,
  onChange,
  placeholder,
  id,
  type = 'text',
  onClear,
}: {
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
        <Label htmlFor={id} className="text-sm text-muted-foreground">
          {label}
        </Label>
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

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
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
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function SaveButton({
  onClick,
  saving,
  saved,
}: {
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
        <>
          <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...
        </>
      ) : saved ? (
        <>
          <Check className="ml-2 h-4 w-4" /> تم الحفظ
        </>
      ) : (
        <>
          <Save className="ml-2 h-4 w-4" /> حفظ التغييرات
        </>
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
  onWebsiteUrlChange: (value: string) => void
  onTwitterUrlChange: (value: string) => void
  onInstagramUrlChange: (value: string) => void
  onTiktokUrlChange: (value: string) => void
  onYoutubeUrlChange: (value: string) => void
  onGithubUrlChange: (value: string) => void
}

function SocialLinksEditor({
  websiteUrl,
  twitterUrl,
  instagramUrl,
  tiktokUrl,
  youtubeUrl,
  githubUrl,
  onWebsiteUrlChange,
  onTwitterUrlChange,
  onInstagramUrlChange,
  onTiktokUrlChange,
  onYoutubeUrlChange,
  onGithubUrlChange,
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
  }

  const activePlatforms = PLATFORM_KEYS.filter((key) => urlMap[SOCIAL_PLATFORMS[key].column]?.value)

  const availablePlatforms = PLATFORM_KEYS.filter(
    (key) => !urlMap[SOCIAL_PLATFORMS[key].column]?.value,
  )

  const handleAddPlatform = (key: string) => {
    const platform = SOCIAL_PLATFORMS[key]
    const entry = urlMap[platform.column]
    if (entry) {
      entry.onChange('https://')
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
