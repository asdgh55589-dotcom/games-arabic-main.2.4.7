# Cookie Consent Banner — Design

**Date:** 2026-08-30
**Status:** Approved (visual mockup confirmed in preview)

## Purpose

Show a one-time cookie consent notice to first-time visitors. This is a compliance + transparency notice (ePrivacy/GDPR-style); the site only sets essential HttpOnly session cookies today, so the copy states consent is for essential site cookies only.

## Design (approved variant)

**A — Floating bottom bar** (not full-width):

- Centered, constrained width: `min(860px, calc(100% - 24px))`
- Floating above the page: `position: fixed`, `bottom: 16px`, `z-index` above content
- Rounded corners (`rounded-2xl`), border, shadow, `backdrop-blur`, background `bg-background/95`
- Content: title + one-line description + privacy-policy link + primary **«موافق»** button + small dismiss ✕

Copy:

> **نستخدم ملفات تعريف الارتباط 🍪**
> نستخدم ملفات تعريف الارتباط (Cookies) لضمان عمل الموقع وتحسين تجربتك. باستخدامك للموقع أو بالضغط على «موافق»، فأنت توافق على استخدامها.
> [سياسة الخصوصية] [موافق] [✕]

## Behavior

- Rendered only client-side (`'use client`), inside `AppShell`
- On mount, read cookie `cookie_consent`; if present → do not render
- Clicking **موافق** or **✕** sets `cookie_consent=accepted; max-age=31536000; path=/; SameSite=Lax` (a preference cookie, not sensitive) and hides the bar
- Bar disappears on action; not shown again for 1 year

## Files

- New: `src/components/cookie-consent.tsx`
- Edit: `src/components/layout/app-shell.tsx` (mount the component)

## Accessibility

- Announce as `role="dialog"` / `aria-label`, dismissible via mouse and keyboard
- Link to `/privacy` (existing route)