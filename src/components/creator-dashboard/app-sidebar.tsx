"use client"

import * as React from "react"
import {
  ArrowUpCircleIcon,
  BarChartIcon,
  CameraIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

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
} from "@/components/official-ui/sidebar"

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
      icon: LayoutDashboardIcon,
    },
    {
      title: "تعريباتي",
      url: "/creator/mods",
      icon: ListIcon,
    },
    {
      title: "الإحصائيات",
      url: "/creator/stats",
      icon: BarChartIcon,
    },
    {
      title: "طلبات التعريب",
      url: "/creator/requests",
      icon: FolderIcon,
    },
    {
      title: "التعليقات",
      url: "/creator/comments",
      icon: UsersIcon,
    },
  ],
  navClouds: [
    {
      title: "التقاط",
      icon: CameraIcon,
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
      icon: FileTextIcon,
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
      icon: FileCodeIcon,
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
      icon: SettingsIcon,
    },
    {
      title: "مساعدة",
      url: "#",
      icon: HelpCircleIcon,
    },
    {
      title: "بحث",
      url: "#",
      icon: SearchIcon,
    },
  ],
  documents: [
    {
      name: "مكتبة البيانات",
      url: "#",
      icon: DatabaseIcon,
    },
    {
      name: "التقارير",
      url: "#",
      icon: ClipboardListIcon,
    },
    {
      name: "مساعد الكلمات",
      url: "#",
      icon: FileIcon,
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
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">Games Arabic</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
