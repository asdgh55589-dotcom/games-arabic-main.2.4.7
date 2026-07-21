'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Shield, Bell, Eye, Link as LinkIcon, Palette, Lock, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ProfileSettingsProps {
  profile: {
    username: string
    role: string
    bio: string | null
    websiteUrl: string | null
    twitterUrl: string | null
    githubUrl: string | null
    discordUrl: string | null
    accentColor: string | null
  }
  accent: string
  onSave: (data: Partial<any>) => void
}

export function ProfileSettings({ profile, accent, onSave }: ProfileSettingsProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [bio, setBio] = useState(profile.bio || '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl || '')
  const [twitterUrl, setTwitterUrl] = useState(profile.twitterUrl || '')
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl || '')
  const [discordUrl, setDiscordUrl] = useState(profile.discordUrl || '')
  const [accentColor, setAccentColor] = useState(profile.accentColor || '#ff8c00')

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [commentNotifications, setCommentNotifications] = useState(true)
  const [likeNotifications, setLikeNotifications] = useState(false)

  // Privacy settings
  const [profileVisibility, setProfileVisibility] = useState('everyone')
  const [hideJoinDate, setHideJoinDate] = useState(false)

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
        toast({ title: 'تم الحفظ' })
      } else {
        toast({ title: 'خطأ', description: 'لم يتم الحفظ', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <SettingsSection title="المعلومات الأساسية" icon={<UserIcon className="h-4 w-4" />} accent={accent}>
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={undefined} />
              <AvatarFallback className="text-2xl font-bold" style={{ backgroundColor: accent + '33', color: accent }}>
                {profile.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-white">{profile.username}</p>
              <p className="text-xs text-gray-500">تاريخ الانضمام: 2021</p>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">اللقب أو الشعار الشخصي (Tagline/Bio)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border border-[#333] bg-[#222] p-3 text-sm text-white placeholder-gray-500 focus:border-[{accent}] focus:outline-none"
              rows={3}
              placeholder="اكتب نبذة عن نفسك..."
            />
          </div>
        </div>
      </SettingsSection>

      {/* Social Links */}
      <SettingsSection title="الروابط الاجتماعية" icon={<LinkIcon className="h-4 w-4" />} accent={accent}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">الموقع الإلكتروني</label>
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="border-[#333] bg-[#222] text-white placeholder-gray-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">تويتر</label>
            <Input
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              className="border-[#333] bg-[#222] text-white placeholder-gray-500"
              placeholder="https://twitter.com/..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">GitHub</label>
            <Input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="border-[#333] bg-[#222] text-white placeholder-gray-500"
              placeholder="https://github.com/..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Discord</label>
            <Input
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              className="border-[#333] bg-[#222] text-white placeholder-gray-500"
              placeholder="username#0000"
            />
          </div>
        </div>
      </SettingsSection>

      {/* Password */}
      <SettingsSection title="تغيير كلمة المرور" icon={<Lock className="h-4 w-4" />} accent={accent}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">كلمة المرور الحالية</label>
            <Input type="password" className="border-[#333] bg-[#222] text-white placeholder-gray-500" placeholder="••••••••" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">كلمة المرور الجديدة</label>
            <Input type="password" className="border-[#333] bg-[#222] text-white placeholder-gray-500" placeholder="••••••••" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">تأكيد كلمة المرور</label>
            <Input type="password" className="border-[#333] bg-[#222] text-white placeholder-gray-500" placeholder="••••••••" />
          </div>
          <Button variant="outline" size="sm" className="border-[#333] text-gray-300 hover:bg-[#222]">
            تحديث كلمة المرور
          </Button>
        </div>
      </SettingsSection>

      {/* Notification Settings */}
      <SettingsSection title="إعدادات الإشعارات" icon={<Bell className="h-4 w-4" />} accent={accent}>
        <div className="space-y-3">
          <ToggleSetting
            label="إشعارات البريد الإلكتروني"
            description="استلام إشعارات عبر البريد"
            checked={emailNotifications}
            onChange={setEmailNotifications}
            accent={accent}
          />
          <ToggleSetting
            label="إشعارات الدفع (Push)"
            description="استلام إشعارات فورية على الجهاز"
            checked={pushNotifications}
            onChange={setPushNotifications}
            accent={accent}
          />
          <ToggleSetting
            label="إشعارات التعليقات"
            description="إشعار عند التعليق على تعريباتك"
            checked={commentNotifications}
            onChange={setCommentNotifications}
            accent={accent}
          />
          <ToggleSetting
            label="إشعارات الإعجابات"
            description="إشعار عند إعجاب شخص بتعليقك"
            checked={likeNotifications}
            onChange={setLikeNotifications}
            accent={accent}
          />
        </div>
      </SettingsSection>

      {/* Privacy Settings */}
      <SettingsSection title="الخصوصية" icon={<Eye className="h-4 w-4" />} accent={accent}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">من يرى ملفك الشخصي</label>
            <select
              value={profileVisibility}
              onChange={(e) => setProfileVisibility(e.target.value)}
              className="w-full rounded-lg border border-[#333] bg-[#222] p-2 text-sm text-white"
            >
              <option value="everyone">الجميع</option>
              <option value="followers">المتابعين فقط</option>
              <option value="nobody">لا أحد</option>
            </select>
          </div>
          <ToggleSetting
            label="إخفاء تاريخ الانضمام"
            checked={hideJoinDate}
            onChange={setHideJoinDate}
            accent={accent}
          />
        </div>
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="تخصيص المظهر" icon={<Palette className="h-4 w-4" />} accent={accent}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">لون الملف الشخصي</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-lg border border-[#333] bg-transparent"
              />
              <span className="text-sm text-gray-400">{accentColor}</span>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* External Accounts */}
      <SettingsSection title="ربط/فصل الحسابات الخارجية" icon={<Shield className="h-4 w-4" />} accent={accent}>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-[#333] bg-[#222] p-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-[#1877f2] flex items-center justify-center text-xs font-bold text-white">f</div>
              <span className="text-sm text-white">Facebook</span>
            </div>
            <Button variant="outline" size="sm" className="border-[#333] text-gray-300 hover:bg-[#222]">
              ربط
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#333] bg-[#222] p-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-[#ea4335] flex items-center justify-center text-xs font-bold text-white">G</div>
              <span className="text-sm text-white">Google</span>
            </div>
            <Button variant="outline" size="sm" className="border-[#333] text-gray-300 hover:bg-[#222]">
              ربط
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Upgrade to Translator */}
      {!['owner', 'admin', 'moderator'].includes(profile.role) && (
        <SettingsSection title="ترقية إلى معرب" accent={accent}>
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              قم بالترقية إلى معرب للحصول على ميزات إضافية مثل نسبة الإنجاز والشارات والتقييم.
            </p>
            <Button
              variant="outline"
              className="w-full border-[#333] text-gray-300 hover:bg-[#222]"
              onClick={() => {
                toast({ title: 'قريباً', description: 'سيتم تفعيل هذه الميزة قريباً' })
              }}
            >
              ترقية إلى معرب
            </Button>
          </div>
        </SettingsSection>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="text-white"
          style={{ backgroundColor: accent }}
        >
          {saving ? 'جاري الحفظ...' : 'حفظ جميع التغييرات'}
        </Button>
      </div>
    </div>
  )
}

function SettingsSection({ title, icon, accent, children }: { title: string; icon?: React.ReactNode; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-lg bg-[#1a1a1a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          {icon && <span style={{ color: accent }}>{icon}</span>}
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && <div className="border-t border-[#333] p-4">{children}</div>}
    </div>
  )
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  accent,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (val: boolean) => void
  accent: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? '' : 'bg-[#333]'
        }`}
        style={checked ? { backgroundColor: accent } : {}}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
