import type { Metadata } from 'next'
import { PlatformPage } from '@/views/platform'

export const revalidate = 300 // ISR: 5m — نادراً ما تتغير

interface PlatformPageProps {
  params: Promise<{ key: string }>
}

const platformNames: Record<string, string> = {
  PC: 'PC',
  X360: 'Xbox 360',
  NS: 'Nintendo Switch',
  PS5: 'PlayStation 5',
  PS4: 'PlayStation 4',
  PS3: 'PlayStation 3',
  PS2: 'PlayStation 2',
  PS1: 'PlayStation 1',
  ANDROID: 'Android',
}

export async function generateMetadata({ params }: PlatformPageProps): Promise<Metadata> {
  const { key } = await params
  const name = platformNames[key] || key
  const title = `تعريبات ${name} - Games Arabic`
  const description = `تحميل أفضل التعريبات العربية لأجهزة ${name} - تعريبات احترافية عالية الجودة`
  const url = `https://games-arabic.com/platform/${key}`
  const imageUrl = `https://games-arabic.com/og-default.jpg`

  return {
    title,
    description,
    keywords: [name, 'تعريب', 'ترجمة', 'العربية', 'تعريب ألعاب', `تعريبات ${name}`],
    authors: [{ name: 'Games Arabic' }],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Games Arabic',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `تعريبات ${name}` }],
      locale: 'ar_AR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: '@GamesArabic',
    },
  }
}

export default function PlatformRoutePage() {
  return <PlatformPage />
}
