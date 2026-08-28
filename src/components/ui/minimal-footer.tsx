'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSettings } from '@/contexts/settings-context'

interface SectionItem {
  id: string
  slug: string
  name: string
  nameEn: string
  key: string
  icon: string
  color: string
  order: number
}

const FALLBACK_SECTIONS: SectionItem[] = [
  { id: '1', slug: 'pc', name: 'PC ARABIC', nameEn: 'PC Arabic', key: 'PC', icon: 'PcIcon', color: '#66c0f4', order: 1 },
  { id: '2', slug: 'xbox-360', name: 'XBOX 360 ARABIC', nameEn: 'Xbox 360 Arabic', key: 'X360', icon: 'Xbox360Icon', color: '#107C10', order: 2 },
  { id: '3', slug: 'ns', name: 'NS ARABIC', nameEn: 'NS Arabic', key: 'NS', icon: 'NintendoSwitchIcon', color: '#E60012', order: 3 },
  { id: '4', slug: 'ps4', name: 'PS4 ARABIC', nameEn: 'PS4 Arabic', key: 'PS4', icon: 'PlayStationIcon', color: '#0070D1', order: 4 },
  { id: '5', slug: 'ps3', name: 'PS3 ARABIC', nameEn: 'PS3 Arabic', key: 'PS3', icon: 'PlayStationIcon', color: '#06b6d4', order: 5 },
  { id: '6', slug: 'ps2', name: 'PS2 ARABIC', nameEn: 'PS2 Arabic', key: 'PS2', icon: 'PlayStationIcon', color: '#6366f1', order: 6 },
  { id: '7', slug: 'ps1', name: 'PS1 ARABIC', nameEn: 'PS1 Arabic', key: 'PS1', icon: 'PlayStationIcon', color: '#94a3b8', order: 7 },
  { id: '8', slug: 'ps5', name: 'PS5 ARABIC', nameEn: 'PS5 Arabic', key: 'PS5', icon: 'PlayStationIcon', color: '#0E6FFF', order: 8 },
  { id: '9', slug: 'android', name: 'ANDROID ARABIC', nameEn: 'Android Arabic', key: 'ANDROID', icon: 'Smartphone', color: '#3DDC84', order: 9 },
]

// Helper to generate support / problems labels per platform
function supportLabel(s: SectionItem) {
  // short label: دعم PC / دعم PS1 etc
  // Use key for brevity, but show name if needed
  const short = s.key === 'X360' ? 'XBOX 360' : s.key === 'NS' ? 'NS' : s.key
  return `دعم ${short}`
}
function problemsLabel(s: SectionItem) {
  const short = s.key === 'X360' ? 'XBOX 360' : s.key === 'NS' ? 'NS' : s.key
  return `مشاكل ${short}`
}

export function MinimalFooter() {
  const { settings } = useSettings()
  const siteName = settings.site_name || 'GAMES ARABIC'
  const [sections, setSections] = useState<SectionItem[]>(FALLBACK_SECTIONS)

  useEffect(() => {
    fetch('/api/sections')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          const sorted = [...json.data].sort((a: SectionItem, b: SectionItem) => (a.order ?? 0) - (b.order ?? 0))
          setSections(sorted)
        }
      })
      .catch(() => {})
  }, [])

  const nameParts = siteName.split(' ')

  return (
    <footer className="mt-auto border-t border-border bg-card/30" dir="rtl">
      <div className="mx-auto max-w-[1600px] px-4 py-10">
        {/* Primary grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-7">
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

          {/* 1 - الأقسام (primary) */}
          <div>
            <h3 className="text-xs font-bold tracking-wider text-foreground">الأقسام</h3>
            <ul className="mt-3 space-y-2">
              {sections.map((s) => (
                <FooterLink key={s.id} href={`/platform/${s.key}`}>
                  {s.name}
                </FooterLink>
              ))}
            </ul>
          </div>

          {/* 2 - استكشاف (primary) */}
          <FooterCol title="استكشاف">
            <FooterLink href="/series">سلاسل التعريبات</FooterLink>
            <FooterLink href="/teams">الفرق</FooterLink>
          </FooterCol>

          {/* 3 - دعم الأقسام (primary) - كل منصة لوحدها + السلاسل والفرق */}
          <FooterCol title="دعم الأقسام">
            {sections.map((s) => (
              <FooterLink key={`support-${s.id}`} href={`/support?platform=${s.key}`}>
                {supportLabel(s)}
              </FooterLink>
            ))}
            <FooterLink href="/support?section=series">دعم السلاسل</FooterLink>
            <FooterLink href="/support?section=teams">دعم الفرق</FooterLink>
          </FooterCol>

          {/* 4 - مشاكل وحلول لكل قسم (primary) */}
          <FooterCol title="مشاكل وحلول">
            {sections.map((s) => (
              <FooterLink key={`problems-${s.id}`} href={`/problems?platform=${s.key}`}>
                {problemsLabel(s)}
              </FooterLink>
            ))}
            <FooterLink href="/problems?section=series">مشاكل السلاسل</FooterLink>
            <FooterLink href="/problems?section=teams">مشاكل الفرق</FooterLink>
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
      <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-primary">
        {children}
      </Link>
    </li>
  )
}
