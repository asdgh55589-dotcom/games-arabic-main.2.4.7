'use client'

import { Send } from 'lucide-react'

/**
 * `/admin/social/telegram` — مركز منصة تيليجرام.
 * هيكل B0: سيُبنى في B2 (حالة، KPIs، رسم byDay، ملخص الوجهات، روابط سريعة).
 */
export default function TelegramHubPage() {
  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
          <Send className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground text-lg">تيليجرام</h1>
          <p className="text-[13px] text-muted-foreground">حالة القناة والمنشورات والوجهات</p>
        </div>
      </div>
    </div>
  )
}
