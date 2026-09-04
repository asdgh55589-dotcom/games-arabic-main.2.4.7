import { Archive, CheckCircle, Eye, FileEdit, Globe, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { WORKFLOW_COLORS, WORKFLOW_LABELS, type WorkflowStatus } from '@/lib/workflow'

const STATUS_ICONS: Record<WorkflowStatus, React.ComponentType<{ className?: string }>> = {
  DRAFT: FileEdit,
  IN_REVIEW: Eye,
  APPROVED: CheckCircle,
  PUBLISHED: Globe,
  ARCHIVED: Archive,
  REJECTED: XCircle,
}

interface WorkflowStatusBadgeProps {
  status: string
  className?: string
  showIcon?: boolean
}

export function WorkflowStatusBadge({
  status,
  className,
  showIcon = true,
}: WorkflowStatusBadgeProps) {
  const s = status as WorkflowStatus
  const colors = WORKFLOW_COLORS[s] || WORKFLOW_COLORS.DRAFT
  const label = WORKFLOW_LABELS[s] || status
  const Icon = STATUS_ICONS[s] || FileEdit

  return (
    <Badge
      variant="outline"
      className={`${colors.bg} ${colors.text} ${colors.border} gap-1.5 ${className}`}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  )
}
