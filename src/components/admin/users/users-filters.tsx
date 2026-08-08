import { Search } from 'lucide-react'

import { AdminSurface } from '@/components/admin/admin-surface'
import { Input } from '@/components/ui/input'

interface UsersFiltersProps {
  search: string
  roleFilter: string
  bannedFilter: string
  onSearchChange: (value: string) => void
  onRoleChange: (value: string) => void
  onBannedChange: (value: string) => void
}

export function UsersFilters({
  search,
  roleFilter,
  bannedFilter,
  onSearchChange,
  onRoleChange,
  onBannedChange,
}: UsersFiltersProps) {
  return (
    <AdminSurface className="p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث بالاسم أو البريد..."
            className="h-12 rounded-2xl border-white/10 bg-white/[0.03] pr-10"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => onRoleChange(e.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white"
        >
          <option value="all">كل الأدوار</option>
          <option value="owner">مالك</option>
          <option value="admin">مدير</option>
          <option value="moderator">مشرف</option>
          <option value="member">عضو</option>
        </select>

        <select
          value={bannedFilter}
          onChange={(e) => onBannedChange(e.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white"
        >
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="banned">محظور</option>
        </select>
      </div>
    </AdminSurface>
  )
}
