/**
 * صفحة الإدارة "إدارة روابط التحميل" — ثلاث تبويبات.
 * يثبت: العنوان + التبويبات الثلاث + فاحصا الروابط + إعادة الترتيب
 * + CRUD المواقع + بطاقات "قريباً" + عدم إنشاء أي رسالة جديدة.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

function adminPage(): string {
  return fs.readFileSync(
    path.join(root, 'src/app/admin/download-settings/page.tsx'),
    'utf8',
  )
}

describe('download links admin page', () => {
  it('has the new title (same URL, changed title only)', () => {
    expect(adminPage()).toMatch(/إدارة روابط التحميل/)
  })

  it('uses shadcn Tabs with the three required tabs', () => {
    const src = adminPage()
    // استيراد تبويبات shadcn الموجودة
    expect(src).toMatch(/from '@\/components\/ui\/tabs'/)
    expect(src).toMatch(/Tabs/)
    expect(src).toMatch(/TabsList/)
    expect(src).toMatch(/TabsTrigger/)
    expect(src).toMatch(/TabsContent/)
    // التبويبات الثلاث
    expect(src).toMatch(/خدمات التخزين الموثوقة/)
    expect(src).toMatch(/مواقع التحميل المتوافقة/)
    expect(src).toMatch(/الرسائل والتنبيهات/)
    expect(src).toMatch(/value="storage"/)
    expect(src).toMatch(/value="sites"/)
    expect(src).toMatch(/value="messages"/)
  })

  it('storage tab keeps CRUD + adds reorder arrows and link checker', () => {
    const src = adminPage()
    // الوظائف المحفوظة
    expect(src).toMatch(/\/api\/download-settings/)
    expect(src).toMatch(/addService|إضافة/)
    expect(src).toMatch(/removeService|حذف/)
    // أسهم إعادة الترتيب قبل الحفظ
    expect(src).toMatch(/moveService/)
    expect(src).toMatch(/ArrowUp/)
    expect(src).toMatch(/ArrowDown/)
    // فاحص الرابط عبر isTrustedDownloadUrl
    expect(src).toMatch(/isTrustedDownloadUrl/)
    expect(src).toMatch(/فاحص رابط/)
    expect(src).toMatch(/موثوق \(/)
    expect(src).toMatch(/غير موثوق — سيظهر التنبيه/)
  })

  it('compatible sites tab has full CRUD against /api/compatible-sites', () => {
    const src = adminPage()
    expect(src).toMatch(/\/api\/compatible-sites/)
    expect(src).toMatch(/isCompatibleSiteUrl/)
    // POST للإضافة + PUT للتعديل + DELETE للحذف عبر /[id]
    expect(src).toMatch(/method: 'POST'/)
    expect(src).toMatch(/method: 'PUT'/)
    expect(src).toMatch(/method: 'DELETE'/)
    expect(src).toMatch(/compatible-sites\/\$\{id\}/)
    // بطاقة الموقع + نموذج الإضافة + تعديل داخلي + حذف بتأكيد
    expect(src).toMatch(/مفعّل/)
    expect(src).toMatch(/مغلّق/)
    expect(src).toMatch(/النطاقات مفصولة بفاصلة/)
    expect(src).toMatch(/2000/)
    expect(src).toMatch(/window\.confirm/)
    // فاحص المواقع يُظهر الموقع المطابق وشعاره
    expect(src).toMatch(/فاحص رابط المواقع/)
    expect(src).toMatch(/متوافق — /)
    // نفس أسلوب الصفحة: apiFetch + useToast
    expect(src).toMatch(/apiFetch/)
    expect(src).toMatch(/useToast/)
  })

  it('messages tab moves the ad-links editor + shows soon placeholders', () => {
    const src = adminPage()
    // محرر رسالة الإعلانات منقول كما هو
    expect(src).toMatch(/رسالة تنبيه روابط الإعلانات/)
    expect(src).toMatch(/warningMessage/)
    // بطاقات قريباً للأنواع القادمة
    expect(src).toMatch(/قريباً/)
    expect(src).toMatch(/تحذير موقع كراك/)
    expect(src).toMatch(/رسالة انتظار/)
    expect(src).toMatch(/صفحة تحويل/)
    expect(src).toMatch(/قوالب رسائل/)
    expect(src).toMatch(/مكانها محجوز/)
  })

  it('creates no new messages beyond the ad-links warning', () => {
    const src = adminPage()
    // محرر واحد فقط لرسالة الإعلانات
    const occurrences = (src.match(/رسالة تنبيه روابط الإعلانات/g) || []).length
    expect(occurrences).toBe(1)
    // لا POST جديد لأي رسالة — الحفظ الوحيد هو PUT الإعدادات الحالية
    expect(src).not.toMatch(/method: 'POST'.*download-settings/)
    expect(src).not.toMatch(/\/api\/(messages|message-templates|download-messages)/)
  })
})
