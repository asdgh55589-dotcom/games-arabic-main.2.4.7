import { BarChart3, Upload, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'كن معرّباً — GAMES ARABIC',
  description: 'انضم لفريق المُعَرِّبين وشارك تعريباتك مع آلاف اللاعبين',
  robots: { index: true, follow: true },
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
        {icon}
      </div>
      <h3 className="font-bold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

export default function BecomeCreatorPage() {
  return (
    <div className="container mx-auto py-12 max-w-3xl px-4" dir="rtl">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 mb-5">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-3 tracking-tight">كن معرّباً</h1>
        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
          انضم إلى مجتمع المُعَرِّبين، انشر تعريباتك، وتفاعل مع آلاف اللاعبين المتحمسين للعب بالعربية
        </p>
      </div>

      {/* Benefits — compact */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <BenefitCard
          icon={<Upload className="h-6 w-6" />}
          title="انشر تعريباتك"
          description="ارفع تعريباتك وشاركها مع آلاف اللاعبين"
        />
        <BenefitCard
          icon={<Users className="h-6 w-6" />}
          title="تفاعل مع الجمهور"
          description="استقبل التعليقات والتقييمات وابنِ جمهورك"
        />
        <BenefitCard
          icon={<BarChart3 className="h-6 w-6" />}
          title="تابع إحصائياتك"
          description="شاهد التحميلات والمشاهدات والتقدم"
        />
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link href="/become-creator/apply">
          <Button size="lg" className="text-base px-8 min-h-[48px]">
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
