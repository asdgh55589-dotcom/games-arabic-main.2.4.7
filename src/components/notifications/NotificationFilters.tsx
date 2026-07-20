// src/components/notifications/NotificationFilters.tsx
interface NotificationFiltersProps {
  filters: { type: string; read: string }
  onFilterChange: (filters: { type: string; read: string }) => void
}

export function NotificationFilters({
  filters,
  onFilterChange
}: NotificationFiltersProps) {
  return (
    <div className="flex gap-4 mb-6">
      <select
        value={filters.type}
        onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
        className="border rounded-lg px-3 py-2"
      >
        <option value="all">جميع الأنواع</option>
        <option value="like">إعجابات</option>
        <option value="comment">تعليقات</option>
        <option value="admin">إدارية</option>
        <option value="system">نظام</option>
      </select>

      <select
        value={filters.read}
        onChange={(e) => onFilterChange({ ...filters, read: e.target.value })}
        className="border rounded-lg px-3 py-2"
      >
        <option value="all">الكل</option>
        <option value="false">غير مقروءة</option>
        <option value="true">مقروءة</option>
      </select>
    </div>
  )
}
