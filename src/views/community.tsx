'use client'

import { MessageCircle, Send, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function CommunityPage() {
  useDocumentTitle('المجتمع — GAMES ARABIC')

  return (
    <div className="mx-auto max-w-[800px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">المجتمع</h1>
        <p className="mt-2 text-muted-foreground">انضم إلى مجتمع GAMES ARABIC على تليجرام</p>
      </div>

      <Card className="p-8 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-[#229ED9] shadow-lg">
          <Send className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold">جروب GAMES ARABIC</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          جروب المجتمع الرئيسي للنقاش حول التعريبات والمشاكل والحلول. يضم الجروب مواضيع منفصلة
          لمناقشة كل قسم من أقسام الموقع الستة، بالإضافة إلى تبادل الخبرات بين المستخدمين والمعربين.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="bg-[#229ED9] text-white hover:bg-[#1c8ec4]">
            <a href="https://t.me/GAMES_ARABIC" target="_blank" rel="noopener noreferrer">
              <Send className="ml-2 h-5 w-5" /> انضم للجروب
            </a>
          </Button>
        </div>
      </Card>

      {/* مميزات الجروب */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h3 className="text-sm font-bold">مجتمع نشط</h3>
          <p className="mt-1 text-xs text-muted-foreground">مستخدمون ومعربون يتبادلون الخبرات</p>
        </Card>
        <Card className="p-5 text-center">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h3 className="text-sm font-bold">نقاشات منظّمة</h3>
          <p className="mt-1 text-xs text-muted-foreground">مواضيع منفصلة لكل قسم</p>
        </Card>
        <Card className="p-5 text-center">
          <Send className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h3 className="text-sm font-bold">دعم سريع</h3>
          <p className="mt-1 text-xs text-muted-foreground">ردود سريعة على استفساراتك</p>
        </Card>
      </div>
    </div>
  )
}
