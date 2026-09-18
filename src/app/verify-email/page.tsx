import { redirect } from 'next/navigation'

/**
 * Phase 4C merge: /verify-email (legacy Supabase/Better-Auth info page) is
 * folded into /verify-email-address (custom token backend + Supabase resend
 * section). Legacy tokens are dead — redirect canonically.
 */
export default function VerifyEmailPage() {
  redirect('/verify-email-address')
}
