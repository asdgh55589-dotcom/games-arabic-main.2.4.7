'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { ChevronDown, BookOpen, Wrench, Info } from 'lucide-react'
import { SupportPage } from '@/views/support'
import { ProblemsPage } from '@/views/problems'
import { ExplorePage } from '@/views/explore'
import { AboutPage } from '@/views/about'
import { TermsPage } from '@/views/terms'
import { PrivacyPage } from '@/views/privacy'

const PLATFORMS = [
  { key: 'PC', label: 'PC' },
  { key: 'X360', label: 'XBOX 360' },
  { key: 'NS', label: 'NS' },
  { key: 'PS4', label: 'PS4' },
  { key: 'PS3', label: 'PS3' },
  { key: 'PS2', label: 'PS2' },
  { key: 'PS1', label: 'PS1' },
  { key: 'PS5', label: 'PS5' },
  { key: 'ANDROID', label: 'ANDROID' },
]

export function DocsPage() {
  useDocumentTitle('الوثائق — GAMES ARABIC')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const VALID_CATS = ['support', 'problems', 'explore', 'about', 'terms', 'privacy']
  const urlCatRaw = searchParams.get('cat') || 'support'
  const urlP = searchParams.get('p') || 'PC'

  const [cat, setCat] = useState(VALID_CATS.includes(urlCatRaw) ? urlCatRaw : 'support')
  const [p, setP] = useState(PLATFORMS.some((x) => x.key === urlP) ? urlP : 'PC')
  const [open, setOpen] = useState<Record<string, boolean>>({ support: true, problems: true, general: true })

  const platformLabel = PLATFORMS.find((x) => x.key === p)?.label || p

  function select(nextCat: string, nextP: string) {
    setCat(nextCat)
    setP(nextP)
    router.replace(`${pathname}?cat=${nextCat}&p=${nextP}`, { scroll: false })
  }

  const CAT_LABELS: Record<string, string> = {
    support: `دعم ${platformLabel}`,
    problems: `مشاكل وحلول ${platformLabel}`,
    explore: 'الأقسام',
    about: 'من نحن',
    terms: 'شروط الخدمة',
    privacy: 'سياسة الخصوصية',
  }
  const CAT_PARENTS: Record<string, string> = {
    support: 'دعم الأقسام',
    problems: 'مشاكل وحلول',
    explore: 'عام',
    about: 'عام',
    terms: 'عام',
    privacy: 'عام',
  }

  return (
    <div className="max-w-[1700px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span>الوثائق</span>
        <span>/</span>
        <span>{CAT_PARENTS[cat] || 'دعم الأقسام'}</span>
        <span>/</span>
        <span className="text-foreground">
          {CAT_LABELS[cat] || `دعم ${platformLabel}`}
        </span>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-64">
        <div className="rounded-lg border border-border bg-card/30 p-4 lg:sticky lg:top-20">
          <h1 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <BookOpen className="h-4 w-4 text-primary" />
            الوثائق
          </h1>

          <SidebarGroup
            icon={<BookOpen className="h-4 w-4" />}
            title="دعم الأقسام"
            open={open.support}
            onToggle={() => setOpen((o) => ({ ...o, support: !o.support }))}
          >
            {PLATFORMS.map((x) => (
              <SidebarItem
                key={`support-${x.key}`}
                active={cat === 'support' && p === x.key}
                onClick={() => select('support', x.key)}
              >
                دعم {x.label}
              </SidebarItem>
            ))}
          </SidebarGroup>

          <SidebarGroup
            icon={<Wrench className="h-4 w-4" />}
            title="مشاكل وحلول"
            open={open.problems}
            onToggle={() => setOpen((o) => ({ ...o, problems: !o.problems }))}
          >
            {PLATFORMS.map((x) => (
              <SidebarItem
                key={`problems-${x.key}`}
                active={cat === 'problems' && p === x.key}
                onClick={() => select('problems', x.key)}
              >
                مشاكل وحلول {x.label}
              </SidebarItem>
            ))}
          </SidebarGroup>

          <SidebarGroup
            icon={<Info className="h-4 w-4" />}
            title="عام"
            open={open.general}
            onToggle={() => setOpen((o) => ({ ...o, general: !o.general }))}
          >
            <SidebarItem active={cat === 'explore'} onClick={() => select('explore', 'PC')}>الأقسام</SidebarItem>
            <SidebarItem active={cat === 'about'} onClick={() => select('about', 'PC')}>من نحن</SidebarItem>
            <SidebarItem active={cat === 'terms'} onClick={() => select('terms', 'PC')}>شروط الخدمة</SidebarItem>
            <SidebarItem active={cat === 'privacy'} onClick={() => select('privacy', 'PC')}>سياسة الخصوصية</SidebarItem>
          </SidebarGroup>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {cat === 'problems' ? <ProblemsPage /> : cat === 'support' ? <SupportPage /> : cat === 'explore' ? <ExplorePage /> : cat === 'about' ? <AboutPage /> : cat === 'terms' ? <TermsPage /> : <PrivacyPage />}
      </div>
      </div>
    </div>
  )
}

function SidebarGroup({ icon, title, open, onToggle, children }: { icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-bold transition-colors hover:bg-accent"
      >
        <span className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <ul className="mt-1 space-y-0.5 pr-3">{children}</ul>}
    </div>
  )
}

function SidebarItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-md px-2 py-1.5 text-right text-xs transition-colors ${
          active ? 'bg-primary/15 font-bold text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        {children}
      </button>
    </li>
  )
}
