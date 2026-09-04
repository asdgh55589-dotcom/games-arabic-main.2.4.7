'use client'

import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'
import { ChevronRight, Clock, History, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRoleLabel } from '@/lib/roles'

interface Actor {
  id: string
  username: string
  role: string
}

interface HistoryEntry {
  id: string
  fromStatus: string | null
  toStatus: string
  action: string | null
  resolution: string | null
  actor: Actor | null
  createdAt: string | Date
}

interface Props {
  history: HistoryEntry[]
}

const STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  under_review: 'قيد المراجعة',
  confirmed: 'مؤكد',
  rejected: 'مرفوض',
  pending: 'معلق',
  resolved: 'تم الحل',
  reopened: 'أعيد فتحه',
}

const ACTION_LABELS: Record<string, string> = {
  none: 'بدون إجراء',
  warned: 'تحذير',
  content_hidden: 'إخفاء المحتوى',
  content_deleted: 'حذف المحتوى',
  temp_ban: 'تعليق مؤقت',
  perm_ban: 'حظر دائم',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  under_review:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  confirmed:
    'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  rejected:
    'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  pending:
    'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
  resolved:
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
  reopened:
    'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
}

export function ReportHistoryTimeline({ history }: Props) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            سجل التغييرات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سجل تغييرات</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          سجل التغييرات
          <Badge variant="secondary">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* خط الزمن العمودي */}
          <div className="absolute right-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {history.map((entry) => (
            <div key={entry.id} className="relative flex gap-4">
              {/* نقطة الزمن */}
              <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-blue-500 shrink-0 dark:bg-gray-900">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>

              {/* المحتوى */}
              <div className="flex-1 pb-2 min-w-0">
                {/* انتقال الحالة */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {entry.fromStatus ? (
                    <>
                      <Badge variant="outline" className={STATUS_COLORS[entry.fromStatus] || ''}>
                        {STATUS_LABELS[entry.fromStatus] || entry.fromStatus}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">إنشاء</span>
                  )}

                  <Badge className={STATUS_COLORS[entry.toStatus] || ''}>
                    {STATUS_LABELS[entry.toStatus] || entry.toStatus}
                  </Badge>

                  {entry.action && (
                    <Badge variant="secondary" className="gap-1">
                      ⚡ {ACTION_LABELS[entry.action] || entry.action}
                    </Badge>
                  )}
                </div>

                {/* ملاحظات الحل */}
                {entry.resolution && (
                  <p className="text-sm text-muted-foreground mb-2 pr-2 border-r-2 border-gray-200 dark:border-gray-700">
                    📝 {entry.resolution}
                  </p>
                )}

                {/* الممثل + الوقت */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {entry.actor && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {entry.actor.username}
                      <Badge variant="outline" className="text-[10px] py-0 px-1">
                        {getRoleLabel(entry.actor.role)}
                      </Badge>
                    </span>
                  )}
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(entry.createdAt), {
                      addSuffix: true,
                      locale: ar,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
