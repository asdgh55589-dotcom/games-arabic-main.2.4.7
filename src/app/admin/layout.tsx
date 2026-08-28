import type { Metadata } from 'next'
import AdminLayoutClient from './layout-client'

export const metadata: Metadata = {
  title: 'لوحة التحكم - Games Arabic',
  description: 'لوحة تحكم إدارة موقع Games Arabic',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
