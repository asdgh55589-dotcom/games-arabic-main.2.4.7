'use client'

import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Settings,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { CreatorBadge } from '@/components/creator-badge'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface CreatorSidebarProps {
  user: {
    username: string
    avatarUrl: string | null
    role: string
    tier: number
    specialRoles: string | null
  }
}

const NAV_ITEMS = [
  { href: '/creator', label: 'لوحة التحكم', icon: LayoutDashboard, exact: true },
  { href: '/creator/mods', label: 'تعريباتي', icon: Package },
  { href: '/creator/mods/new', label: 'تعريب جديد', icon: Plus },
  { href: '/creator/comments', label: 'التعليقات', icon: MessageSquare },
  { href: '/creator/stats', label: 'الإحصائيات', icon: BarChart3 },
  { href: '/creator/requests', label: 'طلبات التعريب', icon: Inbox },
  { href: '/creator/settings', label: 'الإعدادات', icon: Settings },
]

export function CreatorSidebar({ user }: CreatorSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* User info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatarUrl || undefined} />
            <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{user.username}</span>
            </div>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <RoleBadge role={user.role} size="sm" />
              <TierBadge role={user.role} tier={user.tier} size="sm" />
              <CreatorBadge role={user.role} specialRoles={user.specialRoles} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Back to site */}
      <div className="p-4 border-t">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← العودة للموقع
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-l bg-card flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <button
        className="md:hidden fixed bottom-4 right-4 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 bg-card shadow-xl flex flex-col">
            <button
              className="absolute top-4 left-4 p-1 rounded hover:bg-muted"
              onClick={() => setMobileOpen(false)}
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="pt-10 flex-1 flex flex-col overflow-hidden">{sidebarContent}</div>
          </div>
        </div>
      )}
    </>
  )
}
