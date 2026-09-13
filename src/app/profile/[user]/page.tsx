import type { Metadata } from 'next'
import { profileJsonLd } from '@/lib/seo/structured-data'
import { ProfilePage } from '@/views/profile'

export const dynamic = 'force-dynamic' // شخصي — يجب أن يكون مباشراً

interface ProfilePageProps {
  params: Promise<{ user: string }>
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { user } = await params
  const username = decodeURIComponent(user)
  // تجنب double fetch — metadata خفيفة بدون جلب البيانات الكاملة (تم تحسين الأداء)
  const title = `${username} - الملف الشخصي | Games Arabic`
  const description = `الملف الشخصي لـ ${username} على Games Arabic — تصفح التعريبات والنشاط والشارات والإنجازات`
  const url = `https://games-arabic.com/profile/${encodeURIComponent(username)}`
  return {
    title,
    description,
    keywords: [username, 'ملف شخصي', 'Games Arabic', 'تعريب', 'مترجم'],
    authors: [{ name: username }],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'profile',
      siteName: 'Games Arabic',
      locale: 'ar_AR',
      images: [
        { url: 'https://games-arabic.com/og-default.jpg', width: 1200, height: 630, alt: username },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://games-arabic.com/og-default.jpg'],
      site: '@GamesArabic',
    },
  }
}

export default async function ProfileRoutePage({ params }: ProfilePageProps) {
  const { user } = await params
  const username = decodeURIComponent(user)
  let userData: any = null
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/users/${encodeURIComponent(username)}/profile`,
      {
        cache: 'no-store',
      },
    )
    if (res.ok) {
      const json = await res.json()
      userData = json.data?.user || json.data
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort view tracking
  // Fallback to minimal data if API fails — still generate valid Person schema in Arabic
  const personData = userData || {
    username,
    bio: `ملف ${username} على Games Arabic`,
    avatarUrl: 'https://games-arabic.com/og-default.jpg',
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd(personData)) }}
      />
      <ProfilePage />
    </>
  )
}
