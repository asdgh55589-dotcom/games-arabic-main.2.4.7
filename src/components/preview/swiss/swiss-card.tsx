import Link from 'next/link'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwissCardProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  category?: string
  date?: string
  stat?: string
  href?: string
  index?: string
  actionLabel?: string
}

/**
 * SwissCard — reusable bordered card.
 * Hover: border emphasis + subtle background shift, 150ms.
 * No thumbnails by design (typography is the content).
 */
export function SwissCard({
  title,
  category,
  date,
  stat,
  href,
  index,
  actionLabel,
  className,
  children,
  ...props
}: SwissCardProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {index && (
            <span className="font-mono text-[11px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
              {index}
            </span>
          )}
          {category && (
            <span className="inline-flex items-center rounded-[2px] border border-[#e5e5e5] px-2 py-0.5 text-[12px] font-medium text-[#525252] dark:border-[#262626] dark:text-[#a3a3a3]">
              {category}
            </span>
          )}
        </div>
        {date && (
          <time className="font-mono text-[11px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
            {date}
          </time>
        )}
      </div>

      <h3 className="mt-3 text-[16px] leading-7 font-semibold text-[#000] dark:text-[#fff]">
        {title}
      </h3>

      {children && (
        <div className="mt-2 text-[14px] leading-7 text-[#525252] dark:text-[#a3a3a3]">
          {children}
        </div>
      )}

      {(stat || actionLabel) && (
        <div className="mt-4 flex items-center justify-between border-t border-[#e5e5e5] pt-3 dark:border-[#262626]">
          {stat ? (
            <span className="font-mono text-[12px] text-[#525252] tabular-nums dark:text-[#a3a3a3]">
              {stat}
            </span>
          ) : (
            <span />
          )}
          {actionLabel && (
            <span className="text-[13px] font-medium text-[#000] underline-offset-4 group-hover:underline dark:text-[#fff]">
              {actionLabel}
            </span>
          )}
        </div>
      )}
    </>
  )

  const shell = cn(
    'group block rounded-none border border-[#e5e5e5] bg-[#fff] p-4',
    'transition-colors duration-150 ease-out',
    'hover:border-[#a3a3a3] hover:bg-[#f5f5f5]',
    'dark:border-[#262626] dark:bg-[#000] dark:hover:border-[#525252] dark:hover:bg-[#0a0a0a]',
    href && 'cursor-pointer',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={shell} {...props}>
        {inner}
      </Link>
    )
  }

  return (
    <article className={shell} {...props}>
      {inner}
    </article>
  )
}
