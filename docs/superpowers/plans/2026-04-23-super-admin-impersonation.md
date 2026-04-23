# Super Admin User Impersonation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the hardcoded super admin (`sushant.gawali@gmail.com`) to impersonate any other user via a Settings dropdown, showing their data across all screens with a visible amber banner.

**Architecture:** An HTTP-only cookie `x-impersonate-user` is set via an admin API route. `getSessionUserId()` in `src/lib/session.ts` — the single identity chokepoint for all 20+ API routes and server pages — checks for this cookie when the real session email matches `SUPER_ADMIN_EMAIL`, and returns the cookie value instead. No other data-fetching code needs changes.

**Tech Stack:** Next.js 16 (App Router), NextAuth v4 (JWT), Prisma/LibSQL, Base UI Select, Tailwind CSS, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/session.ts` | Modify | Add `SUPER_ADMIN_EMAIL`, `isSupAdmin()`, update `getSessionUserId()` |
| `src/lib/session.test.ts` | Create | Unit test for `isSupAdmin()` |
| `src/app/api/admin/users/route.ts` | Create | GET — return distinct userIds from all tables |
| `src/app/api/admin/impersonate/route.ts` | Create | POST/DELETE — set/clear impersonation cookie |
| `src/app/dashboard/settings/impersonation-selector.tsx` | Create | Client dropdown + stop button |
| `src/app/dashboard/settings/page.tsx` | Modify | Render `ImpersonationSelector` for super admin |
| `src/components/top-nav.tsx` | Modify | Accept + render amber impersonation banner |
| `src/app/dashboard/layout.tsx` | Modify | Read cookie + session, pass `impersonatedUser` to TopNav |

---

## Task 1: Extend `src/lib/session.ts`

**Files:**
- Modify: `src/lib/session.ts`
- Create: `src/lib/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/session.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isSupAdmin, SUPER_ADMIN_EMAIL } from "./session";

describe("isSupAdmin", () => {
  it("returns true for the super admin email", () => {
    expect(isSupAdmin(SUPER_ADMIN_EMAIL)).toBe(true);
  });
  it("returns false for any other email", () => {
    expect(isSupAdmin("other@example.com")).toBe(false);
  });
  it("returns false for null", () => {
    expect(isSupAdmin(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /path/to/project && npx vitest run src/lib/session.test.ts
```

Expected: FAIL — `isSupAdmin` not exported from `./session`

- [ ] **Step 3: Update `src/lib/session.ts`**

Replace the entire file with:

```typescript
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export const SUPER_ADMIN_EMAIL = "sushant.gawali@gmail.com";

export function isSupAdmin(email: string | null): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;
  if (isSupAdmin(realEmail)) {
    const cookieStore = await cookies();
    const impersonated = cookieStore.get("x-impersonate-user")?.value;
    if (impersonated) return impersonated;
  }
  return realEmail;
}

export async function requireUserId(): Promise<string | NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return userId;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/lib/session.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts
git commit -m "feat(admin): add SUPER_ADMIN_EMAIL, isSupAdmin, cookie-based impersonation in getSessionUserId"
```

---

## Task 2: Admin users endpoint

**Files:**
- Create: `src/app/api/admin/users/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;
  if (!isSupAdmin(realEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [fds, gold, banks, kite] = await Promise.all([
    prisma.fixedDeposit.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.goldItem.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.bankAccount.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.kiteConfig.findMany({ select: { userId: true } }),
  ]);

  const users = [
    ...new Set([...fds, ...gold, ...banks, ...kite].map((r) => r.userId)),
  ].sort();

  return NextResponse.json({ users });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/route.ts
git commit -m "feat(admin): add GET /api/admin/users endpoint"
```

---

## Task 3: Impersonation cookie API

**Files:**
- Create: `src/app/api/admin/impersonate/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin } from "@/lib/session";
import { cookies } from "next/headers";

const COOKIE = "x-impersonate-user";
const EIGHT_HOURS = 60 * 60 * 8;

async function assertSuperAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!isSupAdmin(session?.user?.email ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const guard = await assertSuperAdmin();
  if (guard) return guard;

  const { userId } = await req.json() as { userId: string };
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, userId, {
    httpOnly: true,
    path: "/",
    maxAge: EIGHT_HOURS,
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const guard = await assertSuperAdmin();
  if (guard) return guard;

  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/impersonate/route.ts
git commit -m "feat(admin): add POST/DELETE /api/admin/impersonate cookie endpoints"
```

---

## Task 4: `ImpersonationSelector` client component

**Files:**
- Create: `src/app/dashboard/settings/impersonation-selector.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  isSuperAdmin: boolean;
  activeUserId: string | null;
}

export function ImpersonationSelector({ isSuperAdmin, activeUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(({ users }) => setUsers(users))
      .finally(() => setLoading(false));
  }, []);

  if (!isSuperAdmin) return null;

  async function handleSelect(userId: string) {
    if (userId === "__self__") return handleStop();
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.refresh();
  }

  async function handleStop() {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.refresh();
  }

  const selectValue = activeUserId ?? "__self__";

  return (
    <section className="ab-card p-6 space-y-4">
      <div>
        <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Super Admin</p>
        <p className="text-[13px] text-[#a0a0a5] mt-1">
          View the app as another user. All data shown will be theirs.
        </p>
      </div>

      <div className="space-y-2">
        <label className="ab-label">View as user</label>
        {loading ? (
          <div className="h-8 w-64 rounded-lg bg-[#1c1c20] animate-pulse" />
        ) : (
          <Select value={selectValue} onValueChange={handleSelect}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a user…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__self__">— My own account —</SelectItem>
              {users.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {activeUserId && (
        <p className="text-[13px] text-amber-400">
          Currently viewing as <span className="font-semibold">{activeUserId}</span>
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/impersonation-selector.tsx
git commit -m "feat(admin): add ImpersonationSelector settings component"
```

---

## Task 5: Wire `ImpersonationSelector` into the settings page

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Update `src/app/dashboard/settings/page.tsx`**

Replace the entire file with:

```typescript
import { headers, cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { KiteSettingsForm } from "./kite-settings-form";
import { CopyableUrl } from "./copyable-url";
import { ImpersonationSelector } from "./impersonation-selector";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, isSupAdmin } from "@/lib/session";

export default async function SettingsPage() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;

  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;
  const isSA = isSupAdmin(realEmail);

  const cookieStore = await cookies();
  const activeUserId = isSA
    ? (cookieStore.get("x-impersonate-user")?.value ?? null)
    : null;

  const userId = await getSessionUserId();
  const config = userId ? await prisma.kiteConfig.findUnique({ where: { userId } }) : null;
  const isConnected =
    !!config?.accessToken &&
    !!config?.tokenExpiry &&
    new Date(config.tokenExpiry) > new Date();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Settings</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Manage your API credentials and app configuration.</p>
      </div>

      <ImpersonationSelector isSuperAdmin={isSA} activeUserId={activeUserId} />

      <section className="ab-card p-6 space-y-5">
        <div>
          <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Zerodha / Kite Connect</p>
          <p className="text-[13px] text-[#a0a0a5] mt-2 leading-relaxed">
            Enter your Kite Connect API credentials from{" "}
            <a
              href="https://developers.kite.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ededed] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
            >
              developers.kite.trade
            </a>
            . Set the redirect URL to{" "}
            <CopyableUrl url={`${baseUrl}/api/kite/callback`} />
          </p>
        </div>
        <KiteSettingsForm
          savedApiKey={config?.apiKey ?? ""}
          isConnected={isConnected}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat(admin): add ImpersonationSelector to settings page"
```

---

## Task 6: Amber impersonation banner in TopNav

**Files:**
- Modify: `src/components/top-nav.tsx`

- [ ] **Step 1: Update `src/components/top-nav.tsx`**

Replace the entire file with:

```typescript
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { signOut } from "next-auth/react";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/zerodha", label: "Zerodha" },
  { href: "/dashboard/fd", label: "Fixed Deposits" },
  { href: "/dashboard/bank-accounts", label: "Bank Accounts" },
  { href: "/dashboard/gold", label: "Gold" },
  { href: "/dashboard/settings", label: "Settings" },
];

interface Props {
  impersonatedUser?: string;
}

export function TopNav({ impersonatedUser }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function stopImpersonating() {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-[#17171a] border-b border-[#2a2a2e]">
      {impersonatedUser && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-400 text-[13px] font-medium">
            <Eye size={14} />
            <span>Viewing as <span className="font-semibold">{impersonatedUser}</span></span>
          </div>
          <button
            onClick={stopImpersonating}
            className="text-amber-400 hover:text-amber-300 text-[12px] font-medium transition-colors flex items-center gap-1"
          >
            <X size={12} />
            Stop
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[13px] font-bold"
              style={{ background: "linear-gradient(135deg, #ff385c 0%, #e00b41 100%)" }}
            >
              M
            </span>
            <span className="text-[18px] font-semibold tracking-tight text-[#ededed]">MyFolio</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {TABS.map(({ href, label }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "px-3 py-2 rounded-full text-sm font-medium transition-colors",
                    active
                      ? "bg-[#ff385c]/10 text-white ring-1 ring-inset ring-[#ff385c]/25"
                      : "text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20]"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20] transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>

          <button
            className="sm:hidden p-2 rounded-full text-[#ededed] hover:bg-[#1c1c20] transition-colors"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="sm:hidden border-t border-[#2a2a2e] bg-[#17171a] px-4 py-3 space-y-1">
          {TABS.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                  active ? "bg-[#ff385c]/10 text-white ring-1 ring-inset ring-[#ff385c]/25" : "text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20]"
                )}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20] w-full transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/top-nav.tsx
git commit -m "feat(admin): add amber impersonation banner to TopNav"
```

---

## Task 7: Pass `impersonatedUser` from layout to TopNav

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Update `src/app/dashboard/layout.tsx`**

Replace the entire file with:

```typescript
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin } from "@/lib/session";
import { TopNav } from "@/components/top-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;

  let impersonatedUser: string | undefined;
  if (isSupAdmin(realEmail)) {
    const cookieStore = await cookies();
    impersonatedUser = cookieStore.get("x-impersonate-user")?.value;
  }

  return (
    <div className="min-h-screen bg-[#17171a]">
      <TopNav impersonatedUser={impersonatedUser} />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (including the new session.test.ts)

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat(admin): pass impersonatedUser from layout to TopNav"
```

---

## Manual Verification Checklist

After all tasks are complete, verify in the browser while logged in as `sushant.gawali@gmail.com`:

1. **Settings page** shows a "Super Admin" card with a user dropdown
2. **Dropdown** lists all distinct userIds from the database
3. **Selecting a user** refreshes the page; all dashboard screens now show that user's data
4. **Amber banner** appears at the top of every page: "Viewing as: user@example.com" with a "Stop" button
5. **Stop button** in the banner clears impersonation and shows your own data again
6. **"— My own account —"** option in the dropdown also clears impersonation
7. **Logged in as any other user** — settings page shows no "Super Admin" card
8. **Direct request to** `GET /api/admin/users` from a non-super-admin session returns 403
