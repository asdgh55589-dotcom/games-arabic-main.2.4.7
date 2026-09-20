import Link from 'next/link'
import { SwissCard } from './swiss-card'

const MODS = [
  {
    title: 'تعريب Elden Ring — v2.4 كامل',
    category: 'أكشن / RPG',
    date: '2026-09-12',
    stat: '↓ 48.2K · ★ 4.9',
    desc: 'ترجمة كاملة للقوائم والحوارات والوصف — متوافق مع آخر تحديث.',
  },
  {
    title: 'تعريب Baldur’s Gate 3 — الفصل الثالث',
    category: 'RPG',
    date: '2026-09-10',
    stat: '↓ 31.7K · ★ 4.8',
    desc: 'اكتمال 92% — الحوارات الجانبية قيد المراجعة النهائية.',
  },
  {
    title: 'تعريب Red Dead Redemption 2',
    category: 'عالم مفتوح',
    date: '2026-09-06',
    stat: '↓ 96.1K · ★ 5.0',
    desc: 'النسخة الذهبية: ترجمة + خط عربي مخصص + إصلاح اتجاه النص.',
  },
]

const GAMES = [
  {
    title: 'Cyberpunk 2077 — صفحة اللعبة',
    category: 'منصة PC',
    date: '14 تعريبًا',
    stat: 'محدّث 2026-09-14',
    desc: 'كل التعريبات والمودات العربية المرتبطة باللعبة في مكان واحد.',
  },
  {
    title: 'The Witcher 3 — صفحة اللعبة',
    category: 'منصة PC / PS',
    date: '9 تعريبات',
    stat: 'محدّث 2026-09-11',
    desc: 'يشمل تعريب Next-Gen الكامل والدبلجة النصية.',
  },
  {
    title: 'God of War Ragnarök — صفحة اللعبة',
    category: 'منصة PS5',
    date: '4 تعريبات',
    stat: 'محدّث 2026-09-08',
    desc: 'تعريب القوائم + ترجمة الحوارات مع توقيت المشاهد.',
  },
]

const NEWS = [
  {
    title: 'إطلاق نظام التحقق الجديد للتعريبات',
    category: 'إعلان',
    date: '2026-09-15',
    stat: 'قراءة 3 دقائق',
    desc: 'شارة تحقق مزدوجة، سجل مراجعة علني، ومعايير قبول أوضح للفرق.',
  },
  {
    title: 'فريق «لسان» ينجز تعريب Hollow Knight',
    category: 'مجتمع',
    date: '2026-09-13',
    stat: 'قراءة 2 دقائق',
    desc: 'ثمانية أشهر من العمل التطوعي — والملف متاح الآن مجانًا.',
  },
  {
    title: 'دليل تثبيت التعريبات على Steam Deck',
    category: 'شروحات',
    date: '2026-09-09',
    stat: 'قراءة 5 دقائق',
    desc: 'خطوة بخطوة مع حل أشهر 6 أخطاء تواجه اللاعبين العرب.',
  },
]

function SectionHead({
  index,
  title,
  href,
  cmd,
}: {
  index: string
  title: string
  href: string
  cmd: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[12px] text-[#a3a3a3] tabular-nums dark:text-[#525252]">
            {index}
          </span>
          <h2 className="text-[20px] font-bold tracking-tight text-[#000] sm:text-[24px] dark:text-[#fff]">
            {title}
          </h2>
        </div>
        <Link
          href={href}
          className="shrink-0 cursor-pointer text-[13px] font-medium text-[#000] underline-offset-4 transition-colors duration-150 ease-out hover:bg-[#f5f5f5] hover:underline dark:text-[#fff] dark:hover:bg-[#0a0a0a]"
        >
          عرض الكل ←
        </Link>
      </div>
      <p className="mt-1 hidden font-mono text-[12px] text-[#a3a3a3] sm:block dark:text-[#525252]">
        {cmd}
      </p>
    </div>
  )
}

/**
 * SwissContentGrid — latest mods / games / news.
 * Border-only cards, grayscale by design, hover = border + bg shift.
 */
export function SwissContentGrid() {
  return (
    <section aria-labelledby="swiss-latest" className="border-t border-[#e5e5e5] dark:border-[#262626]">
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-16 sm:px-6 sm:py-24">
        <h2 id="swiss-latest" className="sr-only">
          أحدث المحتوى
        </h2>

        <div>
          <SectionHead index="02" title="أحدث التعريبات" href="/mods" cmd="$ ls ./mods --sort=recent --limit=3" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODS.map((m, i) => (
              <SwissCard
                key={m.title}
                title={m.title}
                category={m.category}
                date={m.date}
                stat={m.stat}
                href="/mods"
                index={`M.${String(i + 1).padStart(2, '0')}`}
                actionLabel="تحميل ←"
              >
                {m.desc}
              </SwissCard>
            ))}
          </div>
        </div>

        <div>
          <SectionHead index="03" title="صفحات الألعاب" href="/games" cmd="$ ls ./games --sort=updated --limit=3" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {GAMES.map((g, i) => (
              <SwissCard
                key={g.title}
                title={g.title}
                category={g.category}
                date={g.date}
                stat={g.stat}
                href="/games"
                index={`G.${String(i + 1).padStart(2, '0')}`}
                actionLabel="فتح الصفحة ←"
              >
                {g.desc}
              </SwissCard>
            ))}
          </div>
        </div>

        <div>
          <SectionHead index="04" title="آخر الأخبار" href="/news" cmd="$ tail -n 3 ./news.log" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {NEWS.map((n, i) => (
              <SwissCard
                key={n.title}
                title={n.title}
                category={n.category}
                date={n.date}
                stat={n.stat}
                href="/news"
                index={`N.${String(i + 1).padStart(2, '0')}`}
                actionLabel="قراءة ←"
              >
                {n.desc}
              </SwissCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
