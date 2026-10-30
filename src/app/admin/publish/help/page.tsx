// DEPRECATED: consolidated into /admin/media
'use client'

/**
 * مساعدة النشر (مرحلة 6، الفئة 7 بند 12): صفحة ثابتة تُبنى تلقائياً من
 * كتالوج الأخطاء (src/lib/publish-errors.ts) — لكل رمز: السبب، صيغة
 * الإصلاح، وقابلية الإعادة. القارئ: moderator+ (قراءة) بلا أي كتابة.
 */
import { BookOpen, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PUBLISH_ERROR_CATALOG, type PublishErrorScope } from '@/lib/publish-errors'

const SCOPE_AR: Record<PublishErrorScope, string> = {
  post: 'منشور',
  route: 'قاعدة توجيه',
  bot: 'بوت',
  destination: 'وجهة',
  schedule: 'جدولة',
}

interface CatalogEntry {
  scope: PublishErrorScope
  causeAr: string
  fixAr: string
  retryable: boolean
}

export default function PublishHelpPage() {
  const entries = Object.entries(PUBLISH_ERROR_CATALOG) as Array<[string, CatalogEntry]>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BookOpen className="size-6" /> مساعدة النشر
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          دليل أخطاء النشر المُولّد من كتالوج المنصة — رمز واحد لكل فشل مع سببه وصيغة إصلاحه. تظهر نفس
          الصيغة في مركز الأخطاء وفي إشعارات الفشل.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle className="text-base">أين أجد تفاصيل الخطأ أولاً؟</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 pt-3 text-sm">
          <p>1) إشعار الفشل (التطبيق/البريد) يعرض رمز الخطأ وصيغة «كيف أصلحه» مباشرة.</p>
          <p>
            2) مركز الأخطاء يجمع الأحداث المفتوحة بأحدث فشل مع زر «أعد الوجهات الفاشلة» للمنشور،
            والحل اليدوي للمديرين.
          </p>
          <p>
            3) لوحة الصحة تعرض حالة البوتات/الوجهات/القواعد (أخضر/أحمر) مع عدّاد الأحداث المفتوحة.
          </p>
          <p>4) التقرير الدوري يصل لمشرفي المحتوى يومياً/أسبوعياً عبر كرون التقرير.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(([code, def]) => (
          <Card key={code} dir="rtl">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="font-mono">
                  {code}
                </Badge>
                <Badge variant="outline">{SCOPE_AR[def.scope]}</Badge>
                {def.retryable ? (
                  <Badge variant="outline" className="bg-blue-500/15 text-blue-600">
                    <RefreshCw className="size-3" /> قابل للإعادة
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    غير قابل للإعادة
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">السبب: </span>
                {def.causeAr}
              </p>
              <p className="bg-blue-500/10 text-blue-700 rounded p-2">
                <span className="font-medium">كيف أصلحه: </span>
                {def.fixAr}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
