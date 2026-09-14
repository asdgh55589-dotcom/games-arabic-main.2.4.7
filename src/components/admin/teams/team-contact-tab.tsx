import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONTACT_ICONS } from '@/lib/team-constants'
import type { TeamContactLinkInput } from './types'

const TYPE_LABELS: Record<string, string> = {
  website: 'الموقع',
  mail: 'البريد الإلكتروني',
  telegram: 'تيليجرام',
  twitter: 'X (تويتر)',
  youtube: 'يوتيوب',
  facebook: 'فيسبوك',
  instagram: 'انستجرام',
}

interface TeamContactTabProps {
  links: TeamContactLinkInput[]
  onChange: (links: TeamContactLinkInput[]) => void
}

export function TeamContactTab({ links, onChange }: TeamContactTabProps) {
  const update = (i: number, patch: Partial<TeamContactLinkInput>) => {
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  return (
    <div className="space-y-3">
      {links.length === 0 && (
        <p className="text-sm text-muted-foreground">لا توجد روابط تواصل بعد — أضف رابطاً جديداً.</p>
      )}
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground">
            {CONTACT_ICONS[link.type] ?? CONTACT_ICONS.website}
          </span>
          <select
            value={link.type}
            onChange={(e) => update(i, { type: e.target.value })}
            className="w-36 shrink-0 rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input
            value={link.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="الاسم الظاهر"
            className="w-40 shrink-0"
          />
          <Input
            value={link.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://..."
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
            onClick={() => onChange(links.filter((_, idx) => idx !== i))}
            title="حذف الرابط"
            aria-label="حذف الرابط"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        onClick={() => onChange([...links, { type: 'website', label: '', url: '' }])}
      >
        <Plus className="ml-1 h-3 w-3" /> إضافة رابط
      </Button>
      <p className="text-xs text-muted-foreground">
        يتم حفظ الروابط بزر «حفظ» أعلى الصفحة. روابط الموقع والديسكورد تُزامَن تلقائياً مع الحقول
        القديمة.
      </p>
    </div>
  )
}
