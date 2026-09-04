import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl scale-150" />
        <div className="relative grid h-20 w-20 place-items-center rounded-2xl border border-primary/20 bg-primary/10">
          <Gamepad2 className="h-10 w-10 text-primary" />
        </div>
      </div>
      <div className="mb-2 text-6xl font-black tracking-tighter text-muted/30">404</div>
      <h2 className="text-xl font-bold text-foreground">الصفحة غير موجودة</h2>
      <p className="mt-2 max-w-sm break-words text-sm text-muted-foreground">
        يبدو أن هذه الصفحة لم تكن موجودة في ألعابنا. ربما تم حذفها أو أن الرابط غير صحيح.
      </p>
      <Button asChild className="mt-6" size="lg">
        <Link href="/">العودة للرئيسية</Link>
      </Button>
    </div>
  )
}
