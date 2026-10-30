'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import SocialChannelsPage from '@/app/admin/social/channels/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const DestinationsTab = dynamic(
  () =>
    import('@/app/admin/social/telegram/destinations/page').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading…</div> },
)
const RoutingTab = dynamic(
  () => import('@/app/admin/social/telegram/routing/page').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading…</div> },
)

function normalize(tab?: string | null): 'platforms' | 'destinations' | 'routing' {
  if (tab === 'destinations' || tab === 'routing') return tab
  return 'platforms'
}

export interface ChannelsClientProps {
  initialTab?: string
}

export default function ChannelsClient({ initialTab }: ChannelsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(normalize(initialTab ?? searchParams?.get('tab')))

  useEffect(() => {
    const t = searchParams?.get('tab')
    if (t) setTab(normalize(t))
  }, [searchParams])

  const handleTabChange = (v: string) => {
    const nt = normalize(v)
    setTab(nt)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('tab', nt)
    router.replace(`/admin/media/channels?${params.toString()}`)
  }

  return (
    <div dir="rtl" className="space-y-4">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="platforms" data-testid="tab-platforms">
            Platforms
          </TabsTrigger>
          <TabsTrigger value="destinations" data-testid="tab-destinations">
            Destinations
          </TabsTrigger>
          <TabsTrigger value="routing" data-testid="tab-routing">
            Routing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="platforms">
          <SocialChannelsPage />
        </TabsContent>
        <TabsContent value="destinations">
          <DestinationsTab />
        </TabsContent>
        <TabsContent value="routing">
          <RoutingTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { ChannelsClient }
