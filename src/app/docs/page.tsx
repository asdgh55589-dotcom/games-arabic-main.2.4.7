import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'توثيق API — Games Arabic',
  description: 'التوثيق التفاعلي لواجهة Games Arabic البرمجية',
  robots: { index: false, follow: false },
}

// The Scalar UI is served from the /api/docs route handler
// (the installed Scalar version exposes a handler, not a component).
export default function DocsPage() {
  redirect('/api/docs')
}
