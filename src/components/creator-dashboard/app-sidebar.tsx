'use client'

import Link from 'next/link'
import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Package,
  Plus,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { NavMain } from '@/components/creator-dashboard/nav-main'
import { NavSecondary } from '@/components/creator-dashboard/nav-secondary'
import { NavUser } from '@/components/creator-dashboard/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export interface CreatorNavItem {
  title: string
  url: string
  icon: LucideIcon
}

const navMain: CreatorNavItem[] = [
  { title: 'لوحة التحكم', url: '/creator', icon: LayoutDashboard },
  { title: 'تعريباتي', url: '/creator/mods', icon: Package },
  { title: 'تعريب جديد', url: '/creator/mods/new', icon: Plus },
  { title: 'التعليقات', url: '/creator/comments', icon: MessageSquare },
  { title: 'الإحصائيات', url: '/creator/stats', icon: BarChart3 },
  { title: 'طلبات التعريب', url: '/creator/requests', icon: Inbox },
]

const navSecondary: CreatorNavItem[] = [
  { title: 'الإعدادات', url: '/creator/settings', icon: Settings },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string }
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/creator">
                <LayoutDashboard className="size-5!" aria-hidden="true" />
                <span className="text-base font-semibold">لوحة المُعَرِّب</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
