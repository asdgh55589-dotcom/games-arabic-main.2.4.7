'use client'

import Link from 'next/link'
import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function ComingSoonPage({ title }: { title: string }) {
  const display = title.charAt(0).toUpperCase() + title.slice(1).replace(/-/g, ' ')
  useDocumentTitle(display)
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
        <Construction className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{display}</h1>
      <p className="mt-3 text-muted-foreground">
        This section is coming soon. We&apos;re working hard to bring you new features for the
        community. In the meantime, browse mods or explore games.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild>
          <Link href="/games">Browse Games</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Trending Mods</Link>
        </Button>
      </div>
    </div>
  )
}
