import Image from 'next/image'
import { LoginForm } from '@/components/official-login/login-form'

/**
 * Official shadcn login-03 page shell (D.C): structure mirrors the registry
 * item — centered muted column, brand row, max-w-sm form. Only the brand
 * (site logo + Arabic name) and direction (RTL) changed.
 */
export function OfficialLoginPage() {
  return (
    <div
      dir="rtl"
      className="official-login-scope flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10"
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md">
            <Image src="/logo.png" alt="ألعاب بالعربي" width={32} height={32} className="h-8 w-8 object-contain" />
          </span>
          ألعاب بالعربي
        </a>
        <LoginForm />
      </div>
    </div>
  )
}
