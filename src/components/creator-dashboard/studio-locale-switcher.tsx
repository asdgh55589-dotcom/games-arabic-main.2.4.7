'use client'

import { LanguagesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

/** Opt-in AR/EN switch for the creator studio (Arabic default). */
export function StudioLocaleSwitcher() {
  const { locale, dict, setLocale } = useStudioLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <LanguagesIcon className="size-4" />
          <span className="hidden sm:inline">{dict.switcher.label}</span>
          <span className="text-xs text-muted-foreground">
            {locale === 'ar' ? dict.switcher.arabic : dict.switcher.english}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale('ar')}>
          {dict.switcher.arabic}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('en')}>
          {dict.switcher.english}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
