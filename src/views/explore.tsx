'use client'

import Link from 'next/link'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Gamepad2, Monitor, Smartphone, Layers } from 'lucide-react'

const PLATFORMS = [
  { key: 'PC', label: 'PC ARABIC', desc: 'تعريبات ألعاب الحاسوب الشخصي', icon: Monitor, color: 'from-orange-500 to-amber-600' },
  { key: 'X360', label: 'XBOX 360 ARABIC', desc: 'تعريبات ألعاب Xbox 360', icon: Gamepad2, color: 'from-green-500 to-green-700' },
  { key: 'NS', label: 'NS ARABIC', desc: 'تعريبات ألعاب Nintendo Switch', icon: Smartphone, color: 'from-red-500 to-rose-600' },
  { key: 'PS4', label: 'PS4 ARABIC', desc: 'تعريبات ألعاب PlayStation 4', icon: Gamepad2, color: 'from-blue-500 to-indigo-600' },
  { key: 'PS3', label: 'PS3 ARABIC', desc: 'تعريبات ألعاب PlayStation 3', icon: Gamepad2, color: 'from-blue-700 to-blue-900' },
  { key: 'PS2', label: 'PS2 ARABIC', desc: 'تعريبات ألعاب PlayStation 2', icon: Gamepad2, color: 'from-cyan-500 to-teal-600' },
  { key: 'PS1', label: 'PS1 ARABIC', desc: 'تعريبات ألعاب PlayStation الأصلي', icon: Gamepad2, color: 'from-slate-400 to-slate-600' },
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
          {PLATFORMS.map((p) => {
            const Icon = p.icon
            return (
              <Link key={p.key} href={`/?view=platform&platform=${p.key}`}>
                <Card className="group relative overflow-hidden p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                  <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-0 transition-opacity group-hover:opacity-10`} />
                  <div className="relative flex items-center gap-4">
                    <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${p.color} text-white shadow-lg`}>
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
        <Link href="/?view=series">
          <Card className="group flex items-center gap-4 p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
              <Layers className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">جميع السلاسل</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">استكشف التعريبات مصنّفة حسب السلسلة</p>
            </div>
            <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
          </Card>
        </Link>
      </section>
    </div>
  )
}
