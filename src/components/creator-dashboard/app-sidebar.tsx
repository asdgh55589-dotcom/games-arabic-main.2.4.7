"use client"

import * as React from "react"
import {
  ArrowUpCircleIcon,
  BarChartIcon,
  BookOpenIcon,
  FolderIcon,
  HeartIcon,
  LayoutDashboardIcon,
  ListIcon,
  NewspaperIcon,
  SettingsIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "lucide-react"

import { NavMain } from "@/components/creator-dashboard/nav-main"
import { NavSecondary } from "@/components/creator-dashboard/nav-secondary"
import { NavUser } from "@/components/creator-dashboard/nav-user"
import { canPublishNews } from "@/lib/permissions"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/official-ui/sidebar"
import { useStudioLanguage } from "@/lib/studio-i18n/context"

export function AppSidebar({
  user = { name: "", email: "", avatar: "" },
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar: string; role?: string }
}) {
  const { dict } = useStudioLanguage()

  const navMain = [
    { title: dict.nav.dashboard, url: "/creator", icon: LayoutDashboardIcon },
    { title: dict.nav.myMods, url: "/creator/mods", icon: ListIcon },
    { title: dict.nav.myTeam, url: "/creator/team", icon: UsersIcon },
    { title: dict.nav.stats, url: "/creator/stats", icon: BarChartIcon },
    { title: dict.nav.requests, url: "/creator/requests", icon: FolderIcon },
    { title: dict.nav.comments, url: "/creator/comments", icon: UsersIcon },
    { title: dict.nav.likes, url: "/creator/likes", icon: HeartIcon },
    // Track gate (Phase 4): news authoring is publisher-only — translators
    // don't see the item (API + page + proxy enforce the same rule).
    ...(canPublishNews(user.role)
      ? [{ title: dict.nav.news, url: "/creator/news", icon: NewspaperIcon }]
      : []),
    { title: dict.nav.reports, url: "/creator/reports", icon: ShieldAlertIcon },
    { title: "الدليل", url: "/creator/docs", icon: BookOpenIcon },
  ]
  const navSecondary = [
    { title: dict.nav.settings, url: "/creator/settings", icon: SettingsIcon },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/creator">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">{dict.common.brand}</span>
              </a>
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
