'use client'

import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

interface TierHistoryEntry {
  id: string
  fromTier: number
  toTier: number
  reason: string
  notes?: string
  createdAt: string
  user?: { username: string; avatarUrl?: string }
}

const TIER_NAMES: Record<number, string> = {
  0: 'مبتدئ',
  1: 'مترجم',
  2: 'محترف',
  3: 'خبير',
  4: 'مشرف',
  5: 'مدير',
}

const REASON_LABELS: Record<string, string> = {
  auto: 'تلقائي',
  manual: 'يدوي',
  admin: 'إداري',
}

interface TierHistoryTableProps {
  history: TierHistoryEntry[]
  showUser?: boolean
}

export function TierHistoryTable({ history, showUser = false }: TierHistoryTableProps) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">لا يوجد سجل ترقيات</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {showUser && <th className="px-4 py-2 text-right">المستخدم</th>}
            <th className="px-4 py-2 text-right">من</th>
            <th className="px-4 py-2 text-right">إلى</th>
            <th className="px-4 py-2 text-right">السبب</th>
            <th className="px-4 py-2 text-right">ملاحظات</th>
            <th className="px-4 py-2 text-right">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id} className="border-b hover:bg-muted/50">
              {showUser && (
                <td className="px-4 py-2">
                  <div className="font-medium">{entry.user?.username}</div>
                </td>
              )}
              <td className="px-4 py-2">{TIER_NAMES[entry.fromTier]}</td>
              <td className="px-4 py-2">
                <span className="font-medium text-green-600">{TIER_NAMES[entry.toTier]}</span>
              </td>
              <td className="px-4 py-2">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                  {REASON_LABELS[entry.reason] || entry.reason}
                </span>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{entry.notes || '-'}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {format(new Date(entry.createdAt), 'PPP HH:mm', { locale: ar })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
