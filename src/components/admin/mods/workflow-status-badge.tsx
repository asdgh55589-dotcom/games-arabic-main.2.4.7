import { Badge } from '@/components/ui/badge'
import { WORKFLOW_LABELS, WORKFLOW_COLORS, type WorkflowStatus } from '@/lib/workflow'
import { FileEdit, Eye, CheckCircle, Globe, Archive, XCircle } from 'lucide-react'

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
