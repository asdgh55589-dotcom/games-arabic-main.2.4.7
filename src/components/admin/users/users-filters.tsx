import { Search } from 'lucide-react'

import { AdminSurface } from '@/components/admin/admin-surface'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
            className="h-10 rounded-md border border-border bg-background-secondary pr-10"
          />
        </div>

        <Select value={roleFilter} onValueChange={onRoleChange}>
          <SelectTrigger className="h-10 w-full rounded-md border border-border bg-background-secondary px-3 text-sm text-foreground xl:w-auto">
            <SelectValue placeholder="كل الأدوار" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأدوار</SelectItem>
            <SelectItem value="owner">مالك</SelectItem>
            <SelectItem value="admin">مدير</SelectItem>
            <SelectItem value="moderator">مشرف</SelectItem>
            <SelectItem value="member">عضو</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bannedFilter} onValueChange={onBannedChange}>
          <SelectTrigger className="h-10 w-full rounded-md border border-border bg-background-secondary px-3 text-sm text-foreground xl:w-auto">
            <SelectValue placeholder="الكل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="banned">محظور</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </AdminSurface>
  )
}
