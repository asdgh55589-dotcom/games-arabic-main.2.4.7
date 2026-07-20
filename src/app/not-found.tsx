import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground" />
      <h2 className="text-2xl font-bold">الصفحة غير موجودة</h2>
      <p className="mt-2 text-muted-foreground">
        الصفحة التي تبحث عنها غير موجودة أو تم حذفها.
      </p>
      <Button asChild className="mt-4">
        <Link href="/">العودة للرئيسية</Link>
      </Button>
    </div>
  )
}
