import { StudioLanguageProvider } from '@/lib/studio-i18n/context'

export default function BecomeCreatorStatusLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StudioLanguageProvider>{children}</StudioLanguageProvider>
}
