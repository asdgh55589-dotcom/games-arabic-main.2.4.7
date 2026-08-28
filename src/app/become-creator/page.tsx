import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'كن معرّباً — GAMES ARABIC',
  description: 'انضم لفريق المُعَرِّبين وشارك تعريباتك مع آلاف اللاعبين',
  robots: { index: true, follow: true },
}

function BenefitCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <Card className="text-center">
      <CardContent className="p-6">
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="font-bold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  )
}

export default function BecomeCreatorPage() {
  return (
    <div className="container mx-auto py-12 max-w-3xl px-4" dir="rtl">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🎨</div>
        <h1 className="text-4xl font-bold mb-4">كن معرّباً</h1>
        <p className="text-xl text-muted-foreground">
          اكسب دعم الجمهور، انشر تعريباتك، وشارك إبداعك مع آلاف اللاعبين
        </p>
      </div>

      {/* Benefits */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <BenefitCard icon="📦" title="انشر تعريباتك" desc="ارفع تعريباتك وشاركها مع المجتمع" />
        <BenefitCard icon="💬" title="تفاعل مع الجمهور" desc="استقبل التعليقات والتقييمات" />
        <BenefitCard icon="📊" title="تابع إحصائياتك" desc="شاهد التحميلات والمشاهدات" />
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link href="/become-creator/apply">
          <Button size="lg" className="text-lg px-8 min-h-[52px]">
            قدّم طلبك الآن
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground mt-3">
          يستغرق التقديم دقيقتين فقط — سيتم مراجعة طلبك خلال 48 ساعة
        </p>
      </div>
    </div>
  )
}
