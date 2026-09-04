'use client'

import {
  Activity,
  Ban,
  Clock,
  Crown,
  History,
  Key,
  Plus,
  Shield,
  UserCog,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CreateStaffDialog } from '@/components/admin/create-staff-dialog'
import { EditCredentialsDialog } from '@/components/admin/edit-credentials-dialog'
import {
  AdminDataTable,
  type BulkAction,
  type Column,
  type FilterConfig,
  type StatItem,
} from '@/components/admin/shared/AdminDataTable'
import { UserActions } from '@/components/admin/shared/UserActions'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber, timeAgo } from '@/lib/format'

interface AdminUser {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  role: string
  tier: number
  specialRoles: string | null
  banStatus: string | null
  bannedUntil: string | null
  banReason: string | null
  createdAt: string
  lastLoginAt: string | null
  joinedAt: string
  securityKeyExpiresAt: string | null
  securityKeyChangedAt: string | null
  _count: { mods: number; comments: number }
}

interface AuditLogItem {
  id: string
  username: string
  action: string
  entityId: string | null
  details: string | null
  createdAt: string
}

interface Props {
  initialData: AdminUser[]
  totalCount: number
  stats: { moderators: number; admins: number; managers: number; active24h: number; banned: number }
  currentUser: { id: string; role: string; username: string }
  initialPage: number
  initialPageSize: number
  initialSearch: string
  initialRole: string
  initialStatus: string
  initialSort: string
  initialDirection: string
  auditLogs?: AuditLogItem[]
}

export function AdminsClient({
  initialData,
  totalCount,
  stats,
  currentUser,
  initialPage,
  initialPageSize,
  initialSearch,
  initialRole,
  initialStatus,
  initialSort,
  initialDirection,
  auditLogs = [],
}: Props) {
  const router = useRouter()
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState<string[]>(initialRole === 'all' ? [] : [initialRole])
  const [statusFilter, setStatusFilter] = useState<string[]>(
    initialStatus === 'all' ? [] : [initialStatus],
  )
  const [sortField, setSortField] = useState(initialSort)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initialDirection as 'asc' | 'desc',
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [credUser, setCredUser] = useState<AdminUser | null>(null)

  const updateUrl = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search)
    Object.entries(patch).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else params.delete(k)
    })
    router.push(`/admin/admins?${params.toString()}`)
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(1)
    updateUrl({ search: q, page: '1' })
  }

  const handleFilterChange = (key: string, values: string[]) => {
    if (key === 'role') {
      setRoleFilter(values)
      updateUrl({ role: values[0] || 'all', page: '1' })
    }
    if (key === 'status') {
      setStatusFilter(values)
      updateUrl({ status: values[0] || 'all', page: '1' })
    }
    setPage(1)
  }

  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
    updateUrl({ sort: field, direction })
  }

  const handlePageChange = (p: number) => {
    setPage(p)
    updateUrl({ page: String(p) })
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    updateUrl({ pageSize: String(size), page: '1' })
    setPage(1)
  }

  // Client-side filtering for instant UX (since data already paginated server-side, this is just for current page)
  const filteredData = useMemo(() => {
    let d = [...initialData]
    if (roleFilter.length > 0) d = d.filter((u) => roleFilter.includes(u.role))
    if (statusFilter.length > 0) {
      if (statusFilter[0] === 'banned') d = d.filter((u) => u.banStatus?.startsWith('banned'))
      if (statusFilter[0] === 'active') d = d.filter((u) => u.banStatus === 'active')
    }
    if (search) {
      const q = search.toLowerCase()
      d = d.filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    return d
  }, [initialData, roleFilter, statusFilter, search])

  const statsItems: StatItem[] = [
    {
      label: 'إجمالي المشرفين',
      value: stats.moderators,
      icon: Shield,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'إجمالي المسؤولين',
      value: stats.admins,
      icon: UserCog,
      color: 'bg-purple-500/10 text-purple-500',
    },
    {
      label: 'إجمالي المديرين',
      value: stats.managers,
      icon: Crown,
      color: 'bg-amber-500/10 text-amber-500',
    },
    {
      label: 'نشط (آخر 24 ساعة)',
      value: stats.active24h,
      icon: Activity,
      color: 'bg-green-500/10 text-green-500',
    },
    { label: 'محظور', value: stats.banned, icon: Ban, color: 'bg-red-500/10 text-red-500' },
  ]

  const columns: Column<AdminUser>[] = [
    {
      key: 'username',
      label: 'المستخدم',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={u.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">{u.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium truncate">{u.username}</div>
            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'الدور',
      sortable: true,
      render: (u) => <RoleBadge role={u.role} size="sm" />,
    },
    {
      key: 'keyStatus',
      label: 'مفتاح الأمان',
      sortable: false,
      render: (u) => {
        if (!u.securityKeyExpiresAt) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-600">
              <Key className="h-3 w-3" /> بدون انتهاء
            </span>
          )
        }
        const exp = new Date(u.securityKeyExpiresAt)
        const isExpired = exp < new Date()
        const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000)
        if (isExpired) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500">
              <Clock className="h-3 w-3" /> منتهي
            </span>
          )
        }
        if (daysLeft <= 7) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600">
              <Clock className="h-3 w-3" /> {daysLeft} يوم
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-500">
            <Clock className="h-3 w-3" /> {daysLeft} يوم
          </span>
        )
      },
    },
    {
      key: 'mods',
      label: 'التعريبات',
      sortable: true,
      render: (u) => formatNumber(u._count.mods),
    },
    {
      key: 'lastLogin',
      label: 'آخر دخول',
      sortable: true,
      render: (u) => (u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'لم يدخل بعد'),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: false,
      render: (u) => {
        const isBanned = u.banStatus?.startsWith('banned')
        return isBanned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500">
            <Ban className="h-3 w-3" /> محظور
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-500">
            نشط
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'إجراءات',
      sortable: false,
      render: (u) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCredUser(u)}
            title="تعديل بيانات الاعتماد"
          >
            <Key className="h-4 w-4" />
          </Button>
          <UserActions
            user={u as never}
            currentUser={currentUser as never}
            onActionComplete={() => router.refresh()}
          />
        </div>
      ),
      width: '120px',
    },
  ]

  const filters: FilterConfig[] = [
    {
      key: 'role',
      label: 'الدور',
      type: 'checkbox',
      options: [
        { label: 'مشرف', value: 'moderator' },
        { label: 'مسؤول', value: 'admin' },
        { label: 'مدير', value: 'manager' },
        { label: 'مالك', value: 'owner' },
      ],
    },
    {
      key: 'status',
      label: 'الحالة',
      type: 'radio',
      options: [
        { label: 'الكل', value: 'all' },
        { label: 'نشط', value: 'active' },
        { label: 'محظور', value: 'banned' },
      ],
    },
  ]

  const activeFilters: Record<string, string[]> = {
    role: roleFilter,
    status: statusFilter,
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'تحذير جماعي',
      icon: 'AlertTriangle',
      variant: 'outline',
      confirmMessage: 'هل تريد إرسال تحذير للمستخدمين المحددين؟',
      onAction: async (ids) => {
        for (const id of ids) {
          await fetch(`/api/admin/users/${id}/warn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'تحذير جماعي من الإدارة' }),
          })
        }
        router.refresh()
      },
    },
    {
      label: 'حظر جماعي',
      icon: 'Ban',
      variant: 'destructive',
      confirmMessage: 'هل تريد حظر المستخدمين المحددين؟ هذا الإجراء خطير.',
      onAction: async (ids) => {
        for (const id of ids) {
          await fetch(`/api/admin/users/${id}/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'perm', reason: 'حظر جماعي من الإدارة' }),
          })
        }
        router.refresh()
      },
    },
    {
      label: 'تصدير CSV',
      icon: 'Download',
      variant: 'outline',
      onAction: async (ids) => {
        const selected = filteredData.filter((u) => ids.includes(u.id))
        const headers = ['اسم المستخدم', 'البريد', 'الدور', 'الحالة']
        const rows = selected.map((u) => [u.username, u.email, u.role, u.banStatus || 'active'])
        const csv = `\uFEFF${headers.join(',')}\n${rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')}`
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'administrators.csv'
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ]

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الفريق</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة المشرفين والمسؤولين والمديرين — {totalCount} مسؤول — شامل 4 بيانات اعتماد ومفتاح
            الأمان
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="min-h-[44px]">
          <Plus className="h-4 w-4 ml-2" />
          تعيين عضو جديد
        </Button>
      </div>

      <AdminDataTable
        data={filteredData}
        columns={columns}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        searchQuery={search}
        onSearch={handleSearch}
        searchPlaceholder="ابحث بالاسم أو البريد..."
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={bulkActions}
        stats={statsItems}
        emptyState={{
          icon: 'Users',
          title: 'لا يوجد مسؤولين',
          description: 'لم يتم إضافة أي مشرفين أو مسؤولين بعد',
          action: { label: 'إضافة مسؤول جديد', href: '/admin/admins/new' },
        }}
        exportable
        exportFilename="administrators.csv"
        mobileCardView={(user, isSelected, onToggle) => (
          <Card className={isSelected ? 'ring-1 ring-primary/30 bg-primary/5' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.username}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCredUser(user)}
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                  <UserActions
                    user={user as never}
                    currentUser={currentUser as never}
                    onActionComplete={() => router.refresh()}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  الدور: <RoleBadge role={user.role} size="sm" />
                </div>
                <div>
                  المفتاح:{' '}
                  {user.securityKeyExpiresAt ? (
                    new Date(user.securityKeyExpiresAt) < new Date() ? (
                      <span className="text-red-500 font-bold">منتهي</span>
                    ) : (
                      <span className="text-blue-500 font-bold">
                        {Math.ceil(
                          (new Date(user.securityKeyExpiresAt).getTime() - Date.now()) / 86400000,
                        )}{' '}
                        يوم
                      </span>
                    )
                  ) : (
                    <span className="text-green-600 font-bold">بدون انتهاء</span>
                  )}
                </div>
                <div>التعريبات: {formatNumber(user._count.mods)}</div>
                <div>
                  الحالة:{' '}
                  {user.banStatus?.startsWith('banned') ? (
                    <span className="text-red-500 font-bold">محظور</span>
                  ) : (
                    <span className="text-green-500 font-bold">نشط</span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-h-[44px] text-xs"
                  onClick={onToggle}
                >
                  {isSelected ? 'إلغاء التحديد' : 'تحديد'}
                </Button>
                <Button asChild variant="ghost" size="sm" className="flex-1 min-h-[44px] text-xs">
                  <Link href={`/admin/users/${user.id}`}>عرض التفاصيل</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      />

      {/* سجل الإجراءات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> سجل الإجراءات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا يوجد سجل بعد — ستظهر إجراءات التعيين والترقية وتغيير المفتاح هنا.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-right">الإجراء</th>
                    <th className="py-2 text-right">بواسطة</th>
                    <th className="py-2 text-right">التفاصيل</th>
                    <th className="py-2 text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{log.action}</td>
                      <td className="py-2">{log.username}</td>
                      <td className="py-2 text-xs text-muted-foreground max-w-xs truncate">
                        {log.details || '—'}
                      </td>
                      <td className="py-2 text-xs">
                        {new Date(log.createdAt).toLocaleDateString('ar-EG')}{' '}
                        {new Date(log.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateStaffDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => router.refresh()}
      />
      {credUser && (
        <EditCredentialsDialog
          open={!!credUser}
          onOpenChange={(o) => !o && setCredUser(null)}
          userId={credUser.id}
          username={credUser.username}
          onUpdated={() => router.refresh()}
        />
      )}
    </div>
  )
}
