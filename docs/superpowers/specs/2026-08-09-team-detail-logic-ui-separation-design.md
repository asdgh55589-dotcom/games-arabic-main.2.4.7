# فصل المنطق عن الواجهة — صفحة تفاصيل الفريق (Team Detail)

التاريخ: 2026-08-09

## الهدف

فصل المنطق (logic) عن الواجهة (UI) في صفحة تفاصيل الفريق `src/views/team-detail.tsx`
التي تخلط حالياً بين الأنواع والثوابت وجلب البيانات والمكونات الواجهية.

النطاق: **صفحة الفريق فقط** — لا يتم تطبيق النمط على صفحات التفاصيل الأخرى في هذا العمل.

## الوضع الحالي

`src/views/team-detail.tsx` يحتوي على:

| النوع | المثال | الموقع الحالي |
|---|---|---|
| الأنواع Types | `TeamDetail`, `TeamMember`, `TeamMod`, `TeamContactLink`, `TeamStats` | داخل ملف العرض |
| الثوابت Constants | `ROLE_LABELS`, `CONTACT_ICONS`, `CONTACT_COLORS`, `TabKey`, `TEAM_TABS` | داخل ملف العرض |
| جلب البيانات | بناء الـ URL + `useFetch` + `useSearchParams` | داخل `TeamDetailPage` |
| حالة التبويب | `activeTab` / `setActiveTab` | داخل `TeamDetailPage` |
| عنوان الصفحة | `useDocumentTitle` | داخل `TeamDetailPage` |
| مكونات واجهية | `StatCell`, `TabButton`, `OverviewTab`, `MembersTab`, `ModsTab`, `StatsTab` | داخل ملف العرض |

## التصميم (الطريقة 1 — الموصى بها)

فصل كامل للمنطق عن العرض مع الالتزام بأنماط المشروع الحالية.

### 1. `src/lib/types.ts` — إضافة الأنواع

إضافة واجهات `TeamMember`, `TeamMod`, `TeamContactLink`, `TeamStats`, `TeamDetail`
إلى ملف الأنواع المركزي (الموجود) في نهايته.

### 2. `src/lib/team-constants.ts` — ملف جديد

نقل الثوابت كما هي من ملف العرض دون أي تغيير في القيم:
- `ROLE_LABELS` — خريطة الرتب → { label، icon، color }
- `CONTACT_ICONS` — أيقونات SVG الرسمية للمنصات
- `CONTACT_COLORS` — ألوان المنصات
- `TabKey` = `'overview' | 'members' | 'mods' | 'stats'`
- `TEAM_TABS` = مصفوفة التبويبات الأربعة مع أيقوناتها

### 3. `src/hooks/use-team-detail.ts` — ملف جديد

هوك واحد يجمع كل منطق الصفحة: `useSearchParams` + بناء الـ URL + `useFetch` +
`activeTab`/`setActiveTab` + `useDocumentTitle`. **لا يحتوي الهوك على أي JSX.**

### 4. `src/views/team-detail.tsx` — إعادة كتابة (عرضي بحت)

- حذف: الأنواع، الثوابت، `useSearchParams`، `useState`، `useMemo`، `useFetch`، `useDocumentTitle`
- استدعاء الهوك: `const { team, loading, activeTab, setActiveTab } = useTeamDetail()`
- استيراد الأنواع من `@/lib/types` والثوابت من `@/lib/team-constants`
- **يُبقي المكونات الواجهية الفرعية كما هي**: `StatCell`, `TabButton`, `OverviewTab`, `MembersTab`, `ModsTab`, `StatsTab` — داخل نفس الملف (نمط المشروع)

## السلوك غير المتغيّر

- نفس الواجهة تماماً: البانر، اللوجو، شريط الإحصائيات، التبويبات الأربعة، المحتوى
- نفس جلب البيانات (`/api/teams/<slug>`)
- نفس عنوان الصفحة
- نفس التصميم والألوان والمسافات
- **صفر تغيير بصري أو وظيفي** — إعادة هيكلة فقط

## معايير النجاح

1. `npx tsc --noEmit` لا يظهر أخطاء في `team-detail.tsx` أو الملفات الجديدة
2. لا تغيير في أي ملف خارج: `src/lib/types.ts`, `src/lib/team-constants.ts`, `src/hooks/use-team-detail.ts`, `src/views/team-detail.tsx`
3. السلوك البصري مطابق تماماً للوضع الحالي
