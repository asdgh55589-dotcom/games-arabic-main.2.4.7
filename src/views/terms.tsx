'use client'

import { AlertTriangle, FileText, Heart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function TermsPage() {
  useDocumentTitle('شروط الخدمة — GAMES ARABIC')

  return (
    <div className="mx-auto max-w-[800px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">شروط الخدمة</h1>
        <p className="mt-2 text-muted-foreground">آخر تحديث: ١٦ يوليو ٢٠٢٦</p>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <h2 className="text-lg font-bold text-primary">١. قبول الشروط</h2>
          <p>
            باستخدامك لموقع GAMES ARABIC، فإنك توافق على هذه الشروط والأحكام. إذا كنت لا توافق على
            أي جزء منها، يُرجى عدم استخدام الموقع.
          </p>

          <h2 className="text-lg font-bold text-primary">٢. طبيعة الخدمة</h2>
          <p>
            GAMES ARABIC هو منصة لتعريب وأرشفة الألعاب العربية. يوفّر الموقع تعريبات (ترجمات عربية)
            لألعاب مختلفة على منصات متعددة، مع روابط تحميل ومجتمع للنقاش والدعم. الموقع مجاني
            للاستخدام ولا يتطلب رسوماً للاطلاع على المحتوى أو تحميله.
          </p>

          {/* تأكيد عدم سرقة الأعمال */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              ٣. حقوق الملكية وعدم سرقة الأعمال
            </h2>
            <p className="mt-2">
              <strong>نؤكّد بشدة أننا لا نسرق أي أعمال لأي فريق تعريب أو معرّب مستقل.</strong> جميع
              التعريبات المنشورة على الموقع هي ملكية أصحابها الأصليين من فرق التعريب والمعرّبين
              المستقلين. دورنا يقتصر على الأرشفة وتوفير الروابط وتنظيم المحتوى في مكان واحد يسهّل على
              المستخدم العربي الوصول إليه.
            </p>
            <p className="mt-2">
              نحن نحترم تعب ومجهود كل فريق وكل معرّب مستقل، ونُقدّر لهم جزيل الشكر على ما يقدّمونه
              للمجتمع العربي مجاناً. أي شخص يوفّر المال والوقت والمجهود ليقدّم شيئاً بالمجان للمجتمع
              العربي يستحق كل التقدير والاحترام.
            </p>
          </div>

          {/* حق الفريق في الحذف */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
              <FileText className="h-5 w-5" />
              ٤. حق الفريق في طلب الحذف
            </h2>
            <p className="mt-2">
              <strong>
                لكل فريق تعريب أو معرّب مستقل الحق الكامل في التواصل معنا لطلب حذف تعريبه من موقعنا.
              </strong>{' '}
              نحن نحترم هذا الحق تماماً وسنقوم بحذف أي تعريب بناءً على طلب صاحبه الأصلي دون أي اعتراض.
            </p>
            <p className="mt-2">
              <strong>تنبيه مهم:</strong> مع ذلك، نودّ التنبيه إلى أن حذف التعريب من الموقع سيضرّ
              المجتمع العربي أكثر مما سيضر الموقع. الموقع يستمر بأقسامه ومحتواه الآخر، أما
              المستخدمون الذين يعتمدون على هذا التعريب سيجدون صعوبة في الوصول إليه. نأمل أن يُؤخذ هذا
              في الاعتبار قبل طلب الحذف، وأن يتم التفكير في الحلول البديلة (مثل تحديث الروابط بدلاً
              من الحذف الكامل).
            </p>
            <p className="mt-2">
              للتواصل وطلب الحذف، يُرجى مراسلتنا عبر جروب تليجرام:{' '}
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

          <h2 className="text-lg font-bold text-primary">٥. سياسة الإعلانات</h2>
          <p>
            كما هو موضّح في صفحة "من نحن"، الروابط الخاصة بنا قد تحتوي على إعلان أو اثنين لتغطية
            تكاليف الاستضافة والدومين. هذه الإعلانات سهلة التخطّي. الروابط الخاصة بالمعربين لا نضع
            عليها أي إعلانات من جانبنا.
          </p>

          <h2 className="text-lg font-bold text-primary">٦. سلوك المستخدم</h2>
          <ul className="mr-6 list-disc space-y-1.5">
            <li>يُمنع نشر محتوى مسيء أو غير قانوني في التعليقات.</li>
            <li>يُمنع السبام أو الإعلان عن مواقع أخرى دون إذن.</li>
            <li>يُمنع انتحال شخصية فرق التعريب أو المعرّبين.</li>
            <li>المخالفات تؤدي إلى حذف المحتوى وربما حظر الحساب.</li>
          </ul>

          <h2 className="text-lg font-bold text-primary">٧. إخلاء المسؤولية</h2>
          <p>
            الموقع يوفّر روابط تحميل من مصادر متعددة (روابط المعربين + نسخ احتياطية). لا نتحمّل
            مسؤولية أي ضرر قد يلحق بجهازك أو لعبتك نتيجة تركيب تعريب. ننصح دائماً بأخذ نسخة احتياطية
            قبل التركيب.
          </p>

          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-medium">
              هذا الموقع صُنع من اللاعب للاعب <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">من مصر للعالم العربي</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
