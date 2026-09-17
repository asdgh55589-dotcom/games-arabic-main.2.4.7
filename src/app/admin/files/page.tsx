import type { Metadata } from 'next'
import { FilesManager } from '@/components/files-manager'

export const metadata: Metadata = {
  title: 'ملفات الرفع | الإدارة',
  robots: { index: false, follow: false },
}

export default function AdminFilesPage() {
  return (
    <FilesManager
      apiBase="/api/admin/files"
      deleteBase="/api/admin/files"
      showUploader
      title="ملفات الرفع"
    />
  )
}
