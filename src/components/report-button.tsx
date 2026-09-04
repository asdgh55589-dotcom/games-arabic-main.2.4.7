'use client'

import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportDialog } from '@/components/report-dialog'
import type { ReportTargetType } from '@/lib/reports/constants'

interface ReportButtonProps {
  targetType: ReportTargetType
  targetId: string
  variant?: 'ghost' | 'outline' | 'link'
  size?: 'sm' | 'default' | 'lg'
  onReported?: () => void
}

export function ReportButton({
  targetType,
  targetId,
  variant = 'ghost',
  size = 'sm',
  onReported,
}: ReportButtonProps) {
  return (
    <ReportDialog targetType={targetType} targetId={targetId} onSuccess={onReported}>
      <Button
        variant={variant}
        size={size}
        className="gap-2 text-muted-foreground hover:text-destructive"
      >
        <Flag className="h-4 w-4" />
        إبلاغ
      </Button>
    </ReportDialog>
  )
}
