# مركز السوشيال ميديا (Social Hub)

مركز موحّد لإدارة قنوات السوشيال ميديا من لوحة التحكم، بدءاً بمنصة **تيليجرام**
(النشطة حالياً)، مع مساحة محجوزة لفيسبوك ويوتيوب.

## الصفحات

| المسار | الوصف | الصلاحية الدنيا |
| --- | --- | --- |
| `/admin/social` | لمحة عامة: عدّادات، شبكة المنصات، المنشورات المجدولة والأخيرة | `admin` |
| `/admin/social/channels` | قائمة المنصات (مفعّل / قريباً) وزر الإدارة | `admin` |
| `/admin/social/telegram` | مركز تيليجرام: مؤشرات، مخطط النشر اليومي، الوجهات، روابط سريعة | `admin` |

> الصفحات أعلاه هي المسجّلة والمشحونة فعلاً في هذا الإصدار. صفحات
> `/admin/social/telegram/posts` (منشورات) و`/admin/social/telegram/templates`
> (قوالب) رتبتها `manager` وتُسجَّل في السجل مع هبوط مسارات العامل **W3** — لا
> نُسجّل صفحات ولا روابط قبل وجودها (لا روابط ميتة ولا منح صلاحية لصفحة مفقودة).

> عناصر التنقّل في الشريط الجانبي تتبع نفس الصلاحيات: صفحات اللمحة/المركز تظهر
> بوصف `adminOnly`، وتُضاف عناصر المنشورات/القوالب مع هبوط صفحاتها. لا صفحة أوسع من
> الـ API الذي تستهلكه.

> **قاعدة P3 — لا رابط لصفحة لا يستطيع المشاهد فتحها:** الروابط السريعة في
> `/admin/social/telegram` (رتبتها `admin`) تُعرض للوجهات التي يستطيع `admin`
> فتحها فقط: `/admin/notifications/history` و`/admin/scheduler` (كلتاهما `admin`).
> لا تُدرج روابط `manager` مثل `/admin/templates` أو صفحات منشورات/قوالب W3 في
> صفحة `adminOnly` — تجنّباً لوعد زائر الصفحة بصفحة سيرفضها الـ API بـ 403.

## الطبقة البيانية — `src/hooks/use-social.ts`

طبقة مشتركة (يستهلكها العامل W3 أيضاً) توحّد الجلب والأنواع:

- `useSocialOverview()` → `GET /api/admin/social/overview`
- `useSocialStats(range)` → `GET /api/admin/social/stats?platform=telegram&range=7d|30d|90d`
- `useSocialPosts(query)` / `useSocialPost(id)` / `useSocialPostTemplates(query)` — يستهلكها W3

> **مسار ↔ صفحة:** تتبع مسارات الـ API تدرّج الصفحات، لذا فإن المنشورات/القوالب
> تُبنى على `/api/admin/social/telegram/posts` و
> `/api/admin/social/telegram/templates` (لا `/api/admin/social/posts`) عبر
> `socialPostsUrl` / `socialPostUrl` / `socialTemplatesUrl` لتفادي الانحراف. هذا
> شرط لعمل حاجز claim الصفحات في `proxy.ts` عبر `apiPathToAdminPath` +
> `findPageForPath`: بمجرّد تسجيل W3 لصفحتي المنشورات/القوالب يُنسب المسار لمفتاح
> `social-telegram-posts` / `social-telegram-templates` (رتبة `manager`) بدل
> المفتاح العام `social` (رتبة `admin`). قبل التسجيل تُنسب لصفحة المركز
> `social-telegram` (أطول بادئة مسجّلة) وليس للجذر `social`.

### سلوك البيانات التجريبية

جرى تصميم الواجهة بحيث **لا تُحجب** إن لم تكن نقاط الـ API جاهزة على الخادم بعد:

- عند نجاح الطلب تُعرض البيانات الحقيقية.
- عند فشل الطلب (404/خطأ شبكة) تُعرض بيانات **تجريبية** مطابقة للعقد مع
  `isMock: true`، ويظهر شريط «بيانات تجريبية» أعلى الصفحة.
- فور جهوزية `src/lib/social/*` و`/api/admin/social/*` يتحوّل العرض للبيانات
  الحقيقية تلقائياً دون أي تغيير في الكود.

> ملاحظة للمطوّرين: سجل المنصات الرسمي هو `src/lib/social/platforms.ts`. ما دام لم
> يهبط، يبقى في `src/components/admin/social/platform-card.tsx` كائن عرض مطابق
> (`ADMIN_SOCIAL_PLATFORMS`)؛ عند هبوط السجل يكفي استبدال الاستيراد — لا يُلمَس المكوّن.

## الربط العميق من سجل الإشعارات

صفحة `/admin/notifications/history` تقرأ المعامل `?channel=` **كمُهيّئ أولي فقط**:

- `/admin/notifications/history?channel=telegram` تفتح السجل مع تحديد قناة تيليجرام
  وتُدرجها في أول طلب.
- تغييرات المرشّح اللاحقة لا تُعيد كتابة الرابط.
- أي قيمة قناة غير معروفة تُتجاهل بهدوء (بدون فلترة).

## المنصات

| المنصة | الحالة | ملاحظات |
| --- | --- | --- |
| تيليجرام | مفعّل | منشورات + قوالب + إشعارات + جدولة |
| فيسبوك | قريباً | زر الإدارة معطّل بلا رابط (لا روابط ميتة) |
| يوتيوب | قريباً | زر الإدارة معطّل بلا رابط (لا روابط ميتة) |

## الاختبارات

- `src/__tests__/admin-pages-social.test.ts` — تسجيل الصفحات والصلاحيات.
- `src/__tests__/social-platform-card.test.ts` — مرآة المنصات ومنع الروابط الميتة.
- `src/__tests__/use-social.test.ts` — شكل البيانات التجريبية.
- `src/__tests__/social-hub-pages.test.tsx` — عقد الصفحات مع الخادم وسلوك `isMock`.
- `src/__tests__/notifications-history-page.test.tsx` — تهيئة مرشّح `?channel=`.

تشغيلها: `npx jest <المسار>`.
