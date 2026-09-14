'use client'

import {
  Calendar,
  CheckCircle,
  FileArchive,
  Gamepad2,
  Globe,
  Languages,
  Shield,
  Tag,
} from 'lucide-react'
import { formatArabicDate } from '@/lib/format'
import type { ModDetail } from '@/lib/types'

interface ModInfoGridProps {
  mod: ModDetail
}

function InfoRow({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${iconColor}`}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-muted-foreground min-w-[100px]">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}

export function ModInfoGrid({ mod }: ModInfoGridProps) {
  return (
    <div className="mod-detail-card p-4">
      <h3 className="text-sm font-bold text-muted-foreground mb-3 px-3">معلومات التعريب</h3>
      <div className="divide-y divide-border/50">
        <InfoRow
          icon={<Gamepad2 className="h-4 w-4" />}
          iconColor="bg-blue-500/10 text-blue-500"
          label="العنوان"
          value={mod.game.name}
        />
        {mod.arabicTitle && mod.arabicTitle.trim() !== '' && (
          <InfoRow
            icon={<Languages className="h-4 w-4" />}
            iconColor="bg-emerald-500/10 text-emerald-500"
            label="العنوان بالعربي"
            value={mod.arabicTitle}
          />
        )}
        <InfoRow
          icon={<Shield className="h-4 w-4" />}
          iconColor="bg-primary/10 text-primary"
          label="طريقة التعريب"
          value={mod.translationType || 'غير محدد'}
        />
        {mod.translationScope && mod.translationScope.trim() !== '' && (
          <InfoRow
            icon={<Globe className="h-4 w-4" />}
            iconColor="bg-sky-500/10 text-sky-500"
            label="نوع التعريب"
            value={mod.translationScope}
          />
        )}
        {mod.version && (
          <InfoRow
            icon={<Tag className="h-4 w-4" />}
            iconColor="bg-amber-500/10 text-amber-500"
            label="إصدار التعريب"
            value={`v${mod.version}`}
          />
        )}
        {mod.compatibility && mod.compatibility.trim() !== '' && (
          <InfoRow
            icon={<CheckCircle className="h-4 w-4" />}
            iconColor="bg-teal-500/10 text-teal-500"
            label="توافق التعريب"
            value={mod.compatibility}
          />
        )}
        {mod.fileSize && mod.fileSize.trim() !== '' && (
          <InfoRow
            icon={<FileArchive className="h-4 w-4" />}
            iconColor="bg-rose-500/10 text-rose-500"
            label="حجم التعريب"
            value={`${mod.fileSize} .${mod.fileFormat}`}
          />
        )}
        <InfoRow
          icon={<Calendar className="h-4 w-4" />}
          iconColor="bg-cyan-500/10 text-cyan-500"
          label="تاريخ إصدار التعريب"
          value={formatArabicDate(mod.releaseDate)}
        />
      </div>
    </div>
  )
}
