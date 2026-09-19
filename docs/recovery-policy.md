# Recovery Policy (Phase 4B)

How each account type recovers access. Public responses stay generic
(anti-enumeration) — this document is the internal source of truth.

## 1. Email users (verified, non-synthetic)

- Self-service: `POST /api/auth/recover` → 1-hour single-use link → reset.
- Blocked while a setup-added address is unverified (`EMAIL_UNVERIFIED`,
  owner-only message); strangers always get generic ok.
- Rate limits: 5/15min per IP on `/recover`, 10/min on `/reset-password`.

## 2. Two-step email change (Fix 5)

- A newly added address is **pending** until the inbox link is clicked —
  it never becomes primary early, so a typo cannot lock the user out.
- Pending state is visible in Settings (`pendingEmail`) with resend +
  explicit cancel; links expire after 24h (expiry auto-clears pending).
- The old address is notified best-effort when it is deliverable.

## 3. Telegram-only users (synthetic `@telegram.local`, no password)

- `POST /api/auth/recover` returns generic ok but sends nothing — there is
  no inbox. This is intentional (no oracle), NOT a working path.
- Recovery is **admin-assisted only**:
  1. User contacts support with proof of ownership (username + approximate
     join date / linked Google account / device history).
  2. Owner/admin verifies out-of-band, then calls
     `POST /api/admin/users/[id]/recover` (owner/admin role required,
     10/min, audited as `admin_account_recovery`).
  3. The endpoint sets a one-time 16-char temporary password (bcrypt-only),
     kills all live sessions, and returns the plaintext **exactly once**
     for the admin to convey out-of-band (support chat). It is never
     logged or persisted.
  4. The user logs in with username + temp password, then MUST set a real
     password via change-password (temp satisfies "current password" once).
- The recover page carries a static (always-visible, non-oracle) note
  pointing Telegram users to support.

## 4. MFA device loss

- Login with password/security-key issues a 10-minute MFA challenge token;
  `POST /api/auth/mfa/recovery` accepts `{ mfaToken, code }` where `code`
  is one of the 10 single-use backup codes shown at setup (3/hour/IP,
  audited: `mfa_recovery_used` / `mfa_recovery_failed`).
- Raw-`userId` recovery was removed (enumeration oracle).
- If backup codes are also lost → admin-assisted recovery (§3), then the
  user re-enrolls TOTP (old secret is wiped by onboarding or re-setup).

## 5. Audit trail

Every recovery event is logged: `password_recovery_requested`,
`account_locked`, `mfa_recovery_used/failed`, `mfa_disabled`,
`email_changed`, `email_change_cancelled`, `admin_account_recovery`.

## 6. Telegram-first notifications (owner policy)

- Telegram-linked users get ALL account notifications via the bot:
  welcome, password-setup prompt, password reset (button link),
  password change, new-device login, MFA enable/disable, email change,
  recovery notices. Routing: `lib/notification-router.ts`.
- Primary identity is the NUMERIC Telegram ID (`OAuthAccount`
  `provider=telegram`, `providerAccountId=<numeric id>`); the synthetic
  email is `telegram_<id>@telegram.local` (underscore form — canonical).
  Usernames are display-only: a handle change updates `providerUsername` +
  `displayName` on next login and never breaks linking.
- Email is SECONDARY: only critical events (password reset link, password
  change) also mail a VERIFIED inbox; change notifications (no secret) mail
  any real address. Email-only users keep the existing Brevo flow.
- Password reset for Telegram users: `POST /api/auth/recover` mints the
  standard single-use token and delivers it through the bot (generic
  response preserved — no oracle). First login without a password triggers
  an in-bot setup prompt (optional, settings card remains).
- Without bot config (`TELEGRAM_BOT_TOKEN`) every Telegram send resolves
  fail-open — auth flows continue on email/ledger alone.
- Lost Telegram + no verified email → admin-assisted recovery (§3) is the
  only path; documented in Settings and on the recover page.
