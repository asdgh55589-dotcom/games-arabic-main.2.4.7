'use client'

import { useState, useEffect } from 'react'
import { Database, Download, Trash2, RefreshCw, Loader2, HardDrive } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface BackupInfo {
  id: string
  filename: string
  size: number
  type: string
  status: string
  createdAt: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/backup')
      const data = await res.json()
      setBackups(data.data?.backups || [])
      setTotalSize(data.data?.totalSize || 0)
    } catch (err) {
      console.error('Failed to fetch backups:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleanup: true }),
      })
      const data = await res.json()
      if (data.data?.status === 'completed') {
        fetchBackups()
      } else {
        alert(data.data?.error || 'فشل النسخ الاحتياطي')
      }
    } catch (err) {
      alert('فشل النسخ الاحتياطي')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (filename: string) => {
    if (!confirm('هل تريد حذف هذه النسخة الاحتياطية؟')) return
    try {
      await fetch(`/api/admin/backup?filename=${filename}`, { method: 'DELETE' })
      fetchBackups()
    } catch (err) {
      alert('فشل الحذف')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[100px] rounded-lg" />)}
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">النسخ الاحتياطي</h1>
            <p className="text-sm text-muted-foreground">إدارة النسخ الاحتياطية للقاعدة البيانات</p>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          نسخ احتياطي الآن
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">إجمالي النسخ</div>
                <div className="text-2xl font-bold">{backups.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-xs text-muted-foreground">الحجم الكلي</div>
                <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-xs text-muted-foreground">آخر نسخة</div>
                <div className="text-sm font-bold">
                  {backups[0]
                    ? new Date(backups[0].createdAt).toLocaleDateString('ar-SA')
                    : 'لا توجد'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backups Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">النسخ الاحتياطية</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-right font-medium">الملف</th>
                  <th className="px-4 py-3 text-right font-medium">الحجم</th>
                  <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                  <th className="px-4 py-3 text-right font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      لا توجد نسخ احتياطية
                    </td>
                  </tr>
                ) : (
                  backups.map((backup) => (
                    <tr key={backup.filename} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{backup.filename}</td>
                      <td className="px-4 py-3">{formatBytes(backup.size)}</td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(backup.createdAt).toLocaleString('ar-SA')}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(backup.filename)}
                          className="text-red-600 hover:text-red-700 min-h-[44px]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
