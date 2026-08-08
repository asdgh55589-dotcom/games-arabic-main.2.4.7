import { AlertTriangle, Ban, Shield } from 'lucide-react'

import { AdminSurface } from '@/components/admin/admin-surface'

interface ModerationSummaryProps {
  recentlyActive: number
  bannedUsers: number
  moderators: number
  admins: number
}

export function ModerationSummary({
  recentlyActive,
  bannedUsers,
  moderators,
  admins,
}: ModerationSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <AdminSurface className="border-emerald-500/15 bg-emerald-500/10 p-5">
        <div className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300/80">
          Active Community
        </div>

        <div className="mt-4 text-4xl font-black text-emerald-300">
          {recentlyActive}
        </div>

        <p className="mt-3 text-sm leading-6 text-emerald-100/60">
          مستخدم نشط خلال آخر 7 أيام.
        </p>
      </AdminSurface>

      <AdminSurface className="border-orange-500/15 bg-orange-500/10 p-5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-orange-300/80">
          <Ban className="h-4 w-4" />
          Moderation Queue
        </div>

        <div className="mt-4 text-4xl font-black text-orange-300">
          {bannedUsers}
        </div>

        <p className="mt-3 text-sm leading-6 text-orange-100/60">
          حسابات محظورة أو تحت المراجعة.
        </p>
      </AdminSurface>

      <AdminSurface className="border-cyan-500/15 bg-cyan-500/10 p-5">
        <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300/80">
          Moderators
        </div>

        <div className="mt-4 text-4xl font-black text-cyan-300">
          {moderators}
        </div>

        <p className="mt-3 text-sm leading-6 text-cyan-100/60">
          مشرفون يديرون المجتمع حاليًا.
        </p>
      </AdminSurface>

      <AdminSurface className="border-violet-500/15 bg-violet-500/10 p-5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-violet-300/80">
          <Shield className="h-4 w-4" />
          Administrators
        </div>

        <div className="mt-4 text-4xl font-black text-violet-300">
          {admins}
        </div>

        <p className="mt-3 text-sm leading-6 text-violet-100/60">
          حسابات إدارية بصلاحيات مرتفعة.
        </p>
      </AdminSurface>

      <AdminSurface className="sm:col-span-2 2xl:col-span-4 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-primary/70">
              Moderation Workflow
            </div>

            <h3 className="mt-3 text-xl font-black text-white">
              مركز الإشراف السريع
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/55">
              إدارة الحسابات والتنبيهات والحظر وإجراءات المجتمع من مكان واحد بسرعة أكبر.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-red-500/15 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
              <Ban className="h-4 w-4" />
              مراجعة الحسابات المحظورة
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/15 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-300">
              <AlertTriangle className="h-4 w-4" />
              إدارة التحذيرات
            </div>
          </div>
        </div>
      </AdminSurface>
    </div>
  )
}
