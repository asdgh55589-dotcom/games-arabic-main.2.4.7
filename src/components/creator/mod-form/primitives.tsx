// Shared primitives + types for the creator ModForm sections.
// Extracted verbatim from mod-form.tsx (behavior identical).

import { Label } from '@/components/ui/label'

// ===== Types =====
export interface FileLink {
  url: string
  label?: string
}
export interface DownloadFile {
  id?: string
  title: string
  description?: string
  alert?: string
  version: string
  releaseDate?: string
  fileSize: string
  fileFormat: string
  links: FileLink[]
}
export interface TeamMember {
  id?: string
  name: string
  avatarUrl?: string
  role: string
  contribution?: string
}
export interface ContactLink {
  id?: string
  type: string
  label: string
  url: string
}
export interface VideoItem {
  id?: string
  title: string
  url: string
  thumbnail?: string
  duration?: string
  description?: string
  views?: number
  likes?: number
  commentsCount?: number
  channel?: string
  publishedAt?: string | null
}
export interface VideoGroup {
  id?: string
  name: string
  videos: VideoItem[]
}
export interface CustomTab {
  id?: string
  name: string
  slug: string
  content: string
  visible: boolean
}
export interface SeriesOpt {
  id: string
  name: string
  slug: string
}
export interface TeamOpt {
  id: string
  name: string
  slug: string
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const EMPTY_FILE: DownloadFile = {
  title: '',
  description: '',
  alert: '',
  version: '1.0.0',
  fileSize: 'MB 0',
  fileFormat: 'zip',
  links: [],
}
export const EMPTY_MEMBER: TeamMember = { name: '', avatarUrl: '', role: 'مترجم', contribution: '' }
export const EMPTY_CONTACT: ContactLink = { type: 'website', label: '', url: '' }
export const EMPTY_VIDEO: VideoItem = {
  title: '',
  url: '',
  thumbnail: '',
  duration: '',
  description: '',
  views: 0,
  likes: 0,
  commentsCount: 0,
  channel: '',
  publishedAt: null,
}
export const EMPTY_GROUP: VideoGroup = { name: '', videos: [] }
export const EMPTY_TAB: CustomTab = { name: '', slug: '', content: '', visible: true }

// ===== Reusable components =====
export function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card/30 p-5">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border"
      />
      {label}
    </label>
  )
}
