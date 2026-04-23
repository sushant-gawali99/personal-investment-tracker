# FD Maturity Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send automated daily email + WhatsApp reminders to each user whose Fixed Deposits mature in 10 or 5 days, using an in-process `node-cron` job started via `instrumentation.ts`.

**Architecture:** A `scheduler.ts` singleton registers a daily cron at 9 AM IST via `node-cron`, calling `fd-reminder-service.ts` which queries Prisma for FDs in the two maturity windows, groups them by user, then dispatches one email (Resend) and one WhatsApp message (Meta Cloud API, env-gated) per user. User phone numbers are stored in a new `UserProfile` model and editable from the settings page.

**Tech Stack:** `node-cron`, `resend`, Next.js App Router, Prisma + Turso (LibSQL/SQLite), Vitest

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `UserProfile` model with `phone` field |
| `src/lib/notifications/fd-reminder-service.ts` | Create | Date window logic + FD query + per-user dispatch |
| `src/lib/notifications/fd-reminder-service.test.ts` | Create | Unit tests for date windows and dispatch logic |
| `src/lib/notifications/email-service.ts` | Create | Resend wrapper — `sendFdReminderEmail(to, fds)` |
| `src/lib/notifications/email-service.test.ts` | Create | Unit tests for email-service |
| `src/lib/notifications/whatsapp-service.ts` | Create | Meta Cloud API wrapper, env-gated |
| `src/lib/notifications/whatsapp-service.test.ts` | Create | Unit tests for whatsapp-service |
| `src/lib/notifications/scheduler.ts` | Create | `node-cron` daily job, double-start guard |
| `src/instrumentation.ts` | Create | Register scheduler on server startup |
| `src/app/api/user/profile/route.ts` | Create | `PATCH` — update `phone` for current user |
| `src/app/api/user/profile/route.test.ts` | Create | Unit tests for PATCH route |
| `src/app/dashboard/settings/notification-settings-form.tsx` | Create | Client component: phone input + save |
| `src/app/dashboard/settings/page.tsx` | Modify | Add Notification Settings section |
| `.env.example` | Modify | Document new env vars |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install node-cron resend
npm install --save-dev @types/node-cron
```

- [ ] **Step 2: Verify install**

```bash
npm ls node-cron resend @types/node-cron
```

Expected: all three listed without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install node-cron and resend"
```

---

## Task 2: Prisma schema — add `UserProfile` model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `UserProfile` model to schema**

Open `prisma/schema.prisma` and append after the last model:

```prisma
model UserProfile {
  userId  String  @id
  phone   String?
}
```

> `userId` is the user's email address (this app uses email as the userId, following the same pattern as `KiteConfig`).

- [ ] **Step 2: Push schema to database**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add UserProfile model with phone field"
```

---

## Task 3: `PATCH /api/user/profile` route

**Files:**
- Create: `src/app/api/user/profile/route.ts`
- Create: `src/app/api/user/profile/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/user/profile/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({
  requireUserId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: {
      upsert: vi.fn(),
    },
  },
}));
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

import { PATCH } from "./route";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireUserId).mockResolvedValue(
      new Response(null, { status: 401 }) as never
    );
    const res = await PATCH(makeReq({ phone: "+91123" }));
    expect(res.status).toBe(401);
  });

  it("upserts phone and returns 200", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user@example.com");
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({
      userId: "user@example.com",
      phone: "+919876543210",
    });

    const res = await PATCH(makeReq({ phone: "+919876543210" }));
    expect(res.status).toBe(200);
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user@example.com" },
      create: { userId: "user@example.com", phone: "+919876543210" },
      update: { phone: "+919876543210" },
    });
  });

  it("allows clearing phone with null", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user@example.com");
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({
      userId: "user@example.com",
      phone: null,
    });

    const res = await PATCH(makeReq({ phone: null }));
    expect(res.status).toBe(200);
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user@example.com" },
      create: { userId: "user@example.com", phone: null },
      update: { phone: null },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/user/profile/route.test.ts
```

Expected: FAIL — `PATCH` not defined.

- [ ] **Step 3: Implement the route**

Create `src/app/api/user/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { phone } = await req.json();

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, phone: phone ?? null },
    update: { phone: phone ?? null },
  });

  return NextResponse.json({ profile });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/user/profile/route.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/user/profile/route.ts src/app/api/user/profile/route.test.ts
git commit -m "feat(api): add PATCH /api/user/profile for phone number"
```

---

## Task 4: Notification Settings UI

**Files:**
- Create: `src/app/dashboard/settings/notification-settings-form.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create the client form component**

Create `src/app/dashboard/settings/notification-settings-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  savedPhone: string | null;
}

export function NotificationSettingsForm({ savedPhone }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(savedPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label htmlFor="phone" className="ab-label">WhatsApp Phone Number</label>
        <input
          id="phone"
          className="ab-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919876543210"
        />
        <p className="text-[12px] text-[#a0a0a5] mt-1.5">
          International format. Leave blank to skip WhatsApp reminders.
        </p>
      </div>

      {error && (
        <p className="text-[13px] text-[#ff7a6e] bg-[#2a1613] rounded-lg px-3 py-2.5 font-medium">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-[13px] text-[#5ee0a4] bg-[#0f2a19] rounded-lg px-3 py-2.5 font-medium">
          Saved successfully.
        </p>
      )}

      <button type="submit" disabled={saving} className="ab-btn ab-btn-accent">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Fetch phone in the settings page and add the section**

Edit `src/app/dashboard/settings/page.tsx`. Add the profile query after the kite config query:

```typescript
// Add this import at the top:
import { NotificationSettingsForm } from "./notification-settings-form";

// Inside SettingsPage(), after the kiteConfig query:
const profile = userId
  ? await prisma.userProfile.findUnique({ where: { userId } })
  : null;
```

Then add this section inside the returned JSX, after the Zerodha section:

```tsx
<section className="ab-card p-6 space-y-5">
  <div>
    <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Notifications</p>
    <p className="text-[13px] text-[#a0a0a5] mt-2 leading-relaxed">
      FD maturity reminders are sent by email automatically. Add a phone number to also receive WhatsApp reminders.
    </p>
  </div>
  <NotificationSettingsForm savedPhone={profile?.phone ?? null} />
</section>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/notification-settings-form.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat(settings): add notification settings section with phone input"
```

---

## Task 5: `email-service.ts`

**Files:**
- Create: `src/lib/notifications/email-service.ts`
- Create: `src/lib/notifications/email-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/email-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "email-123" }, error: null }),
    },
  })),
}));

import { sendFdReminderEmail } from "./email-service";
import { Resend } from "resend";

const mockFds = [
  {
    bankName: "HDFC Bank",
    fdNumber: "FD001",
    maturityDate: new Date("2026-05-03"),
    principal: 100000,
    maturityAmount: 105000,
    daysRemaining: 10,
  },
];

describe("sendFdReminderEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Resend emails.send with correct to address", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "reminders@test.com";

    await sendFdReminderEmail("user@example.com", mockFds);

    const instance = vi.mocked(Resend).mock.results[0].value;
    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  it("throws if Resend returns an error", async () => {
    const instance = { emails: { send: vi.fn().mockResolvedValue({ data: null, error: { message: "bad" } }) } };
    vi.mocked(Resend).mockImplementation(() => instance as never);

    await expect(sendFdReminderEmail("user@example.com", mockFds)).rejects.toThrow("bad");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/notifications/email-service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `email-service.ts`**

Create `src/lib/notifications/email-service.ts`:

```typescript
import { Resend } from "resend";

export interface FdReminderItem {
  bankName: string;
  fdNumber: string | null;
  maturityDate: Date;
  principal: number;
  maturityAmount: number | null;
  daysRemaining: number;
}

export async function sendFdReminderEmail(to: string, fds: FdReminderItem[]): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const fdRows = fds
    .map((fd) => {
      const label = fd.fdNumber ? `${fd.bankName} — ${fd.fdNumber}` : fd.bankName;
      const maturity = fd.maturityDate.toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
      const principal = `₹${fd.principal.toLocaleString("en-IN")}`;
      const amount = fd.maturityAmount
        ? `₹${fd.maturityAmount.toLocaleString("en-IN")}`
        : "—";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${maturity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${principal}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${amount}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e;font-weight:600;color:${fd.daysRemaining <= 5 ? "#ff7a6e" : "#f5a623"}">${fd.daysRemaining} days</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#ededed;background:#16161a;padding:32px;border-radius:12px">
      <h2 style="margin-top:0">FD Maturity Reminder</h2>
      <p style="color:#a0a0a5">The following Fixed Deposits are maturing soon:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="color:#a0a0a5;font-size:12px;text-transform:uppercase">
            <th style="padding:8px 12px;text-align:left">FD</th>
            <th style="padding:8px 12px;text-align:left">Maturity Date</th>
            <th style="padding:8px 12px;text-align:left">Principal</th>
            <th style="padding:8px 12px;text-align:left">Maturity Amount</th>
            <th style="padding:8px 12px;text-align:left">Days Left</th>
          </tr>
        </thead>
        <tbody>${fdRows}</tbody>
      </table>
      <p style="color:#a0a0a5;font-size:12px;margin-top:24px">Sent by your Investment Tracker.</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "reminders@yourdomain.com",
    to,
    subject: `FD Maturity Reminder — ${fds.length} FD${fds.length > 1 ? "s" : ""} maturing soon`,
    html,
  });

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/notifications/email-service.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/email-service.ts src/lib/notifications/email-service.test.ts
git commit -m "feat(notifications): add Resend email service for FD reminders"
```

---

## Task 6: `whatsapp-service.ts`

**Files:**
- Create: `src/lib/notifications/whatsapp-service.ts`
- Create: `src/lib/notifications/whatsapp-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/whatsapp-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { sendFdReminderWhatsApp } from "./whatsapp-service";
import type { FdReminderItem } from "./email-service";

const mockFds: FdReminderItem[] = [
  {
    bankName: "SBI",
    fdNumber: null,
    maturityDate: new Date("2026-05-03"),
    principal: 50000,
    maturityAmount: 52500,
    daysRemaining: 10,
  },
];

describe("sendFdReminderWhatsApp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("skips and does not call fetch when WHATSAPP_ENABLED is not true", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false");
    await sendFdReminderWhatsApp("+919876543210", mockFds);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls Meta Cloud API when WHATSAPP_ENABLED=true", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await sendFdReminderWhatsApp("+919876543210", mockFds);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/12345/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("throws when Meta API returns non-ok response", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    await expect(sendFdReminderWhatsApp("+919876543210", mockFds)).rejects.toThrow("Invalid token");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/notifications/whatsapp-service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `whatsapp-service.ts`**

Create `src/lib/notifications/whatsapp-service.ts`:

```typescript
import type { FdReminderItem } from "./email-service";

function buildMessageText(fds: FdReminderItem[]): string {
  const lines = fds.map((fd) => {
    const label = fd.fdNumber ? `${fd.bankName} (${fd.fdNumber})` : fd.bankName;
    const date = fd.maturityDate.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
    const principal = `₹${fd.principal.toLocaleString("en-IN")}`;
    const amount = fd.maturityAmount
      ? ` → ₹${fd.maturityAmount.toLocaleString("en-IN")}`
      : "";
    return `• ${label}\n  Matures: ${date} (${fd.daysRemaining} days)\n  Principal: ${principal}${amount}`;
  });

  return `*FD Maturity Reminder* 🔔\n\n${lines.join("\n\n")}\n\nLog in to your Investment Tracker to take action.`;
}

export async function sendFdReminderWhatsApp(
  phone: string,
  fds: FdReminderItem[]
): Promise<void> {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    console.log(`[WhatsApp] Skipped for ${phone}: WHATSAPP_ENABLED is not true`);
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: buildMessageText(fds) },
  };

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error?.message ?? `WhatsApp API error: ${res.status}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/notifications/whatsapp-service.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/whatsapp-service.ts src/lib/notifications/whatsapp-service.test.ts
git commit -m "feat(notifications): add env-gated WhatsApp service for FD reminders"
```

---

## Task 7: `fd-reminder-service.ts`

**Files:**
- Create: `src/lib/notifications/fd-reminder-service.ts`
- Create: `src/lib/notifications/fd-reminder-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/notifications/fd-reminder-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixedDeposit: { findMany: vi.fn() },
    userProfile: { findMany: vi.fn() },
  },
}));
vi.mock("./email-service", () => ({ sendFdReminderEmail: vi.fn() }));
vi.mock("./whatsapp-service", () => ({ sendFdReminderWhatsApp: vi.fn() }));

import { getISTDateRange, sendFdReminders } from "./fd-reminder-service";
import { prisma } from "@/lib/prisma";
import { sendFdReminderEmail } from "./email-service";
import { sendFdReminderWhatsApp } from "./whatsapp-service";

describe("getISTDateRange", () => {
  it("returns a 24-hour window for the given day offset", () => {
    const { gte, lt } = getISTDateRange(0);
    const diff = lt.getTime() - gte.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it("returns a range 10 days ahead of today", () => {
    const { gte: today } = getISTDateRange(0);
    const { gte: tenDays } = getISTDateRange(10);
    const diff = tenDays.getTime() - today.getTime();
    expect(diff).toBe(10 * 24 * 60 * 60 * 1000);
  });
});

describe("sendFdReminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email and whatsapp for each user with maturing FDs", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([
      {
        id: "fd1", userId: "alice@example.com", bankName: "HDFC", fdNumber: "001",
        principal: 100000, maturityAmount: 105000,
        maturityDate: new Date(), disabled: false,
      },
    ] as never);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([
      { userId: "alice@example.com", phone: "+919876543210" },
    ] as never);
    vi.mocked(sendFdReminderEmail).mockResolvedValue(undefined);
    vi.mocked(sendFdReminderWhatsApp).mockResolvedValue(undefined);

    await sendFdReminders();

    expect(sendFdReminderEmail).toHaveBeenCalledWith(
      "alice@example.com",
      expect.arrayContaining([expect.objectContaining({ bankName: "HDFC" })])
    );
    expect(sendFdReminderWhatsApp).toHaveBeenCalledWith(
      "+919876543210",
      expect.arrayContaining([expect.objectContaining({ bankName: "HDFC" })])
    );
  });

  it("skips WhatsApp when user has no phone", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([
      {
        id: "fd2", userId: "bob@example.com", bankName: "SBI", fdNumber: null,
        principal: 50000, maturityAmount: null,
        maturityDate: new Date(), disabled: false,
      },
    ] as never);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([]);
    vi.mocked(sendFdReminderEmail).mockResolvedValue(undefined);
    vi.mocked(sendFdReminderWhatsApp).mockResolvedValue(undefined);

    await sendFdReminders();

    expect(sendFdReminderEmail).toHaveBeenCalledWith("bob@example.com", expect.any(Array));
    expect(sendFdReminderWhatsApp).not.toHaveBeenCalled();
  });

  it("continues processing other users if one throws", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([
      { id: "fd3", userId: "err@example.com", bankName: "ICICI", fdNumber: null, principal: 10000, maturityAmount: null, maturityDate: new Date(), disabled: false },
      { id: "fd4", userId: "ok@example.com", bankName: "Axis", fdNumber: null, principal: 20000, maturityAmount: null, maturityDate: new Date(), disabled: false },
    ] as never);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([]);
    vi.mocked(sendFdReminderEmail)
      .mockRejectedValueOnce(new Error("Resend error"))
      .mockResolvedValueOnce(undefined);

    await sendFdReminders(); // should not throw

    expect(sendFdReminderEmail).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no FDs are maturing", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([]);

    await sendFdReminders();

    expect(sendFdReminderEmail).not.toHaveBeenCalled();
    expect(sendFdReminderWhatsApp).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/notifications/fd-reminder-service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `fd-reminder-service.ts`**

Create `src/lib/notifications/fd-reminder-service.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { sendFdReminderEmail, type FdReminderItem } from "./email-service";
import { sendFdReminderWhatsApp } from "./whatsapp-service";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

export function getISTDateRange(daysFromNow: number): { gte: Date; lt: Date } {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const gte = new Date(
    Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() + daysFromNow) - IST_OFFSET_MS
  );
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

export async function sendFdReminders(): Promise<void> {
  const window10 = getISTDateRange(10);
  const window5 = getISTDateRange(5);

  const fds = await prisma.fixedDeposit.findMany({
    where: {
      disabled: false,
      OR: [
        { maturityDate: window10 },
        { maturityDate: window5 },
      ],
    },
    select: {
      id: true,
      userId: true,
      bankName: true,
      fdNumber: true,
      maturityDate: true,
      principal: true,
      maturityAmount: true,
    },
  });

  if (fds.length === 0) return;

  const userIds = [...new Set(fds.map((fd) => fd.userId))];
  const profiles = await prisma.userProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, phone: true },
  });
  const phoneByUserId = new Map(profiles.map((p) => [p.userId, p.phone]));

  const byUser = new Map<string, typeof fds>();
  for (const fd of fds) {
    const list = byUser.get(fd.userId) ?? [];
    list.push(fd);
    byUser.set(fd.userId, list);
  }

  for (const [userId, userFds] of byUser) {
    const items: FdReminderItem[] = userFds.map((fd) => ({
      bankName: fd.bankName,
      fdNumber: fd.fdNumber,
      maturityDate: fd.maturityDate,
      principal: fd.principal,
      maturityAmount: fd.maturityAmount,
      daysRemaining: fd.maturityDate >= window10.gte && fd.maturityDate < window10.lt ? 10 : 5,
    }));

    try {
      await sendFdReminderEmail(userId, items);
    } catch (err) {
      console.error(`[FD reminders] Email failed for ${userId}:`, err);
    }

    const phone = phoneByUserId.get(userId);
    if (phone) {
      try {
        await sendFdReminderWhatsApp(phone, items);
      } catch (err) {
        console.error(`[FD reminders] WhatsApp failed for ${userId}:`, err);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/notifications/fd-reminder-service.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/fd-reminder-service.ts src/lib/notifications/fd-reminder-service.test.ts
git commit -m "feat(notifications): add FD reminder service with IST date windows"
```

---

## Task 8: Scheduler + instrumentation

**Files:**
- Create: `src/lib/notifications/scheduler.ts`
- Create: `src/instrumentation.ts`

- [ ] **Step 1: Create `scheduler.ts`**

Create `src/lib/notifications/scheduler.ts`:

```typescript
import cron from "node-cron";
import { sendFdReminders } from "./fd-reminder-service";

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  // 9:00 AM IST = 3:30 AM UTC → cron in UTC: "30 3 * * *"
  cron.schedule("30 3 * * *", async () => {
    console.log("[Scheduler] Running FD maturity reminders");
    try {
      await sendFdReminders();
      console.log("[Scheduler] FD reminders completed");
    } catch (err) {
      console.error("[Scheduler] FD reminders failed:", err);
    }
  });

  console.log("[Scheduler] FD reminder cron registered (daily 09:00 IST)");
}
```

- [ ] **Step 2: Create `instrumentation.ts`**

Create `src/instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/notifications/scheduler");
    startScheduler();
  }
}
```

- [ ] **Step 3: Verify Next.js picks up instrumentation**

Check that `next.config.ts` does not have `instrumentationHook: false`. (It doesn't — no change needed.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications/scheduler.ts src/instrumentation.ts
git commit -m "feat(notifications): register daily FD reminder cron via instrumentation"
```

---

## Task 9: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new env vars to `.env.example`**

Open `.env.example` and append:

```env
# Email reminders (Resend — https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=reminders@yourdomain.com

# WhatsApp reminders (Meta Cloud API — set WHATSAPP_ENABLED=true when WABA is ready)
WHATSAPP_ENABLED=false
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

- [ ] **Step 2: Run the full test suite to confirm nothing is broken**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: document notification env vars in .env.example"
```

---

## Summary

After completing all tasks you will have:

1. A `UserProfile` Prisma model storing each user's WhatsApp phone number
2. A settings page section where users enter their phone
3. A `PATCH /api/user/profile` API route to save it
4. Resend email service that sends a combined HTML reminder per user
5. WhatsApp service wired to Meta Cloud API, activated by `WHATSAPP_ENABLED=true`
6. Core `fd-reminder-service` that queries FDs in 10-day and 5-day IST windows
7. A `node-cron` scheduler running daily at 9 AM IST, started via `instrumentation.ts`

**To activate:** set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in your Railway environment. WhatsApp activates later when you flip `WHATSAPP_ENABLED=true` and add the Meta tokens.
