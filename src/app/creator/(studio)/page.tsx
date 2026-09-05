import type { Metadata } from 'next'
import Link from 'next/link'
import { ChartAreaInteractive } from '@/components/creator-dashboard/chart-area-interactive'
import { ModsTable } from '@/components/creator-dashboard/mods-table'
import { SectionCards } from '@/components/creator-dashboard/section-cards'
import { SiteHeader } from '@/components/creator-dashboard/site-header'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'لوحة تحكم المُعَرِّب | Games Arabic',
  description: 'لوحة تحكم المُعَرِّب لإدارة التعريبات ومتابعة الأداء',
  robots: { index: false, follow: false },
}

export default function CreatorDashboard() {
  return (
    <div className="flex flex-1 flex-col" dir="rtl">
      <SiteHeader title="لوحة التحكم" />
      <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-end px-4 lg:px-6">
          <Button asChild>
            <Link href="/creator/mods/new">تعريب جديد</Link>
          </Button>
        </div>
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <div className="px-4 lg:px-6">
          <h2 className="mb-2 text-lg font-bold">أحدث التعريبات</h2>
          <ModsTable />
        </div>
      </div>
    </div>
  )
}
