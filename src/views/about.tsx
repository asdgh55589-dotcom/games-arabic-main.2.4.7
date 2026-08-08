'use client'

import { useDocumentTitle } from '@/hooks/use-document-title'
import { Card } from '@/components/ui/card'
import { Send, Bot, Gamepad2, Smartphone, Monitor, Heart, MapPin } from 'lucide-react'

export function AboutPage() {
  useDocumentTitle('من نحن — GAMES ARABIC')

  return (
    <div className="mx-auto max-w-[800px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">من نحن</h1>
        <p className="mt-2 text-muted-foreground">قصة GAMES ARABIC — من اللاعب، للاعب</p>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="space-y-5 text-sm leading-loose text-foreground/90">

          {/* المقدمة */}
          <p className="text-base font-medium leading-loose">
            في البداية، كنتُ مجرد لاعبٍ عربيّ كمثلي كمثلي من اللاعبين، تواجهني عقباتٌ لا تنتهي: بحثٌ مضنٍ عن تعريبٍ يعمل، أو نسخةٍ متوافقةٍ مع إصدارٍ مُحدّد، أو مفاجأةٌ بأنّ للعبة الواحدة تعدّد تعريباتٍ متباينة، لكلٍّ منها مشكلاته وخصائصه. والأشدّ إيلاماً كان غيابُ مجتمعٍ عربيٍّ حقيقيٍّ يُناقش هذه المشكلات؛ ليس شرطاً أن يصل النقاش إلى حلٍّ قاطع، بل يكفي أن تجد من يصغي إليك ويشاركك تجربته. من هذا الفجوة، وُلدت فكرة هذا الموقع.
          </p>

          {/* الانطلاقة */}
          <h2 className="text-lg font-bold text-primary">الانطلاقة</h2>
          <p>
            بدأتُ بمجموعةٍ من قنوات تليجرام، ولكنّ المشوار كان يكبر يوماً بعد يوم. المنشورات العاديّة لم تعد تكفي لاستيعاب كلّ البيانات والمعلومات التي يحتاجها المستخدم. ومن هنا، في اليوم السادس عشر من شهر يوليو لعام ألفين وستةٍ وعشرين، ينطلق موقع <strong>GAMES ARABIC — جيمز عربي</strong>؛ ليس مجرّد منصّةٍ تعرض تعريباتٍ وتنتهي مهمّتها، بل مشوارٌ ممتدٌّ من البحث والتنقيب: إصدارات التعريبات، ونسخ الألعاب المتوافقة، ومشكلات المستخدمين وحلولهم المستقاة من مجتمعاتٍ متعدّدة، وصورٌ عالية الدقّة نوفّرها ونوفّرها معاً، وبياناتٌ ومعلوماتٌ تصل إليها بسهولة، وشروحاتٌ مرئيّةٌ لطرق التركيب، وتواريخ الإصدارات، وروابط تحميلٍ موثوقة — بإذن الله لن تضطر بعدها لتكرار عبارة «هذا الرابط معطّل».
          </p>

          {/* الرؤية */}
          <h2 className="text-lg font-bold text-primary">الرؤية والمستقبل</h2>
          <p>
            مع توفير نسخٍ معرّبةٍ جاهزة، ستجدها ضمن خيارات التحميل لكلّ تعريب. أمّا عمليّة رفع الألعاب نفسها وتجميع التعريبات في ملفٍّ واحد، فهي مسألةٌ تتطلّب وقتاً وجهداً، ونتطرّق إليها لاحقاً لتكون في متناول الجميع بيسرٍ وسهولة. إلى جانب ذلك، يتمتّع المستخدم بإمكانيّة تعديل البيانات وإضافة المعلومات ورفع الصور والمساهمة في تحسين صفحات التعريبات، ليكون عضواً فاعلاً ومؤثّراً في الموقع.
          </p>

          {/* التقدير والاحترام */}
          <h2 className="text-lg font-bold text-primary">تقديرٌ واحترامٌ لفرق التعريب</h2>
          <p>
            نحن نُقدّر تعبَ ومجهود كلّ فريقٍ تعريب، سواءً كان فريقاً مستقلاًّ أو معرّباً مستقلّاً يعمل بمفرده، أو حتى فرقاً كبيرةً ذات سمعةٍ عريضة. لهم جميعاً جزيل الشكر والتقدير، فهم فوق رؤوسنا. كلّ من يبذل المال والوقت والمجهود ليقدّم شيئاً بالمجان للمجتمع العربي يستحقّ كلّ التقدير؛ فالدعم العربيّ وإدماج اللغة العربية في الألعاب بشكلٍ رسميّ هو هدفٌ نسعى إليه جميعاً.
          </p>

          {/* سياسة الربح */}
          <h2 className="text-lg font-bold text-primary">سياسة الإيرادات</h2>
          <p>
            يعمل هذا الموقع على استضافةٍ ودومين مدفوعَين، ولهذا نحتاج إلى إعلاناتٍ بسيطةٍ في روابطنا أو في الموقع. إليك كيف نتعامل معها بشفافيّةٍ تامّة:
          </p>

          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <p className="mb-3 font-semibold">أوّلاً: روابطنا الخاصّة</p>
            <p className="text-foreground/80">
              الروابط الوحيدة التي ستجد فيها إعلاناتٍ هي الروابط التي نوفّرها نحن بأنفسنا، ولن يتجاوز عدد الإعلانات اثنين كحدٍّ أقصى. تخطّيها أسهل من شرب الماء، ونعمل مع خدمةٍ متخصّصةٍ لتوفير إعلاناتٍ نظيفةٍ وسهلة التخطّي لدعم استمراريّة الموقع.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <p className="mb-3 font-semibold">ثانياً: روابط المعربين والفرق</p>
            <p className="text-foreground/80">
              أمّا الروابط التي ينشرها المعربون أنفسهم، فتظلّ كما هي دون أيّ تعديلٍ من جانبنا. نحن نأخذ نسخةً من ملف التعريب ونخزّنها كنسخةٍ احتياطيّةٍ تحسباً لأيّ عطلٍ قد يصيب الرابط الأصليّ. الرابط الذي نوفّره لك من المعرب لن تجد عليه أيّ إعلانٍ من عندنا — طبعاً ما لم يكن الرابط الأصليّ للمعرب يحتوي على إعلاناتٍ من جانبه. وفي هذه الحالة، لا نقوم بإعادة رفع الملف، لأنّ ذلك حقٌّ مكتسبٌ للمعرب في الحصول على عائدٍ مقابل عمله.
            </p>
          </div>

          {/* الدعم */}
          <h2 className="text-lg font-bold text-primary">كيف تدعمنا</h2>
          <div className="space-y-3">
            <p>
              <strong>دعم الموقع:</strong> يمكنك دعمنا بمتابعتنا على منصّات التواصل الاجتماعيّة التي ستجدها في أسفل الموقع. كلّ متابعةٍ هي دعمٌ معنويٌّ يُشجّعنا على الاستمرار.
            </p>
            <p>
              <strong>دعم المعربين:</strong> داخل كلّ تعريب ستجد روابط التواصل الخاصّة بفريق التعريب، أو رابط دعمٍ صريحاً. تواصل معهم وأرسل لهم أيّ مبلغٍ تقدّر به — حتى لو كان بسيطاً. صدّقني، أيّ مبلغٍ مهما صغر — حتّى دولارٌ واحدٌ أو أقلّ بحسب اختلاف العملات — يُحدث فرقاً كبيراً في تشجيع المعرب على الاستمرار.
            </p>
          </div>

          {/* خاتمة */}
          <div className="mt-6 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-6 text-center">
            <p className="text-lg font-medium leading-relaxed">
              صُمّم هذا الموقع من اللاعب، للاعب.
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              بُني بكلّ <Heart className="h-4 w-4 fill-red-500 text-red-500" /> من <MapPin className="h-4 w-4" /> مصر، للعالم العربيّ
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            آخر تحديثٍ لهذه الصفحة: السادس عشر من يوليو ٢٠٢٦
          </p>
        </div>
      </Card>

      {/* روابط قنواتنا */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold">روابط قنواتنا</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChannelCard
            icon={<Gamepad2 className="h-5 w-5" />}
            title="مكتبة التعريبات | PlayStation"
            desc="تعريبات ألعاب البلايستيشن بجميع أجياله"
            url="https://t.me/PS_AR_PC"
            handle="@PS_AR_PC"
          />
          <ChannelCard
            icon={<Monitor className="h-5 w-5" />}
            title="مكتبة تعريبات | PC Games"
            desc="تعريبات ألعاب الحاسوب الشخصي بجميع أجياله"
            url="https://t.me/PS_PC_AR"
            handle="@PS_PC_AR"
          />
          <ChannelCard
            icon={<Smartphone className="h-5 w-5" />}
            title="مكتبة تعريبات | Nintendo Switch"
            desc="تعريبات ألعاب نينتندو سويتش بجميع أجياله"
            url="https://t.me/PS_PC_NS"
            handle="@PS_PC_NS"
          />
          <ChannelCard
            icon={<Bot className="h-5 w-5" />}
            title="البوت الخاص بنا"
            desc="ميزات متعدّدة، أهمّها البحث السريع في جميع قنواتنا"
            url="https://t.me/In_Arabic_bot"
            handle="@In_Arabic_bot"
          />
        </div>
      </div>
    </div>
  )
}

function ChannelCard({ icon, title, desc, url, handle }: { icon: React.ReactNode; title: string; desc: string; url: string; handle: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Card className="group flex items-start gap-3 p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#229ED9] text-white">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
          <p className="mt-1 text-xs text-primary">{handle}</p>
        </div>
        <Send className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </Card>
    </a>
  )
}
