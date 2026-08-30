'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, PenTool, Upload, Package, Download, Ban, Star, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { CreatorBadge } from '@/components/creator-badge'
import { AdminDataTable, type Column, type FilterConfig, type BulkAction, type StatItem } from '@/components/admin/shared/AdminDataTable'
import { UserActions } from '@/components/admin/shared/UserActions'
import { parseSpecialRoles, SPECIAL_ROLES } from '@/lib/special-roles'
import { formatNumber } from '@/lib/format'

interface CreatorUser {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  role: string
  tier: number
  specialRoles: string | null
  banStatus: string | null
  bannedUntil: string | null
  createdAt: string
  lastLoginAt: string | null
  _count: { mods: number; comments: number }
  publishedCount: number
  totalDownloads: number
  totalViews: number
  avgRating: number
  teams: { id: string; name: string; logoUrl: string | null }[]
}

interface Props {
  initialData: CreatorUser[]
  totalCount: number
  stats: { creators: number; publishers: number; publishedMods: number; downloads: string; banned: number }
  teams: { id: string; name: string }[]
  currentUser: { id: string; role: string; username: string }
  initialPage: number
  initialPageSize: number
  initialSearch: string
  initialRole: string
  initialTier: string
  initialSpecial: string
  initialStatus: string
  initialTeam: string
  initialSort: string
  initialDirection: string
}

export function CreatorsClient({
  initialData,
  totalCount,
  stats,
  teams,
  currentUser,
  initialPage,
  initialPageSize,
  initialSearch,
  initialRole,
  initialTier,
  initialSpecial,
  initialStatus,
  initialTeam,
  initialSort,
  initialDirection,
}: Props) {
  const router = useRouter()
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState<string[]>(initialRole === 'all' ? [] : [initialRole])
  const [tierFilter, setTierFilter] = useState<string[]>(initialTier === 'all' ? [] : [initialTier])
  const [specialFilter, setSpecialFilter] = useState<string[]>(initialSpecial === 'all' ? [] : [initialSpecial])
  const [statusFilter, setStatusFilter] = useState<string[]>(initialStatus === 'all' ? [] : [initialStatus])
  const [teamFilter, setTeamFilter] = useState<string[]>(initialTeam === 'all' ? [] : [initialTeam])
  const [sortField, setSortField] = useState(initialSort)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialDirection as 'asc' | 'desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const updateUrl = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search)
    Object.entries(patch).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
      else params.delete(k)
    })
    router.push(`/admin/creators?${params.toString()}`)
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(1)
    updateUrl({ search: q, page: '1' })
  }

  const handleFilterChange = (key: string, values: string[]) => {
    if (key === 'role') setRoleFilter(values)
    if (key === 'tier') setTierFilter(values)
    if (key === 'specialRoles') setSpecialFilter(values)
    if (key === 'status') setStatusFilter(values)
    if (key === 'team') setTeamFilter(values)
    updateUrl({ [key]: values[0] || 'all', page: '1' })
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

  const filteredData = useMemo(() => {
    let d = [...initialData]
    if (roleFilter.length > 0) d = d.filter((u) => roleFilter.includes(u.role))
    if (tierFilter.length > 0) d = d.filter((u) => tierFilter.includes(String(u.tier)))
    if (specialFilter.length > 0) d = d.filter((u) => {
      const roles = parseSpecialRoles(u.specialRoles)
      return specialFilter.some((f) => roles.includes(f as never))
    })
    if (statusFilter.length > 0) {
      if (statusFilter[0] === 'banned') d = d.filter((u) => u.banStatus?.startsWith('banned'))
      if (statusFilter[0] === 'active') d = d.filter((u) => u.banStatus === 'active')
    }
    if (teamFilter.length > 0) {
      if (teamFilter[0] === 'none') d = d.filter((u) => u.teams.length === 0)
      else if (teamFilter[0] !== 'all') d = d.filter((u) => u.teams.some((t) => t.id === teamFilter[0]))
    }
    if (search) {
      const q = search.toLowerCase()
      d = d.filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    return d
  }, [initialData, roleFilter, tierFilter, specialFilter, statusFilter, teamFilter, search])

  const statsItems: StatItem[] = [
    { label: 'إجمالي المُعَرِّبين', value: stats.creators, icon: PenTool },
    { label: 'إجمالي الناشرين', value: stats.publishers, icon: Upload },
    { label: 'إجمالي التعريبات المنشورة', value: stats.publishedMods, icon: Package },
    { label: 'إجمالي التحميلات', value: stats.downloads, icon: Download },
    { label: 'محظور', value: stats.banned, icon: Ban },
  ]

  const columns: Column<CreatorUser>[] = [
    {
      key: 'username',
      label: 'المُعَرِّب',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={u.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">{u.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-1 truncate">
              {u.username}
              <CreatorBadge role={u.role} specialRoles={u.specialRoles} size="sm" />
            </div>
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
      key: 'tier',
      label: 'المستوى',
      sortable: true,
      render: (u) => <TierBadge role={u.role} tier={u.tier} size="sm" />,
    },
    {
      key: 'specialRoles',
      label: 'الأدوار الخاصة',
      render: (u) => {
        const roles = parseSpecialRoles(u.specialRoles)
        if (roles.length === 0) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1 max-w-[160px]">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="text-[11px]">
                {SPECIAL_ROLES[r].nameAr}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      key: 'publishedCount',
      label: 'التعريبات المنشورة',
      sortable: true,
      render: (u) => <span className="font-bold">{formatNumber(u.publishedCount)}</span>,
    },
    {
      key: 'totalDownloads',
      label: 'التحميلات',
      sortable: true,
      render: (u) => <span className="font-medium">{u.totalDownloads.toLocaleString('ar-EG')}</span>,
    },
    {
      key: 'avgRating',
      label: 'التقييم',
      sortable: true,
      render: (u) => (
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-500" />
          {u.avgRating.toFixed(1)}
        </span>
      ),
    },
    {
      key: 'teams',
      label: 'الفرق',
      render: (u) => {
        if (u.teams.length === 0) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1 max-w-[150px]">
            {u.teams.map((t) => (
              <Badge key={t.id} variant="secondary" className="text-[11px]">
                {t.name}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      key: 'createdAt',
      label: 'تاريخ الانضمام',
      sortable: true,
      render: (u) => new Date(u.createdAt).toLocaleDateString('ar-EG'),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: false,
      render: (u) =>
        u.banStatus?.startsWith('banned') ? (
          <Badge variant="destructive" className="text-xs">
            محظور
          </Badge>
        ) : (
          <Badge variant="default" className="text-xs">
            نشط
          </Badge>
        ),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      render: (u) => (
        <div className="flex items-center gap-1">
          <UserActions user={u as never} currentUser={currentUser as never} onActionComplete={() => router.refresh()} />
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="عرض التعريبات">
            <Link href={`/admin/mods?author=${u.id}`}>📦</Link>
          </Button>
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
        { label: 'مُعَرِّب', value: 'creator' },
        { label: 'ناشر', value: 'publisher' },
      ],
    },
    {
      key: 'tier',
      label: 'المستوى',
      type: 'checkbox',
      options: [
        { label: 'المستوى 1', value: '1' },
        { label: 'المستوى 2', value: '2' },
        { label: 'المستوى 3', value: '3' },
        { label: 'المستوى 4', value: '4' },
        { label: 'المستوى 5', value: '5' },
      ],
    },
    {
      key: 'specialRoles',
      label: 'الأدوار الخاصة',
      type: 'checkbox',
      options: Object.entries(SPECIAL_ROLES).map(([key, config]) => ({
        label: config.nameAr,
        value: key,
      })),
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
    {
      key: 'team',
      label: 'الفريق',
      type: 'select',
      options: [
        { label: 'الكل', value: 'all' },
        { label: 'بدون فريق', value: 'none' },
        ...teams.map((t) => ({ label: t.name, value: t.id })),
      ],
    },
  ]

  const activeFilters: Record<string, string[]> = {
    role: roleFilter,
    tier: tierFilter,
    specialRoles: specialFilter,
    status: statusFilter,
    team: teamFilter,
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'تحذير جماعي',
      variant: 'outline',
      confirmMessage: 'هل تريد إرسال تحذير للمُعَرِّبين المحددين؟',
      onAction: async (ids) => {
        for (const id of ids) {
          await fetch(`/api/admin/users/${id}/warn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'تحذير جماعي من إدارة المُعَرِّبين' }),
          })
        }
        router.refresh()
      },
    },
    {
      label: 'حظر جماعي',
      variant: 'destructive',
      confirmMessage: 'هل تريد حظر المُعَرِّبين المحددين؟ تعريباتهم المنشورة ستبقى.',
      onAction: async (ids) => {
        for (const id of ids) {
          await fetch(`/api/admin/users/${id}/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'perm', reason: 'حظر جماعي' }),
          })
        }
        router.refresh()
      },
    },
    {
      label: 'سحب الاعتماد الجماعي',
      variant: 'destructive',
      confirmMessage: 'هل تريد سحب الاعتماد من المُعَرِّبين المحددين؟ سيتم تنزيلهم لأعضاء.',
      onAction: async (ids) => {
        for (const id of ids) {
          await fetch(`/api/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'member' }),
          })
        }
        router.refresh()
      },
    },
    {
      label: 'تصدير CSV',
      variant: 'outline',
      onAction: async (ids) => {
        const selected = filteredData.filter((u) => ids.includes(u.id))
        const headers = ['اسم المستخدم', 'البريد', 'الدور', 'المستوى', 'التعريبات', 'التحميلات', 'التقييم']
        const rows = selected.map((u) => [u.username, u.email, u.role, String(u.tier), String(u.publishedCount), String(u.totalDownloads), String(u.avgRating)])
        const csv = `\uFEFF${headers.join(',')}\n${rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')}`
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'creators.csv'
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ]

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة المُعَرِّبين والناشرين</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة كل المُعَرِّبين والناشرين مع إحصائياتهم — {totalCount} مستخدم</p>
        </div>
        <Button asChild className="min-h-[44px]">
          <Link href="/admin/creators/new">
            <Plus className="h-4 w-4 ml-2" />
            إضافة مُعَرِّب يدوياً
          </Link>
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
          title: 'لا يوجد مُعَرِّبين أو ناشرين',
          description: 'لم يتم قبول أي طلبات ترقية بعد',
          action: { label: 'مراجعة طلبات الترقية', href: '/admin/creators/requests' },
        }}
        exportable
        exportFilename="creators.csv"
        mobileCardView={(user, isSelected, onToggle) => (
          <Card className={isSelected ? 'ring-1 ring-primary/30 bg-primary/5' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-1 truncate">
                    {user.username}
                    <CreatorBadge role={user.role} specialRoles={user.specialRoles} size="sm" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <RoleBadge role={user.role} size="sm" />
                    <TierBadge role={user.role} tier={user.tier} size="sm" />
                  </div>
                </div>
                <UserActions user={user as never} currentUser={currentUser as never} onActionComplete={() => router.refresh()} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                <div className="text-center">
                  <div className="font-bold">{user.publishedCount}</div>
                  <div className="text-xs text-muted-foreground">تعريب</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{user.totalDownloads.toLocaleString('ar-EG')}</div>
                  <div className="text-xs text-muted-foreground">تحميل</div>
                </div>
                <div className="text-center">
                  <div className="font-bold flex items-center justify-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    {user.avgRating.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">تقييم</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {user.teams.length > 0 ? (
                  user.teams.map((t) => (
                    <Badge key={t.id} variant="secondary" className="text-[11px]">
                      {t.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">بدون فريق</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 min-h-[44px] text-xs" onClick={onToggle}>
                  {isSelected ? 'إلغاء التحديد' : 'تحديد'}
                </Button>
                <Button asChild variant="ghost" size="sm" className="flex-1 min-h-[44px] text-xs">
                  <Link href={`/admin/users/${user.id}`}>عرض الملف</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      />
    </div>
  )
}
