"use client"

import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/creator-dashboard/nav-documents"
import { NavMain } from "@/components/creator-dashboard/nav-main"
import { NavSecondary } from "@/components/creator-dashboard/nav-secondary"
import { NavUser } from "@/components/creator-dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "لوحة التحكم",
      url: "/creator",
      icon: IconDashboard,
    },
    {
      title: "تعريباتي",
      url: "/creator/mods",
      icon: IconListDetails,
    },
    {
      title: "الإحصائيات",
      url: "/creator/stats",
      icon: IconChartBar,
    },
    {
      title: "طلبات التعريب",
      url: "/creator/requests",
      icon: IconFolder,
    },
    {
      title: "التعليقات",
      url: "/creator/comments",
      icon: IconUsers,
    },
  ],
  navClouds: [
    {
      title: "التقاط",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "مقترحات نشطة",
          url: "#",
        },
        {
          title: "الأرشيف",
          url: "#",
        },
      ],
    },
    {
      title: "مقترح",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "مقترحات نشطة",
          url: "#",
        },
        {
          title: "الأرشيف",
          url: "#",
        },
      ],
    },
    {
      title: "توجيهات",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "مقترحات نشطة",
          url: "#",
        },
        {
          title: "الأرشيف",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "الإعدادات",
      url: "/creator/settings",
      icon: IconSettings,
    },
    {
      title: "مساعدة",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "بحث",
      url: "#",
      icon: IconSearch,
    },
  ],
  documents: [
    {
      name: "مكتبة البيانات",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "التقارير",
      url: "#",
      icon: IconReport,
    },
    {
      name: "مساعد الكلمات",
      url: "#",
      icon: IconFileWord,
    },
  ],
}

export function AppSidebar({
  user = data.user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar: string }
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
              <a href="#">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Games Arabic</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
