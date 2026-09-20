import Link from 'next/link'

const STATS = [
  { value: '2,400+', label: 'تعريب منشور' },
  { value: '180K', label: 'تحميل شهريًا' },
  { value: '320', label: 'مترجم نشط' },
  { value: '100%', label: 'مجاني ومفتوح' },
]

/**
 * SwissHero — typography is the hero. No image.
 * Spec sheet meta row + oversized Arabic headline + 2 minimal CTAs
 * + 4-cell stat strip separated by 1px borders.
 */
export function SwissHero() {
  return (
    <section aria-labelledby="swiss-hero-title" className="relative overflow-hidden">
      {/* Subtle grid pattern background (linear-gradient hairlines only) */}
      <div
        aria-hidden="true"
        className="swiss-grid-bg pointer-events-none absolute inset-0"
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
        {/* Spec meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] text-[#525252] tabular-nums dark:text-[#a3a3a3]">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#000] dark:bg-[#fff]" />
            SPEC — v2.0 / 2026
          </span>
          <span aria-hidden="true" className="text-[#e5e5e5] dark:text-[#262626]">
            |
          </span>
          <span>منصة تعريب الألعاب العربية</span>
          <span aria-hidden="true" className="text-[#e5e5e5] dark:text-[#262626]">
            |
          </span>
          <span>RTL / AR-FIRST</span>
        </div>

        {/* Headline */}
        <h1
          id="swiss-hero-title"
          className="mt-6 max-w-3xl text-[32px] leading-[1.25] font-bold tracking-tight text-[#000] sm:text-[48px] sm:leading-[1.2] lg:text-[64px] dark:text-[#fff]"
        >
          كل لعبة،
          <br />
          بلغتك العربية.
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-xl text-[16px] leading-[1.8] text-[#525252] dark:text-[#a3a3a3]">
          منصة مجتمع مفتوحة لتعريب الألعاب وأرشفتها — تعريبات احترافية عالية
          الجودة، مراجعة من المجتمع، ومتاحة للتحميل المجاني. بدون إعلانات
          مزعجة. بدون تعقيد.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/mods"
            className="inline-flex h-12 cursor-pointer items-center justify-center border border-[#000] bg-[#000] px-6 text-[16px] font-medium text-[#fff] transition-colors duration-150 ease-out hover:bg-[#262626] hover:border-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000] dark:border-[#fff] dark:bg-[#fff] dark:text-[#000] dark:hover:bg-[#e5e5e5] dark:hover:border-[#e5e5e5] dark:focus-visible:outline-[#fff]"
          >
            تصفّح التعريبات
          </Link>
          <Link
            href="/about"
            className="inline-flex h-12 cursor-pointer items-center justify-center px-6 text-[16px] font-medium text-[#000] underline-offset-4 transition-colors duration-150 ease-out hover:bg-[#f5f5f5] hover:underline dark:text-[#fff] dark:hover:bg-[#0a0a0a]"
          >
            كيف نعمل ←
          </Link>
        </div>

        {/* Mono conditions line */}
        <p className="mt-6 font-mono text-[12px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
          $ query --lang=ar --verified=true --free=true
        </p>

        {/* Stat strip */}
        <dl className="mt-12 grid grid-cols-2 border border-[#e5e5e5] bg-[#fff] md:grid-cols-4 dark:border-[#262626] dark:bg-[#000]">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={
                'px-4 py-5 ' +
                (i > 0 ? 'border-s border-[#e5e5e5] dark:border-[#262626] ' : '') +
                (i >= 2 ? 'max-md:border-t max-md:border-[#e5e5e5] dark:max-md:border-[#262626] ' : '') +
                (i === 2 ? 'max-md:border-s-0' : '')
              }
            >
              <dt className="order-2 mt-1 text-[13px] text-[#525252] dark:text-[#a3a3a3]">
                {s.label}
              </dt>
              <dd className="order-1 font-mono text-[24px] font-semibold text-[#000] tabular-nums dark:text-[#fff]">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
