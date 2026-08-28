import { AdminSurface } from '@/components/admin/admin-surface'

interface UsersHeroProps {
  totalUsers: number
  bannedUsers: number
}

export function UsersHero({ totalUsers, bannedUsers }: UsersHeroProps) {
  return (
    <AdminSurface glow className="p-7">
      <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-primary/80">
            Community Control
          </div>

          <h1 className="mt-5 text-4xl font-black text-white">
            إدارة المستخدمين
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
            مراقبة الحسابات وإدارة الأدوار والحظر والتحذيرات من مركز تحكم موحد.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:min-w-[420px]">
          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">إجمالي المستخدمين</div>
            <div className="mt-2 text-[22px] font-semibold text-foreground">
              {totalUsers}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">الحسابات المحظورة</div>
            <div className="mt-2 text-[22px] font-semibold text-red">
              {bannedUsers}
            </div>
          </div>
        </div>
      </div>
    </AdminSurface>
  )
}
