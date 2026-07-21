import { REPORT_STATUSES, type ReportStatus } from '@/lib/reports/constants'

interface ReportStatusBadgeProps {
  status: ReportStatus
}

export function ReportStatusBadge({ status }: ReportStatusBadgeProps) {
  const config = REPORT_STATUSES[status]
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${config.color}`}>
      {config.label}
    </span>
  )
}
