import type { Metadata } from 'next'
import AdminLoginClient from './client'

export const metadata: Metadata = {
  title: 'تسجيل دخول الإدارة - Games Arabic',
  description: 'تسجيل دخول لوحة تحكم Games Arabic للمشرفين',
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return <AdminLoginClient />
}
