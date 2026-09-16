import type { Metadata } from 'next'
import { StudioLanguageProvider } from '@/lib/studio-i18n/context'

export const metadata: Metadata = {
  title: 'قدّم كمبدع',
  description: 'قدّم طلباً للانضمام إلى فريق مبدعي Games Arabic',
}

export default function BecomeCreatorApplyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StudioLanguageProvider>{children}</StudioLanguageProvider>
}
