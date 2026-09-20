import type { Metadata } from 'next'
import { SwissContentGrid } from '@/components/preview/swiss/swiss-content-grid'
import { SwissFeatures } from '@/components/preview/swiss/swiss-features'
import { SwissFooter } from '@/components/preview/swiss/swiss-footer'
import { SwissHeader } from '@/components/preview/swiss/swiss-header'
import { SwissHero } from '@/components/preview/swiss/swiss-hero'
import './swiss-theme.css'

export const metadata: Metadata = {
  title: 'Swiss Preview — الرئيسية',
  description:
    'معاينة تجريبية لتصميم Swiss Minimalist للصفحة الرئيسية. monochrome، شبكة صارمة، طباعة أولًا.',
  robots: { index: false, follow: false },
}

/**
 * EXPERIMENTAL preview route — /preview/swiss-home.
 * Isolated: own header/footer/theme scope. Root AppShell still wraps
 * this page (Navbar/Footer) until the owner decides to merge.
 */
export default function SwissHomePreviewPage() {
  return (
    <div dir="rtl" lang="ar" className="swiss-scope min-h-screen bg-[#fff] text-[#000] dark:bg-[#000] dark:text-[#fff]">
      <p className="border-b border-[#e5e5e5] bg-[#f5f5f5] px-4 py-2 text-center font-mono text-[11px] text-[#525252] tabular-nums sm:px-6 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#a3a3a3]">
        PREVIEW — experimental Swiss redesign · <span dir="ltr">/preview/swiss-home</span> · ليست الصفحة الرسمية
      </p>
      <SwissHeader />
      <main id="swiss-main">
        <SwissHero />
        <SwissFeatures />
        <SwissContentGrid />
        {/* CTA strip — single rule, two actions, no decoration */}
        <section aria-label="دعوة للانضمام" className="border-t border-[#e5e5e5] dark:border-[#262626]">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[12px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
                05 — ./contribute
              </p>
              <h2 className="mt-2 text-[24px] font-bold tracking-tight sm:text-[32px]">
                لديك لعبة تحتاج تعريبًا؟
              </h2>
              <p className="mt-2 max-w-lg text-[14px] leading-7 text-[#525252] dark:text-[#a3a3a3]">
                اطلب تعريبًا، أو انضم لفريق، أو ابدأ مشروعك الخاص — بثلاث خطوات
                وأقل من دقيقتين.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/request"
                className="inline-flex h-12 cursor-pointer items-center justify-center border border-[#000] bg-[#000] px-6 text-[16px] font-medium text-[#fff] transition-colors duration-150 ease-out hover:border-[#262626] hover:bg-[#262626] dark:border-[#fff] dark:bg-[#fff] dark:text-[#000] dark:hover:bg-[#e5e5e5]"
              >
                اطلب تعريبًا
              </a>
              <a
                href="/apply"
                className="inline-flex h-12 cursor-pointer items-center justify-center border border-[#e5e5e5] px-6 text-[16px] font-medium transition-colors duration-150 ease-out hover:border-[#a3a3a3] hover:bg-[#f5f5f5] dark:border-[#262626] dark:hover:border-[#525252] dark:hover:bg-[#0a0a0a]"
              >
                انضم كمترجم
              </a>
            </div>
          </div>
        </section>
      </main>
      <SwissFooter />
    </div>
  )
}
