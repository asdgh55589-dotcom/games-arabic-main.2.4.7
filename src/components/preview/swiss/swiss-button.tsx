import * as React from 'react'
import { cn } from '@/lib/utils'

type SwissButtonVariant = 'primary' | 'outline' | 'ghost'
type SwissButtonSize = 'sm' | 'md' | 'lg'

export interface SwissButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SwissButtonVariant
  size?: SwissButtonSize
  mono?: boolean
}

const variantClasses: Record<SwissButtonVariant, string> = {
  // Solid black (light) / solid white (dark) — max contrast, no color
  primary:
    'bg-[#000] text-[#fff] border border-[#000] hover:bg-[#262626] hover:border-[#262626] ' +
    'dark:bg-[#fff] dark:text-[#000] dark:border-[#fff] dark:hover:bg-[#e5e5e5] dark:hover:border-[#e5e5e5]',
  // Outlined — spec primary CTA style
  outline:
    'bg-transparent text-[#000] border border-[#000] hover:bg-[#f5f5f5] ' +
    'dark:text-[#fff] dark:border-[#fff] dark:hover:bg-[#0a0a0a]',
  // Text-only — spec secondary CTA style
  ghost:
    'bg-transparent text-[#000] border border-transparent hover:border-[#e5e5e5] hover:bg-[#f5f5f5] ' +
    'dark:text-[#fff] dark:hover:border-[#262626] dark:hover:bg-[#0a0a0a]',
}

const sizeClasses: Record<SwissButtonSize, string> = {
  sm: 'h-8 px-3 text-[12px]',
  md: 'h-10 px-4 text-[14px]',
  lg: 'h-12 px-6 text-[16px]',
}

/**
 * SwissButton — minimal button, sharp corners, 150ms transitions.
 * Variants: primary (solid) | outline | ghost (text-only).
 */
export function SwissButton({
  variant = 'outline',
  size = 'md',
  mono = false,
  className,
  type = 'button',
  ...props
}: SwissButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-none border font-medium',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000]',
        'dark:focus-visible:outline-[#fff]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variantClasses[variant],
        sizeClasses[size],
        mono && 'font-mono tracking-tight',
        className,
      )}
      {...props}
    />
  )
}
