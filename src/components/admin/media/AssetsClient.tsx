'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import TelegramTemplatesPage from '@/app/admin/social/telegram/templates/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TemplatesArchivePage = dynamic(
  () =>
    import('@/app/admin/social/telegram/templates/archive/page').then((m) => ({
      default: m.default,
    })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading…</div> },
)

export default function AssetsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams?.get('tab') === 'archived' ? 'archived' : 'active')

  useEffect(() => {
    const t = searchParams?.get('tab')
    if (t === 'archived' || t === 'active') setTab(t)
  }, [searchParams])

  const handleTabChange = (v: string) => {
    setTab(v)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('tab', v)
    router.replace(`/admin/media/assets?${params.toString()}`)
  }

  return (
    <div dir="rtl" className="space-y-4">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="active" data-testid="tab-active">
            Active
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived">
            Archived
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <TelegramTemplatesPage />
        </TabsContent>
        <TabsContent value="archived">
          <TemplatesArchivePage />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { AssetsClient }
