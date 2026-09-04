'use client'

import { ArrowLeft, Gamepad2, Layers, Monitor, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { PLATFORM_COLORS } from '@/lib/constants/platforms'

const EXPLORE_PLATFORMS = [
  {
    key: 'PC',
    label: 'PC ARABIC',
    desc: 'تعريبات ألعاب الحاسوب الشخصي',
    icon: Monitor,
    color: PLATFORM_COLORS.pc,
  },
  {
    key: 'X360',
    label: 'XBOX 360 ARABIC',
    desc: 'تعريبات ألعاب Xbox 360',
    icon: Gamepad2,
    color: PLATFORM_COLORS.xbox360,
  },
  {
    key: 'NS',
    label: 'NS ARABIC',
    desc: 'تعريبات ألعاب Nintendo Switch',
    icon: Smartphone,
    color: PLATFORM_COLORS.switch,
  },
  {
    key: 'PS5',
    label: 'PS5 ARABIC',
    desc: 'تعريبات ألعاب PlayStation 5',
    icon: Gamepad2,
    color: PLATFORM_COLORS.ps5,
  },
  {
    key: 'PS4',
    label: 'PS4 ARABIC',
    desc: 'تعريبات ألعاب PlayStation 4',
    icon: Gamepad2,
    color: PLATFORM_COLORS.ps4,
  },
  {
    key: 'PS3',
    label: 'PS3 ARABIC',
    desc: 'تعريبات ألعاب PlayStation 3',
    icon: Gamepad2,
    color: PLATFORM_COLORS.ps3,
  },
  {
    key: 'PS2',
    label: 'PS2 ARABIC',
    desc: 'تعريبات ألعاب PlayStation 2',
    icon: Gamepad2,
    color: PLATFORM_COLORS.ps2,
  },
  {
    key: 'PS1',
    label: 'PS1 ARABIC',
    desc: 'تعريبات ألعاب PlayStation الأصلي',
    icon: Gamepad2,
    color: PLATFORM_COLORS.ps1,
  },
  {
    key: 'ANDROID',
    label: 'ANDROID ARABIC',
    desc: 'تعريبات ألعاب الأندرويد',
    icon: Smartphone,
    color: PLATFORM_COLORS.android,
  },
]

export function ExplorePage() {
  useDocumentTitle('استكشاف — GAMES ARABIC')

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">استكشاف</h1>
        <p className="mt-2 text-muted-foreground">تصفّح جميع أقسام المنصات وسلاسل التعريبات</p>
      </div>

      {/* أقسام المنصات */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold">أقسام المنصات</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORE_PLATFORMS.map((p) => {
            const Icon = p.icon
            return (
              <Link key={p.key} href={`/platform/${p.key}`}>
                <Card className="group relative overflow-hidden p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                  <div
                    className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-10"
                    style={{ background: p.color }}
                  />
                  <div className="relative flex items-center gap-4">
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-none text-white shadow-lg"
                      style={{ backgroundColor: p.color }}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{p.label}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{p.desc}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* سلاسل التعريبات */}
      <section>
        <h2 className="mb-4 text-xl font-bold">سلاسل التعريبات</h2>
        <Link href="/series">
          <Card className="group flex items-center gap-4 p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-none bg-gradient-to-br from-primary to-accent text-white shadow-lg">
              <Layers className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">جميع السلاسل</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                استكشف التعريبات مصنّفة حسب السلسلة
              </p>
            </div>
            <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
          </Card>
        </Link>
      </section>
    </div>
  )
}
