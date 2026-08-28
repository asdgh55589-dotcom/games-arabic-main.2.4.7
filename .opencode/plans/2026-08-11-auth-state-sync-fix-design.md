# Auth State Synchronization Fix

## Problem Statement

Users appear logged in on the homepage but are prompted to log in again when navigating to profile sub-pages (`?view=profile`, `?view=team-detail`). The root cause is **independent auth state fetching** across components without centralized state management.

### Current Issues

1. **Redundant client-side Supabase calls**: `profile.tsx` and `team-detail.tsx` call `createClient().auth.getUser()` before fetching `/api/auth/me`, which is unnecessary since `/api/auth/me` already handles Supabase verification server-side.

2. **Race conditions**: Each component fetches `/api/auth/me` independently on mount, causing inconsistent auth state across views.

3. **Silent failures**: 33 instances of `.catch(() => {})` hide auth errors, making debugging impossible.

4. **No global auth state**: Components like `Navbar`, `ProfilePage`, and `SettingsPage` maintain separate auth states that can diverge.

## Solution

Create a centralized `AuthProvider` context that fetches auth state once and provides it to all components, eliminating race conditions and redundant network requests.

### Design Decisions (User-Confirmed)

1. **Logout handling**: Include in `AuthProvider` — handles API call, clears state, updates context to `null` instantly.

2. **Error toasts**: 
   - Background `/api/auth/me` fetch on mount → `console.error` only
   - Explicit user actions (logout, save settings) → user-facing toast on auth failure

3. **Admin layout**: Keep separate — admin requires strict role-based verification, different from standard user session.

---

## Architecture

### New Component: AuthProvider

**File**: `src/contexts/auth-context.tsx`

**Interface**:
```typescript
interface AuthContextValue {
  user: SessionUser | null        // Current user or null
  loading: boolean                // True while fetching auth state
  error: string | null            // Error message if fetch failed
  refresh: () => Promise<void>    // Manual re-fetch
  logout: () => Promise<void>     // Sign out + clear state
}
```

**Behavior**:
- Fetches `/api/auth/me` once on mount (with `cache: 'no-store'`)
- Sets `loading: false` after fetch completes
- Provides `user` object (or `null` if not authenticated)
- `refresh()` re-fetches `/api/auth/me` and updates state
- `logout()` calls `/api/auth/logout`, clears user state to `null`

**Error handling**:
- Initial fetch: `console.error` only, no toast
- `logout()`: Toast on failure (user-initiated action)

### Integration Points

**Root layout** (`src/app/layout.tsx`):
```typescript
// Wrap children with AuthProvider
<AuthProvider>
  {children}
</AuthProvider>
```

### Component Changes

| Component | Current Behavior | New Behavior |
|-----------|-----------------|--------------|
| `src/components/navbar.tsx` | Fetches `/api/auth/me` independently | Use `useAuth()` hook |
| `src/views/profile.tsx` | `createClient().auth.getUser()` → `/api/auth/me` | Use `useAuth()` hook |
| `src/views/team-detail.tsx` | `createClient().auth.getUser()` → `/api/auth/me` | Use `useAuth()` hook |
| `src/views/login.tsx` | Fetches `/api/auth/me` for session check | Use `useAuth()` hook |
| `src/components/mod-comments.tsx` | Fetches `/api/auth/me` | Use `useAuth()` hook |
| `src/views/settings.tsx` | Fetches `/api/settings/bootstrap` (auth check) | Use `useAuth()` hook |
| `src/app/admin/layout.tsx` | **NO CHANGE** — keep separate auth flow |

### Hook: useAuth

```typescript
function useAuth(): AuthContextValue
```

Returns the current auth context value. Must be used within `AuthProvider`.

---

## Implementation Details

### Step 1: Create AuthProvider

**File**: `src/contexts/auth-context.tsx`

- Define `AuthContext` with `createContext`
- Implement `AuthProvider` component with `useState` and `useEffect`
- Fetch `/api/auth/me` on mount
- Implement `refresh()` and `logout()` functions
- Export `useAuth` hook

### Step 2: Integrate AuthProvider in Root Layout

**File**: `src/app/layout.tsx`

- Import `AuthProvider`
- Wrap `{children}` with `<AuthProvider>`

### Step 3: Update Navbar

**File**: `src/components/navbar.tsx`

- Remove `useEffect` that fetches `/api/auth/me`
- Replace `currentUser` state with `useAuth()` hook
- Update logout button to use `logout()` from context

### Step 4: Update ProfilePage

**File**: `src/views/profile.tsx`

- Remove `createClient().auth.getUser()` call
- Remove `/api/auth/me` fetch
- Replace with `useAuth()` hook
- Update logout logic if present

### Step 5: Update TeamDetailPage

**File**: `src/views/team-detail.tsx`

- Remove `createClient().auth.getUser()` call
- Remove `/api/auth/me` fetch
- Replace with `useAuth()` hook

### Step 6: Update LoginPage

**File**: `src/views/login.tsx`

- Replace `/api/auth/me` fetch with `useAuth()` hook
- Use `loading` state from context for initial check

### Step 7: Update ModComments

**File**: `src/components/mod-comments.tsx`

- Replace `/api/auth/me` fetch with `useAuth()` hook

### Step 8: Update SettingsPage

**File**: `src/views/settings.tsx`

- Use `useAuth()` hook for auth check
- Keep `/api/settings/bootstrap` for profile data fetch
- Add toast on auth failure for save actions

### Step 9: Fix Silent Failures

**Files affected**: 12 auth-related `.catch(() => {})` blocks

Replace with:
```typescript
.catch((error) => {
  console.error('[auth] operation failed:', error)
})
```

For user-initiated actions (logout, save settings):
```typescript
.catch((error) => {
  console.error('[auth] operation failed:', error)
  toast({ title: 'خطأ', description: 'حدث خطأ أثناء العملية', variant: 'destructive' })
})
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        AuthProvider                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ State: user, loading, error                         │   │
│  │ Actions: refresh(), logout()                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                    useAuth() hook                           │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
     ┌─────────┐    ┌───────────┐    ┌───────────┐
     │ Navbar  │    │ Profile   │    │  Team     │
     │         │    │ Page      │    │  Detail   │
     └─────────┘    └───────────┘    └───────────┘
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/contexts/auth-context.tsx` | **CREATE** — AuthProvider + useAuth hook |
| `src/app/layout.tsx` | **MODIFY** — Wrap with AuthProvider |
| `src/components/navbar.tsx` | **MODIFY** — Use useAuth() |
| `src/views/profile.tsx` | **MODIFY** — Remove redundant auth calls |
| `src/views/team-detail.tsx` | **MODIFY** — Remove redundant auth calls |
| `src/views/login.tsx` | **MODIFY** — Use useAuth() |
| `src/components/mod-comments.tsx` | **MODIFY** — Use useAuth() |
| `src/views/settings.tsx` | **MODIFY** — Use useAuth() for auth check |
| `src/app/admin/layout.tsx` | **NO CHANGE** |

---

## Testing Strategy

1. **View switching**: Navigate between `?view=home` and `?view=profile` — session should persist
2. **Initial load**: Hard refresh on `?view=profile` — should show login state correctly
3. **Logout**: Click logout — all components should update to logged-out state
4. **Error handling**: Check console for error logs on auth failures
5. **Admin routes**: Verify admin layout still works independently

---

## Success Criteria

- [ ] User stays logged in when switching between views
- [ ] No redundant `/api/auth/me` calls (check Network tab)
- [ ] Auth errors visible in console (no silent failures)
- [ ] Logout updates all components instantly
- [ ] Admin layout unchanged
- [ ] No TypeScript errors

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Context re-renders performance | Use `useMemo` for context value, `React.memo` for consumers |
| Stale auth state | `refresh()` function for manual re-fetch |
| Concurrent requests | Fetch once on mount, not on every view switch |

---

## Out of Scope

- Admin layout migration (separate auth flow)
- Supabase real-time subscriptions
- Session token refresh logic (handled by Supabase SDK)
- Non-auth silent failures (admin stats, etc.)
