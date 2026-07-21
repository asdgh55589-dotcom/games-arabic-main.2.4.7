'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface ProfileSettingsProps {
  profile: {
    username: string
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
      {/* Personal Info */}
      <SettingsSection title="المعلومات الشخصية" accent={accent}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">نبذة عني</label>
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
      <SettingsSection title="الروابط الاجتماعية" accent={accent}>
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

      {/* Notification Settings */}
      <SettingsSection title="إعدادات الإشعارات" accent={accent}>
        <div className="space-y-3">
          <ToggleSetting
            label="إشعارات البريد"
            description="استلام إشعارات عبر البريد الإلكتروني"
            checked={emailNotifications}
            onChange={setEmailNotifications}
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
      <SettingsSection title="الخصوصية" accent={accent}>
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
      <SettingsSection title="تخصيص المظهر" accent={accent}>
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

function SettingsSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-lg bg-[#1a1a1a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-right"
      >
        <span className="text-sm font-bold text-white">{title}</span>
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
