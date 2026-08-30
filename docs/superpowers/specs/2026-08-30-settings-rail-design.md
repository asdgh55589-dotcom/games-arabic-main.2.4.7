# تصميم شريط الإعدادات الجانبي — 30/08/2026

## االقرار (معتمد من المستخدم)
- **المفهوم «ب»**: كل قسم كارت منفصل بحد وظل + **الأيقونات بإطار ظاهر مثل «ج»**.

## المرجع البصري
- `tmp/opencode/settings-rail-preview.html` (محفوظ — لا يُحذف).

## المقاسات والتوكينات
- العمود: `lg:w-64` (256px) + `lg:sticky lg:top-24`
- المسافة بين الكروت: `space-y-3` (12px)
- الكارت: `border-[3px] rounded-none px-4 py-3 gap-3 bg-card shadow-[4px_4px_0_0_var(--border)]`
- hover (نفس كروت الهوم بالظبط): `hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--border)] hover:bg-card-hover`
- الكارت النشط: `border-primary bg-primary/10`
- صندوق الأيقونة: `h-8 w-8 rounded-lg border-2` — خلفية شفافة + حد `border-border` (حالة هادئة)؛ عند النشط: `border-primary bg-primary/10 text-primary`
- الأيقونة نفسها: `h-[18px] w-[18px]`
- نص: العنوان `text-sm font-bold text-foreground` + الوصف `text-[10px] font-medium text-muted-foreground`
- سهم `ChevronLeft`: لون `text-primary`، يبان بالنشط `opacity-100` أو بالـ hover `group-hover:opacity-100`، موقعه `ms-auto` (يسار في RTL)

## الملف المتأثر
- `src/views/settings.tsx` — الشريط فقط (سطر 776–804) + إضافة `ChevronLeft` للاستيرادات + تكبير أيقونات `SECTIONS` إلى `h-[18px] w-[18px]`.

## تحديث — محتوى العمود الأيسر (إعدادات)
- كروت الأقسام (9 كروت في `<main className="flex-1 min-w-0">`) تحولت من:
  `rounded-none bg-card border-2 border-border p-6`
  إلى:
  `rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]`
- نفس هوية كروت الشريط (حد 3px + ظل حاد 4×4). الحقول/الضوابط الداخلية (`border-2`) لم تتغير.
- زرار Debug وكوده المتصل اتمسحوا بالكامل.

## تحديث — قسم «كن معرّباً» (خامس)
- إضافة `translation` إلى `SettingsSection` + قائمة `SECTIONS` (أيقونة `Upload`، وصف «شارك تعريباتك مع الآخرين»).
- محتوى رقمي بصفحة شرح داخل الإعدادات (بنفس هوية الكروت):
  1. Hero: «كن معرّباً — شارك تعريباتك مع الآخرين».
  2. «ما معنى أن تكون معرّباً؟» شرح نصي.
  3. 3 كروت فوائد (انشر تعريباتك / تفاعل مع الجمهور / تابع إحصائياتك).
  4. «كيف تصبح معرّباً؟» 4 خطوات مرقّمة (قدّم/استلم الرد/ابدأ النشر/تابع النتائج).
  5. «تعليمات المشاركة مع الآخرين» bullet list.
  6. CTA ذكي: لو الدور من `TRANSLATOR_ROLES` (creator/publisher/moderator/admin/manager/owner) → «لوحة المُعرّب» يروح `/creator`، وإلا «قدّم طلبك الآن» يروح `/become-creator/apply`.

## ملاحظات
- RTL: الاتجاه للأمام هو اليسار ← `ChevronLeft`.
- تفاعل الهوفر نُسخ من كروت الهوم (`home.tsx:177`) حرفياً.
- الموبايل: الكروت بترصوص كاملة العرض بنفس `space-y-3`.