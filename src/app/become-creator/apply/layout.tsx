import { StudioLanguageProvider } from '@/lib/studio-i18n/context'

export default function BecomeCreatorApplyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StudioLanguageProvider>{children}</StudioLanguageProvider>
}
