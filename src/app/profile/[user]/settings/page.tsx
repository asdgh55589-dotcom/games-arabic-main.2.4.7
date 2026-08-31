import type { Metadata } from 'next'
import ProfileSettingsView from '@/views/profile-settings'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ user: string }> }): Promise<Metadata> {
  const { user } = await params
  return {
    title: `إعدادات ${decodeURIComponent(user)} — GAMES ARABIC`,
    description: 'إعدادات الملف الشخصي — تعديل اسم العرض والبيانات',
    robots: { index: false, follow: false },
  }
}

export default async function ProfileSettingsPage({ params }: { params: Promise<{ user: string }> }) {
  const { user } = await params
  return <ProfileSettingsView username={decodeURIComponent(user)} />
}
