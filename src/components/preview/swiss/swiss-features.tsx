import { FileCheck2, Languages, Search, ShieldCheck, Users, Zap } from 'lucide-react'

const FEATURES = [
  {
    icon: Languages,
    code: 'F.01',
    title: 'تعريب احترافي',
    desc: 'ترجمة بشرية كاملة للقوائم والحوارات والملفات — ليست ترجمة آلية. كل سطر يمر بمراجعة لغوية.',
  },
  {
    icon: ShieldCheck,
    code: 'F.02',
    title: 'مراجعة مجتمعية',
    desc: 'نظام تقييم وبلاغات شفاف. التعريبات الموثقة تحمل شارة تحقق بعد مراجعة مستقلة.',
  },
  {
    icon: Zap,
    code: 'F.03',
    title: 'تحميل مباشر',
    desc: 'روابط مباشرة وسريعة بدون اختصار روابط أو انتظار. ملف واحد، تثبيت واضح، شرح بالعربية.',
  },
  {
    icon: Search,
    code: 'F.04',
    title: 'أرشيف قابل للبحث',
    desc: 'فهرسة كاملة حسب اللعبة والمنصة والفريق والحالة. اعثر على أي تعريب خلال ثوانٍ.',
  },
  {
    icon: Users,
    code: 'F.05',
    title: 'فرق معلنة',
    desc: 'صفحات عامة لفرق الترجمة: أعضاؤها، أعمالها، وتقدم مشاريعها الحالية بشفافية كاملة.',
  },
  {
    icon: FileCheck2,
    code: 'F.06',
    title: 'توثيق الإصدارات',
    desc: 'سجل نسخ لكل تعريب: ما تغيّر، متى، ومن غيّره. حدّث لعبتك بثقة دون كسر حفظك.',
  },
]

/**
 * SwissFeatures — 3-col grid (desktop) / 2-col (tablet) / 1-col (mobile).
 * Minimal 1.5px line icons + index code + title + description. No illustrations.
 */
export function SwissFeatures() {
  return (
    <section aria-labelledby="swiss-features-title" className="border-t border-[#e5e5e5] dark:border-[#262626]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        {/* Section header — index + rule */}
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[12px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
              01
            </span>
            <h2
              id="swiss-features-title"
              className="text-[24px] font-bold tracking-tight text-[#000] sm:text-[32px] dark:text-[#fff]"
            >
              القدرات
            </h2>
          </div>
          <span className="hidden font-mono text-[12px] text-[#a3a3a3] sm:inline dark:text-[#525252]">
            ./capabilities --list
          </span>
        </div>
        <div aria-hidden="true" className="mt-4 h-px bg-[#e5e5e5] dark:bg-[#262626]" />
        <p className="mt-4 max-w-xl text-[14px] leading-7 text-[#525252] dark:text-[#a3a3a3]">
          ست وظائف أساسية، لا أكثر. كل واحدة تحل مشكلة حقيقية للاعب العربي —
          بلا زخرفة وبلا حشو.
        </p>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 gap-px border border-[#e5e5e5] bg-[#e5e5e5] sm:grid-cols-2 lg:grid-cols-3 dark:border-[#262626] dark:bg-[#262626]">
          {FEATURES.map((f) => (
            <article
              key={f.code}
              className="group bg-[#fff] p-6 transition-colors duration-150 ease-out hover:bg-[#f5f5f5] dark:bg-[#000] dark:hover:bg-[#0a0a0a]"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center border border-[#e5e5e5] text-[#000] transition-colors duration-150 ease-out group-hover:border-[#a3a3a3] dark:border-[#262626] dark:text-[#fff] dark:group-hover:border-[#525252]">
                  <f.icon size={20} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
                  {f.code}
                </span>
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-[#000] dark:text-[#fff]">
                {f.title}
              </h3>
              <p className="mt-2 text-[14px] leading-7 text-[#525252] dark:text-[#a3a3a3]">
                {f.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
