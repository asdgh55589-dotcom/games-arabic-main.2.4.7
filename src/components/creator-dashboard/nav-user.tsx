"use client"

import Link from 'next/link'
import {
  Bell,
  EllipsisVertical,
  LogOut,
  Settings,
  UserRound,
} from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={`الصورة الرمزية لـ ${user.name}`} />
                <AvatarFallback className="rounded-lg">
                  {user.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-right text-sm leading-tight">
                <span className="truncate font-medium">
                  <bdi>{user.name}</bdi>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <bdi>{user.email}</bdi>
                </span>
              </div>
              <EllipsisVertical className="ms-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-right text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={`الصورة الرمزية لـ ${user.name}`} />
                  <AvatarFallback className="rounded-lg">
                    {user.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-right text-sm leading-tight">
                  <span className="truncate font-medium">
                    <bdi>{user.name}</bdi>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    <bdi>{user.email}</bdi>
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings?section=profile">
                  <UserRound aria-hidden="true" />
                  حسابي
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/creator/settings">
                  <Settings aria-hidden="true" />
                  إعدادات لوحة التحكم
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notifications">
                  <Bell aria-hidden="true" />
                  الإشعارات
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST' })
                } catch (err) {
                  console.error('[creator-dashboard] logout failed:', err)
                } finally {
                  window.location.href = '/'
                }
              }}
            >
              <LogOut aria-hidden="true" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
