'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import PublishHelpPage from '@/app/admin/publish/help/page'
import TelegramPostsPage from '@/app/admin/social/telegram/posts/page'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ArchiveTab = dynamic(
  () => import('@/app/admin/social/telegram/archive/page').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading…</div> },
)
const ScheduleTab = dynamic(
  () => import('@/app/admin/publish/schedule/page').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading…</div> },
)
const ErrorsTab = dynamic(
  () => import('@/app/admin/publish/errors/page').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading…</div> },
)
const NewPostModal = dynamic(
  () => import('@/components/admin/media/NewPostModal').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading…</div> },
)

// Role: managerOnly
export interface PublishHubClientProps {
  initialTab?: string
}

export default function PublishHubClient({ initialTab }: PublishHubClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState((initialTab || 'posts').toLowerCase())
  const [newOpen, setNewOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const t = searchParams?.get('tab')
    if (t) {
      const norm = t.toLowerCase()
      if (['posts', 'archive', 'schedule', 'errors'].includes(norm)) setTab(norm)
    }
    if (searchParams?.get('new') === '1') setNewOpen(true)
    if (searchParams?.get('help') === '1') setHelpOpen(true)
  }, [searchParams])

  const openNew = () => {
    setNewOpen(true)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('new', '1')
    router.replace(`/admin/media/publish?${params.toString()}`)
  }
  const closeNew = (open: boolean) => {
    setNewOpen(open)
    if (!open) {
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.delete('new')
      router.replace(`/admin/media/publish?${params.toString()}`)
    }
  }
  const openHelp = () => {
    setHelpOpen(true)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('help', '1')
    router.replace(`/admin/media/publish?${params.toString()}`)
  }
  const closeHelp = (open: boolean) => {
    setHelpOpen(open)
    if (!open) {
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.delete('help')
      router.replace(`/admin/media/publish?${params.toString()}`)
    }
  }

  return (
    <div dir="rtl" className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Publishing Hub</h1>
        <div className="flex gap-2">
          <Button data-testid="new-post-button" onClick={openNew}>
            New Post
          </Button>
          <Button data-testid="help-button" variant="outline" onClick={openHelp}>
            Help
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="posts" data-testid="tab-posts">
            Posts
          </TabsTrigger>
          <TabsTrigger value="archive" data-testid="tab-archive">
            Archive
          </TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-schedule">
            Schedule
          </TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">
            Errors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <TelegramPostsPage />
        </TabsContent>
        <TabsContent value="archive">
          <ArchiveTab />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab />
        </TabsContent>
        <TabsContent value="errors">
          <div className="space-y-2">
            <Button data-testid="help-button-errors" variant="outline" onClick={openHelp}>
              Help
            </Button>
            <ErrorsTab />
          </div>
        </TabsContent>
      </Tabs>

      {newOpen ? <NewPostModal open={newOpen} onOpenChange={closeNew} /> : null}

      <Sheet open={helpOpen} onOpenChange={closeHelp}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Help</SheetTitle>
          </SheetHeader>
          <div className="overflow-auto p-4">
            <PublishHelpPage />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export { PublishHubClient }
