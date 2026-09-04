'use client'

import { Shield } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function PrivacyPage() {
  useDocumentTitle('سياسة الخصوصية — GAMES ARABIC')

  return (
    <div className="mx-auto max-w-[800px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">سياسة الخصوصية</h1>
        <p className="mt-2 text-muted-foreground">آخر تحديث: ١٦ يوليو ٢٠٢٦</p>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            نحن في GAMES ARABIC نحترم خصوصية مستخدمينا ونلتزم بحماية بياناتهم الشخصية. توضّح هذه
            السياسة كيفية جمعنا واستخدامنا وحمايتنا للبيانات التي تقدّمها عند استخدام موقعنا.
          </p>

          <h2 className="text-lg font-bold text-primary">١. البيانات التي نجمعها</h2>
          <ul className="mr-6 list-disc space-y-1.5">
            <li>
              <strong>بيانات الحساب:</strong> اسم المستخدم، البريد الإلكتروني، كلمة المرور (مشفّرة)
              عند تسجيل الحساب.
            </li>
            <li>
              <strong>بيانات التفاعل:</strong> التعليقات، التأييدات، المشاهدات، والتحميلات التي تقوم
              بها.
            </li>
            <li>
              <strong>بيانات تقنية:</strong> عنوان IP، نوع المتصفح، نظام التشغيل (لأغراض الأمان
              وإحصائيات الاستخدام).
            </li>
            <li>
              <strong>بيانات OAuth:</strong> عند تسجيل الدخول عبر Google أو Telegram، نحصل على الاسم
              والبريد الإلكتروني والصورة فقط.
            </li>
          </ul>

          <h2 className="text-lg font-bold text-primary">٢. كيف نستخدم بياناتك</h2>
          <ul className="mr-6 list-disc space-y-1.5">
            <li>تقديم خدمات الموقع (تصفّح، تحميل، تعليق، تأييد).</li>
            <li>تحسين تجربة المستخدم وتطوير الموقع.</li>
            <li>الحماية من الإساءة والسبام (Rate Limiting).</li>
            <li>التواصل معك بشأن حسابك أو التعريبات التي تشارك فيها.</li>
          </ul>

          <h2 className="text-lg font-bold text-primary">٣. ما لا نفعله ببياناتك</h2>
          <ul className="mr-6 list-disc space-y-1.5">
            <li>لا نبيع بياناتك لأي طرف ثالث.</li>
            <li>لا نشارك بياناتك لأغراض إعلانية خارجية.</li>
            <li>لا نخزّن كلمات المرور بصيغة نصية — جميعها مشفّرة بـ bcrypt.</li>
          </ul>

          <h2 className="text-lg font-bold text-primary">٤. ملفات تعريف الارتباط (Cookies)</h2>
          <p>
            يستخدم الموقع ملفات تعريف ارتباط (Cookies) لحفظ جلسة تسجيل الدخول وتحسين تجربة
            الاستخدام. ملفات الـ session آمنة (HttpOnly) ولا يمكن الوصول إليها عبر JavaScript.
          </p>

          <h2 className="text-lg font-bold text-primary">٥. حقوقك</h2>
          <ul className="mr-6 list-disc space-y-1.5">
            <li>الحق في الوصول إلى بياناتك.</li>
            <li>الحق في تعديل أو حذف حسابك.</li>
            <li>الحق في حذف تعليقاتك أو مساهماتك.</li>
          </ul>

          <h2 className="text-lg font-bold text-primary">٦. التواصل</h2>
          <p>
            إذا كان لديك أي استفسار حول سياسة الخصوصية، يمكنك التواصل معنا عبر جروب تليجرام:{' '}
            <a
              href="https://t.me/GAMES_ARABIC"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @GAMES_ARABIC
            </a>
          </p>
        </div>
      </Card>
    </div>
  )
}
