'use client'

import Link from 'next/link'
import { useSettings } from '@/contexts/settings-context'

export function MinimalFooter() {
  const { settings } = useSettings()
  const siteName = settings.site_name || 'GAMES ARABIC'

  const nameParts = siteName.split(' ')

  return (
    <footer className="mt-auto border-t border-border bg-card/30" dir="rtl">
      <div className="mx-auto max-w-[1600px] px-4 py-10">
        {/* Primary grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4">
          {/* Brand - spans 2 on large */}
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-1">
              <span className="text-lg font-extrabold tracking-tight">
                <span className="text-gradient">{nameParts[0] || 'GAMES'}</span>
                <span className="text-foreground"> {nameParts.slice(1).join(' ') || 'ARABIC'}</span>
              </span>
            </Link>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              تعريب وأرشفة الألعاب العربية لكل المنصات
            </p>
            <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-muted-foreground/80">
              تصفح التعريبات حسب المنصة، وابحث عن سلسلتك المفضلة أو فريق الترجمة.
            </p>
          </div>

          {/* 1 - استكشاف (primary) */}
          <FooterCol title="استكشاف">
            <FooterLink href="/docs">دعم الأقسام</FooterLink>
            <FooterLink href="/docs?cat=problems">مشاكل وحلول</FooterLink>
            <FooterLink href="/explore">الأقسام</FooterLink>
          </FooterCol>

          {/* 5 - حول (primary) */}
          <FooterCol title="حول">
            <FooterLink href="/about">من نحن</FooterLink>
            <FooterLink href="/terms">شروط الخدمة</FooterLink>
            <FooterLink href="/privacy">سياسة الخصوصية</FooterLink>
          </FooterCol>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 md:flex-row">
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} {siteName} — صُنع في مصر ❤️
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            جميع الحقوق محفوظة — تعريب الألعاب للجميع
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold tracking-wider text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        {children}
      </Link>
    </li>
  )
}
