import Link from 'next/link'

const COLS = [
  {
    title: 'المنصة',
    links: [
      { href: '/mods', label: 'التعريبات' },
      { href: '/games', label: 'الألعاب' },
      { href: '/news', label: 'الأخبار' },
      { href: '/series', label: 'السلاسل' },
    ],
  },
  {
    title: 'المجتمع',
    links: [
      { href: '/teams', label: 'الفرق' },
      { href: '/leaderboard', label: 'المتصدرون' },
      { href: '/guidelines', label: 'معايير الترجمة' },
      { href: '/apply', label: 'انضم كمترجم' },
    ],
  },
  {
    title: 'الدعم',
    links: [
      { href: '/help', label: 'المساعدة' },
      { href: '/contact', label: 'اتصل بنا' },
      { href: '/privacy', label: 'الخصوصية' },
      { href: '/terms', label: 'الشروط' },
    ],
  },
]

const SOCIALS = [
  { href: 'https://x.com/GamesArabic', label: 'X / Twitter' },
  { href: 'https://tiktok.com/@gamesarabic', label: 'TikTok' },
  { href: 'https://t.me/gamesarabic', label: 'Telegram' },
  { href: 'https://youtube.com/@gamesarabic', label: 'YouTube' },
]

/**
 * SwissFooter — minimal link columns + text socials + mono copyright bar.
 * No newsletter, no heavy sections. Borders do the structuring.
 */
export function SwissFooter() {
  return (
    <footer className="border-t border-[#e5e5e5] bg-[#fff] dark:border-[#262626] dark:bg-[#000]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand cell */}
          <div className="col-span-2">
            <p className="text-[16px] font-bold tracking-tight text-[#000] dark:text-[#fff]">
              GAMES—ARABIC
            </p>
            <p className="mt-3 max-w-xs text-[13px] leading-6 text-[#525252] dark:text-[#a3a3a3]">
              منصة مجتمع مفتوحة لتعريب الألعاب وأرشفتها. مجاني، عربي أولًا،
              وبلا زخرفة.
            </p>
            <p className="mt-4 font-mono text-[11px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
              build 2026.09.18 — stable
            </p>
          </div>

          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="font-mono text-[11px] font-medium tracking-widest text-[#a3a3a3] uppercase dark:text-[#525252]">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="cursor-pointer text-[14px] text-[#525252] underline-offset-4 transition-colors duration-150 ease-out hover:text-[#000] hover:underline dark:text-[#a3a3a3] dark:hover:text-[#fff]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-4 border-t border-[#e5e5e5] pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-[#262626]">
          <p className="font-mono text-[12px] text-[#525252] tabular-nums dark:text-[#a3a3a3]">
            © 2026 Games Arabic — جميع التعريبات لأصحابها.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer font-mono text-[12px] text-[#525252] underline-offset-4 transition-colors duration-150 ease-out hover:text-[#000] hover:underline dark:text-[#a3a3a3] dark:hover:text-[#fff]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
