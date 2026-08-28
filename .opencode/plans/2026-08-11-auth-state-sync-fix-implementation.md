# Auth State Synchronization Fix - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix session synchronization issue where users appear logged in on homepage but prompted to log in on profile sub-pages by implementing centralized auth state management.

**Architecture:** Create `AuthProvider` context that fetches auth state once via `/api/auth/me` and provides it to all components. Replace independent auth fetches with `useAuth()` hook. Remove redundant client-side Supabase calls.

**Tech Stack:** React Context, Next.js App Router, Supabase Auth, `@supabase/ssr`

## Global Constraints

- Next.js 16 (App Router, standalone output)
- React 19, TypeScript 5
- Supabase Auth for OAuth (Google, Discord, Telegram)
- Neon DB (Prisma 6) for user data
- Role cookie `ga_admin_role` for admin routes (Edge-compatible)
- `src/app/admin/layout.tsx` — NO CHANGES (separate auth flow)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/contexts/auth-context.tsx` | CREATE | AuthProvider + useAuth hook |
| `src/app/layout.tsx` | MODIFY | Wrap with AuthProvider |
| `src/components/navbar.tsx` | MODIFY | Use useAuth() hook |
| `src/views/profile.tsx` | MODIFY | Remove redundant auth calls |
| `src/views/team-detail.tsx` | MODIFY | Remove redundant auth calls |
| `src/views/login.tsx` | MODIFY | Use useAuth() hook |
| `src/components/mod-comments.tsx` | MODIFY | Use useAuth() hook |
| `src/views/settings.tsx` | MODIFY | Use useAuth() for auth check |

---

## Task 1: Create AuthProvider Context

**Files:**
- Create: `src/contexts/auth-context.tsx`
- Reference: `src/contexts/bookmarks-context.tsx` (existing pattern)

**Interfaces:**
- Produces: `AuthProvider` component, `useAuth()` hook

- [ ] **Step 1: Create auth-context.tsx with AuthProvider**

```typescript
'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { SessionUser } from '@/lib/auth'

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      })
      const data = await res.json()
      setUser(data?.user || null)
    } catch (err) {
      console.error('[auth] failed to fetch user:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) {
        throw new Error('Logout failed')
      }
      setUser(null)
    } catch (err) {
      console.error('[auth] logout failed:', err)
      toast({
        title: 'خطأ',
        description: 'فشل تسجيل الخروج',
        variant: 'destructive',
      })
    }
  }, [toast])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const value = useMemo(() => ({
    user,
    loading,
    error,
    refresh,
    logout,
  }), [user, loading, error, refresh, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/contexts/auth-context.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/contexts/auth-context.tsx
git commit -m "feat: add AuthProvider context for centralized auth state"
```

---

## Task 2: Integrate AuthProvider in Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `AuthProvider` from Task 1

- [ ] **Step 1: Add AuthProvider to layout.tsx**

Read `src/app/layout.tsx` and add import + wrapper:

```typescript
// Add import at top
import { AuthProvider } from '@/contexts/auth-context'

// Wrap children in RootLayout function
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <SeoUpdater />
            <SmoothScrollProvider>
              {children}
            </SmoothScrollProvider>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wrap root layout with AuthProvider"
```

---

## Task 3: Update Navbar to Use useAuth

**Files:**
- Modify: `src/components/navbar.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 1

- [ ] **Step 1: Replace independent auth fetch with useAuth()**

In `src/components/navbar.tsx`:

1. Add import: `import { useAuth } from '@/contexts/auth-context'`
2. Remove the `currentUser` state declaration
3. Remove the `useEffect` that fetches `/api/auth/me`
4. Add inside component: `const { user: currentUser, logout } = useAuth()`
5. Update logout handler to use `logout()` from context

Find and replace the logout handler:

```typescript
// Before
onClick={async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  setCurrentUser(null)
  setMobileOpen(false)
  window.location.href = '/'
}}

// After
onClick={async () => {
  await logout()
  setMobileOpen(false)
  window.location.href = '/'
}}
```

Do the same for the desktop logout handler:

```typescript
// Before
onClick={async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  setCurrentUser(null)
  window.location.href = '/'
}}

// After
onClick={async () => {
  await logout()
  window.location.href = '/'
}}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/navbar.tsx
git commit -m "refactor: navbar uses centralized auth context"
```

---

## Task 4: Update ProfilePage to Use useAuth

**Files:**
- Modify: `src/views/profile.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 1

- [ ] **Step 1: Replace redundant auth calls with useAuth()**

In `src/views/profile.tsx`:

1. Add import: `import { useAuth } from '@/contexts/auth-context'`
2. Remove the `currentUser` state declaration
3. Remove the `useEffect` that calls `createClient().auth.getUser()` and `/api/auth/me`
4. Add inside component: `const { user: currentUser } = useAuth()`
5. Remove `import { createClient } from '@/lib/supabase/client'` if no longer used

The `isOwner` check should now use the context user:

```typescript
// Before
const isOwner = currentUser?.username === profile?.username

// After - same, but currentUser comes from useAuth()
const isOwner = currentUser?.username === profile?.username
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/views/profile.tsx
git commit -m "refactor: profile page uses centralized auth context"
```

---

## Task 5: Update TeamDetailPage to Use useAuth

**Files:**
- Modify: `src/views/team-detail.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 1

- [ ] **Step 1: Replace redundant auth calls with useAuth()**

In `src/views/team-detail.tsx`:

1. Add import: `import { useAuth } from '@/contexts/auth-context'`
2. Remove the `currentUser` state declaration
3. Remove the `useEffect` that calls `createClient().auth.getUser()` and `/api/auth/me`
4. Add inside component: `const { user: currentUser } = useAuth()`
5. Remove `import { createClient } from '@/lib/supabase/client'` if no longer used

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/views/team-detail.tsx
git commit -m "refactor: team detail page uses centralized auth context"
```

---

## Task 6: Update LoginPage to Use useAuth

**Files:**
- Modify: `src/views/login.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 1

- [ ] **Step 1: Replace session check with useAuth()**

In `src/views/login.tsx`:

1. Add import: `import { useAuth } from '@/contexts/auth-context'`
2. Remove the `checkingSession` state
3. Remove the `useEffect` that fetches `/api/auth/me` for redirect check
4. Add inside component: `const { user, loading: authLoading } = useAuth()`
5. Update the loading check:

```typescript
// Before
if (checkingSession) {
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// After
if (authLoading) {
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// Add redirect check after authLoading
if (user) {
  window.location.href = '/'
  return null
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/views/login.tsx
git commit -m "refactor: login page uses centralized auth context"
```

---

## Task 7: Update ModComments to Use useAuth

**Files:**
- Modify: `src/components/mod-comments.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 1

- [ ] **Step 1: Replace auth fetch with useAuth()**

In `src/components/mod-comments.tsx`:

1. Add import: `import { useAuth } from '@/contexts/auth-context'`
2. Find and remove the state variable that stores current user (likely `currentUser` or similar)
3. Remove the `useEffect` that fetches `/api/auth/me`
4. Add inside component: `const { user: currentUser } = useAuth()`

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/mod-comments.tsx
git commit -m "refactor: mod comments uses centralized auth context"
```

---

## Task 8: Update SettingsPage to Use useAuth

**Files:**
- Modify: `src/views/settings.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 1

- [ ] **Step 1: Add useAuth for auth check**

In `src/views/settings.tsx`:

1. Add import: `import { useAuth } from '@/contexts/auth-context'`
2. Add inside component: `const { user, loading: authLoading } = useAuth()`
3. Update the loading state to include auth loading:

```typescript
// Before
if (loading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// After
if (loading || authLoading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
```

4. Update the not-logged-in check:

```typescript
// Before
if (!profile) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">يجب تسجيل الدخول أولاً</p>
        <Link href="/?view=login" className="mt-4 inline-block text-sm text-primary hover:underline">تسجيل الدخول</Link>
      </div>
    </div>
  )
}

// After - use auth context user for initial check
if (!authLoading && !user) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">يجب تسجيل الدخول أولاً</p>
        <Link href="/?view=login" className="mt-4 inline-block text-sm text-primary hover:underline">تسجيل الدخول</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/views/settings.tsx
git commit -m "refactor: settings page uses centralized auth context"
```

---

## Task 9: Fix Auth-Related Silent Failures

**Files:**
- Modify: `src/views/profile.tsx`
- Modify: `src/views/team-detail.tsx`
- Modify: `src/components/navbar.tsx`

**Interfaces:**
- Consumes: None (error handling improvement)

- [ ] **Step 1: Add console.error to auth-related catch blocks**

In `src/views/profile.tsx` (if any auth-related `.catch(() => {})` remains):
```typescript
// Replace
.catch(() => {})

// With
.catch((error) => {
  console.error('[profile] auth check failed:', error)
})
```

In `src/views/team-detail.tsx` (if any auth-related `.catch(() => {})` remains):
```typescript
// Replace
.catch(() => {})

// With
.catch((error) => {
  console.error('[team-detail] auth check failed:', error)
})
```

In `src/components/navbar.tsx` (if any auth-related `.catch(() => {})` remains):
```typescript
// Replace
.catch(() => {})

// With
.catch((error) => {
  console.error('[navbar] auth check failed:', error)
})
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/views/profile.tsx src/views/team-detail.tsx src/components/navbar.tsx
git commit -m "fix: add error logging to auth-related catch blocks"
```

---

## Task 10: Integration Testing

**Files:**
- None (manual testing)

**Interfaces:**
- None

- [ ] **Step 1: Run dev server**

```bash
bun run dev
```

- [ ] **Step 2: Test view switching**

1. Navigate to `http://localhost:3000/?view=home`
2. Login via OAuth (Google/Discord)
3. Verify logged in state in Navbar
4. Navigate to `http://localhost:3000/?view=profile&user=<your-username>`
5. Verify still logged in (no login prompt)
6. Navigate back to `http://localhost:3000/?view=home`
7. Verify still logged in

- [ ] **Step 3: Test logout**

1. Click logout in Navbar
2. Verify all components update to logged-out state
3. Verify no console errors

- [ ] **Step 4: Test hard refresh**

1. Navigate to `http://localhost:3000/?view=profile&user=<your-username>`
2. Hard refresh (Ctrl+Shift+R)
3. Verify session persists (no login prompt)

- [ ] **Step 5: Test Network tab**

1. Open DevTools Network tab
2. Navigate between views
3. Verify only ONE `/api/auth/me` call on initial load
4. Verify NO redundant auth calls on view switches

- [ ] **Step 6: Test admin layout (unchanged)**

1. Navigate to `http://localhost:3000/admin`
2. Verify admin auth flow still works independently
3. Login as admin/moderator
4. Verify admin routes accessible

- [ ] **Step 7: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: auth state sync issues after integration testing"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] User stays logged in when switching between views
- [ ] No redundant `/api/auth/me` calls (check Network tab)
- [ ] Auth errors visible in console (no silent failures)
- [ ] Logout updates all components instantly
- [ ] Admin layout unchanged
- [ ] No TypeScript errors
- [ ] `bun run build` succeeds
- [ ] `bun run lint` passes (if configured)

---

## Rollback Plan

If issues arise:

1. Revert `src/app/layout.tsx` to remove AuthProvider wrapper
2. Revert each component to use independent auth fetches
3. Delete `src/contexts/auth-context.tsx`

Or use git to revert all commits in this feature.
