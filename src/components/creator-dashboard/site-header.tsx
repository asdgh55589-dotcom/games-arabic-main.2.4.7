'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  BellIcon,
  BookOpenIcon,
  LogOutIcon,
  SettingsIcon,
  UserCircleIcon,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { StudioLocaleSwitcher } from "@/components/creator-dashboard/studio-locale-switcher"
import { StudioThemeSwitcher } from "@/components/creator-dashboard/studio-theme-switcher"
import { useStudioLanguage } from "@/lib/studio-i18n/context"

export function SiteHeader() {
  const { dict } = useStudioLanguage()
  const { user, logout } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/notifications/unread-count", { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setUnread(Number(json?.data?.count ?? json?.count ?? 0))
      } catch {
        // ignore
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const initial = (user?.username || "?").trim().charAt(0).toUpperCase() || "–"

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ms-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{dict.header.dashboard}</h1>
        <div className="ms-auto flex items-center gap-2">
          <Link href="/notifications" className="relative inline-flex">
            <Button variant="ghost" size="icon" aria-label={dict.header.notifications}>
              <BellIcon className="size-4" />
            </Button>
            {unread > 0 && (
              <span className="absolute -top-0.5 -end-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <StudioLocaleSwitcher />
          <StudioThemeSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={dict.header.userMenu}>
                {user?.avatarUrl ? (
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.avatarUrl} alt={user.username} />
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                ) : (
                  <UserCircleIcon className="size-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              {user && (
                <>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col">
                      <span className="truncate font-medium">{user.username}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/creator/settings">
                  <SettingsIcon />
                  {dict.header.settings}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/creator/docs">
                  <BookOpenIcon />
                  {dict.header.help}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                <LogOutIcon />
                {dict.header.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
