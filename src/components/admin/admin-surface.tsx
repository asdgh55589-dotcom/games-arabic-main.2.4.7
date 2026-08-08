import * as React from 'react'

import { cn } from '@/lib/utils'

interface AdminSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean
}

export function AdminSurface({
  className,
  glow = false,
  children,
  ...props
}: AdminSurfaceProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[30px] border border-white/10 bg-[#111214]/90',
        glow &&
          'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(255,180,70,0.12),transparent_30%),radial-gradient(circle_at_left,rgba(120,80,255,0.06),transparent_28%)] before:pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
