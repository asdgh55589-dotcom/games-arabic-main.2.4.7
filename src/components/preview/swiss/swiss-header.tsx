'use client'

import Link from 'next/link'
import * as React from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/mods', label: 'التعريبات' },
  { href: '/games', label: 'الألعاب' },
  { href: '/news', label: 'الأخبار' },
  { href: '/series', label: 'السلاسل' },
  { href: '/teams', label: 'الفرق' },
]

/**
 * SwissHeader — minimal top bar: wordmark + index number, nav, 2 actions.
 * 1px bottom border is the only separation. No shadows.
 */
export function SwissHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-[#fff]/95 backdrop-blur-sm dark:border-[#262626] dark:bg-[#000]/95">
      <a
        href="#swiss-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-50 focus:border focus:border-[#000] focus:bg-[#fff] focus:px-3 focus:py-1 focus:text-[13px] dark:focus:border-[#fff] dark:focus:bg-[#000]"
      >
        تخطَّ إلى المحتوى
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Wordmark */}
        <Link href="/preview/swiss-home" className="group flex cursor-pointer items-baseline gap-2">
          <span className="text-[16px] font-bold tracking-tight text-[#000] dark:text-[#fff]">
            GAMES—ARABIC
          </span>
          <span className="hidden font-mono text-[11px] text-[#a3a3a3] tabular-nums sm:inline dark:text-[#525252]">
            / index 01
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-baseline gap-1.5 text-[14px] text-[#525252] underline-offset-4 transition-colors duration-150 ease-out hover:text-[#000] hover:underline dark:text-[#a3a3a3] dark:hover:text-[#fff]"
            >
              <span className="font-mono text-[10px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
                0{i + 1}
              </span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="cursor-pointer px-3 py-2 text-[14px] font-medium text-[#000] underline-offset-4 transition-colors duration-150 ease-out hover:bg-[#f5f5f5] hover:underline dark:text-[#fff] dark:hover:bg-[#0a0a0a]"
          >
            دخول
          </Link>
          <Link
            href="/register"
            className="cursor-pointer border border-[#000] px-4 py-2 text-[14px] font-medium text-[#000] transition-colors duration-150 ease-out hover:bg-[#000] hover:text-[#fff] dark:border-[#fff] dark:text-[#fff] dark:hover:bg-[#fff] dark:hover:text-[#000]"
          >
            ابدأ الترجمة
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          className={cn(
            'inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-[#e5e5e5] text-[#000]',
            'transition-colors duration-150 ease-out hover:border-[#a3a3a3] hover:bg-[#f5f5f5]',
            'dark:border-[#262626] dark:text-[#fff] dark:hover:border-[#525252] dark:hover:bg-[#0a0a0a]',
            'md:hidden',
          )}
        >
          {open ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile nav panel */}
      {open && (
        <nav
          aria-label="تنقل الجوال"
          className="border-t border-[#e5e5e5] bg-[#fff] px-4 py-2 md:hidden dark:border-[#262626] dark:bg-[#000]"
        >
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center justify-between border-b border-[#f5f5f5] py-3 text-[14px] text-[#000] last:border-0 dark:border-[#0a0a0a] dark:text-[#fff]"
            >
              {link.label}
              <span className="font-mono text-[11px] text-[#a3a3a3] tabular-nums">
                0{i + 1}
              </span>
            </Link>
          ))}
          <div className="flex gap-2 py-3">
            <Link
              href="/login"
              className="flex-1 cursor-pointer border border-[#e5e5e5] px-4 py-2 text-center text-[14px] font-medium text-[#000] dark:border-[#262626] dark:text-[#fff]"
            >
              دخول
            </Link>
            <Link
              href="/register"
              className="flex-1 cursor-pointer border border-[#000] bg-[#000] px-4 py-2 text-center text-[14px] font-medium text-[#fff] dark:border-[#fff] dark:bg-[#fff] dark:text-[#000]"
            >
              ابدأ الترجمة
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
