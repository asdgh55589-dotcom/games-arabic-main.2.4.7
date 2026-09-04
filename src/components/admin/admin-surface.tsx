import * as React from 'react'

import { cn } from '@/lib/utils'

interface AdminSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean
}

export function AdminSurface({ className, glow = false, children, ...props }: AdminSurfaceProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md',
        glow &&
          'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(26,187,156,0.06),transparent_30%),radial-gradient(circle_at_left,rgba(66,153,225,0.04),transparent_28%)] before:pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
