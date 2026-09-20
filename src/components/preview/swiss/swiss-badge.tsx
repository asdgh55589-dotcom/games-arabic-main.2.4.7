import * as React from 'react'
import { cn } from '@/lib/utils'

type SwissBadgeVariant = 'default' | 'outline' | 'mono'

export interface SwissBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: SwissBadgeVariant
}

/**
 * SwissBadge — status / category badge.
 * Sharp 2px radius max, monochrome, tabular numbers for counts.
 */
export function SwissBadge({
  variant = 'outline',
  className,
  ...props
}: SwissBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 text-[12px] leading-5 font-medium whitespace-nowrap',
        variant === 'default' &&
          'border-[#000] bg-[#000] text-[#fff] dark:border-[#fff] dark:bg-[#fff] dark:text-[#000]',
        variant === 'outline' &&
          'border-[#e5e5e5] bg-transparent text-[#525252] dark:border-[#262626] dark:text-[#a3a3a3]',
        variant === 'mono' &&
          'border-[#e5e5e5] bg-[#f5f5f5] font-mono text-[11px] text-[#525252] tabular-nums dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#a3a3a3]',
        className,
      )}
      {...props}
    />
  )
}
