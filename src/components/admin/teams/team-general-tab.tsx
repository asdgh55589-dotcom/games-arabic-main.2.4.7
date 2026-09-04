import { ImageUpload } from '@/components/admin/image-upload'
import { MarkdownEditor } from '@/components/admin/markdown-editor'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TeamMember } from './types'

export interface TeamGeneralFormData {
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  order: number
  isFeatured: boolean
  isOfficial: boolean
  ownerId: string
}

interface TeamGeneralTabProps {
  form: TeamGeneralFormData
  onChange: (patch: Partial<TeamGeneralFormData>) => void
  memberships: TeamMember[]
}

export function TeamGeneralTab({ form, onChange, memberships }: TeamGeneralTabProps) {
  const ownerCandidates = memberships.filter((m) => m.userId)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label>الاسم</Label>
        <Input value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div>
        <Label>الترتيب</Label>
        <Input
          type="number"
          value={form.order}
          onChange={(e) => onChange({ order: Number(e.target.value) })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label>الوصف</Label>
        <MarkdownEditor
          value={form.description}
          onChange={(description) => onChange({ description })}
          rows={6}
        />
      </div>
      <div>
        <ImageUpload
          bucket="teams"
          value={form.logoUrl}
          onChange={(url) => onChange({ logoUrl: url })}
          label="الشعار"
          hint="سحب وإفلات — أعلى جودة"
          folder="logos"
        />
      </div>
      <div>
        <ImageUpload
          bucket="teams"
          value={form.bannerUrl}
          onChange={(url) => onChange({ bannerUrl: url })}
          label="البانر"
          hint="سحب وإفلات — أعلى جودة"
          folder="banners"
        />
      </div>
      <div>
        <Label>قائد الفريق (المالك)</Label>
        <select
          value={form.ownerId}
          onChange={(e) => onChange({ ownerId: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">بدون</option>
          {ownerCandidates.map((m) => (
            <option key={m.id} value={m.userId as string}>
              {m.name}
            </option>
          ))}
        </select>
        {ownerCandidates.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            أضف أعضاء مرتبطين بحسابات لتحديد قائد الفريق
          </p>
        )}
      </div>
      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => onChange({ isFeatured: e.target.checked })}
            className="rounded"
          />{' '}
          مميّز
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isOfficial}
            onChange={(e) => onChange({ isOfficial: e.target.checked })}
            className="rounded"
          />{' '}
          رسمي
        </label>
      </div>
    </div>
  )
}
