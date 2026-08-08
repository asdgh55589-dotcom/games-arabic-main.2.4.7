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

          <p className="mt-4 max-w-2xl text-base leading-8 text-white/60">
            مراقبة الحسابات وإدارة الأدوار والحظر والتحذيرات من مركز تحكم موحد.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:min-w-[420px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs font-bold text-white/45">إجمالي المستخدمين</div>
            <div className="mt-3 text-4xl font-black text-primary">
              {totalUsers}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs font-bold text-white/45">الحسابات المحظورة</div>
            <div className="mt-3 text-4xl font-black text-red-400">
              {bannedUsers}
            </div>
          </div>
        </div>
      </div>
    </AdminSurface>
  )
}
