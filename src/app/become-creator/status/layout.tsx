import type { Metadata } from 'next'
import { StudioLanguageProvider } from '@/lib/studio-i18n/context'

export const metadata: Metadata = {
  title: 'حالة الطلب',
  description: 'تتبع حالة طلب الانضمام إلى فريق المبدعين',
}

export default function BecomeCreatorStatusLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StudioLanguageProvider>{children}</StudioLanguageProvider>
}
