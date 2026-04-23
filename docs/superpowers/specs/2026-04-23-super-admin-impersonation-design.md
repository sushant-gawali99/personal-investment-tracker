# Super Admin User Impersonation — Design Spec

**Date:** 2026-04-23
**Status:** Approved

---

## Overview

A single hardcoded super admin (`sushant.gawali@gmail.com`) can select any other user from a dropdown in the Settings screen. While impersonating, all screens display that user's data as if logged in as them. A visible amber banner in the top nav shows who is being impersonated and allows cancellation.

---

## Architecture

### How impersonation propagates

`getSessionUserId()` in `src/lib/session.ts` is the single identity chokepoint used by every API route and server page. Modifying it to return the impersonated userId when a super admin cookie is present propagates the impersonation to all 20+ endpoints with no other changes.

```
Real session (JWT) → getSessionUserId()
                          ↓
          Is real user == SUPER_ADMIN_EMAIL?
                    ↙         ↘
               yes              no
                ↓
  Read cookie `x-impersonate-user`
         set?  ↙     ↘  not set
              ↓         ↓
     return cookie    return real email
       value
```

### Super admin constant

Hardcoded in `src/lib/session.ts`:

```typescript
export const SUPER_ADMIN_EMAIL = "sushant.gawali@gmail.com";
```

---

## Components

### 1. `src/lib/session.ts` — modified

- Export `SUPER_ADMIN_EMAIL = "sushant.gawali@gmail.com"`
- Export `isSupAdmin(email: string | null): boolean` — returns `email === SUPER_ADMIN_EMAIL`
- Modify `getSessionUserId()`: after getting the real email, if `isSupAdmin(realEmail)`, read the `x-impersonate-user` cookie via `next/headers`. If present, return that value. Otherwise return `realEmail`.

### 2. `src/app/api/admin/users/route.ts` — new

- `GET` only, super admin check via real session (not impersonated userId — must read raw session).
- Query distinct `userId` values from `FixedDeposit`, `GoldItem`, `BankAccount`, and `KiteConfig` tables using individual Prisma queries, merge into a deduplicated sorted array.
- Returns `{ users: string[] }`.

### 3. `src/app/api/admin/impersonate/route.ts` — new

- `POST { userId: string }`: validates super admin, sets HTTP-only cookie `x-impersonate-user` with `path=/`, 8-hour `maxAge`. Returns `{ ok: true }`.
- `DELETE`: validates super admin, clears the cookie. Returns `{ ok: true }`.
- Both methods check the raw session (not the impersonated one) to enforce super admin access.

### 4. `src/app/dashboard/settings/impersonation-selector.tsx` — new client component

- Shown only when `isSuperAdmin` prop is true.
- On mount, fetches `GET /api/admin/users` to populate a `<Select>` dropdown.
- Current impersonated user (passed as prop `activeUserId`) is pre-selected.
- On change: calls `POST /api/admin/impersonate` then `router.refresh()`.
- "Stop impersonating" button (shown when `activeUserId` is set): calls `DELETE /api/admin/impersonate` then `router.refresh()`.

### 5. `src/app/dashboard/settings/page.tsx` — modified

- After fetching `userId` and `config`, also read the `x-impersonate-user` cookie and the raw session email.
- Pass `isSuperAdmin`, `activeImpersonatedUser` props to `ImpersonationSelector`.
- Render `<ImpersonationSelector>` above the existing Kite settings section.

### 6. `src/components/top-nav.tsx` — modified

- Accept optional `impersonatedUser?: string` prop from the layout or read from a server-side cookie.
- When `impersonatedUser` is set, render an amber pill:
  ```
  👁 Viewing as: user@example.com  [✕]
  ```
- The ✕ button calls `DELETE /api/admin/impersonate` and does `router.refresh()`.

### 7. `src/app/dashboard/layout.tsx` — modified

- Read the `x-impersonate-user` cookie and the real session email server-side.
- Pass `impersonatedUser` to `<TopNav>` only when the real user is super admin.

---

## Security

- The `x-impersonate-user` cookie is HTTP-only (not readable by JS).
- All admin endpoints re-verify the raw NextAuth session directly (not via `getSessionUserId()`) to prevent an impersonated user from accessing admin routes.
- No user can set the cookie except through the admin API, which requires the real session to be super admin.
- Impersonation is cleared on cookie expiry (8 hours) or explicit stop.
- The existing `signOut()` call clears all cookies via NextAuth, which removes the impersonation cookie too.

---

## Data Flow

```
Settings page
  → User selects "user@example.com" from dropdown
  → POST /api/admin/impersonate { userId: "user@example.com" }
  → Server sets HTTP-only cookie x-impersonate-user=user@example.com
  → router.refresh() triggers full page reload

Every subsequent request (page load or API call):
  → getSessionUserId() reads cookie → returns "user@example.com"
  → All Prisma queries use where: { userId: "user@example.com" }
  → TopNav shows amber banner "Viewing as: user@example.com"
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/session.ts` | Add `SUPER_ADMIN_EMAIL`, `isSupAdmin()`, modify `getSessionUserId()` |
| `src/app/api/admin/users/route.ts` | New — list distinct userIds |
| `src/app/api/admin/impersonate/route.ts` | New — set/clear impersonation cookie |
| `src/app/dashboard/settings/impersonation-selector.tsx` | New — dropdown UI |
| `src/app/dashboard/settings/page.tsx` | Add ImpersonationSelector |
| `src/app/dashboard/layout.tsx` | Pass impersonatedUser to TopNav |
| `src/components/top-nav.tsx` | Add amber impersonation banner |

---

## Out of Scope

- Audit logging of impersonation events
- Time-limited impersonation tokens
- Multiple super admins
- Impersonation from screens other than Settings
