# Axis Email → Daily Expense Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every night at 22:00 IST, read the last 24h of Axis Bank alert emails, extract each expense with Claude, store them in a `BankAlert` table, and push a digest of the day's debits to WhatsApp via an approved template — with an owner-only settings panel to preview/test it.

**Architecture:** A new `src/lib/bank-alerts/` module (gmail-client → alert-parser → alert-store → digest-message, orchestrated by digest-service) reuses the existing `node-cron` scheduler and the existing WhatsApp Cloud API service. A `dryRun` API route + a settings-page panel drive on-demand preview/send.

**Tech Stack:** Next.js 16.2.4, Prisma 7 + `@libsql/client` (Turso), `imapflow` + `mailparser`, `@anthropic-ai/sdk` (Claude Haiku), Meta WhatsApp Cloud API, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-23-axis-email-expense-digest-design.md`

## Global Constraints

- **Next.js is non-standard (16.2.4).** Per `AGENTS.md`, before writing route handlers or touching instrumentation, read the relevant guide under `node_modules/next/dist/docs/`. Mirror existing handlers (`src/app/api/user/profile/route.ts`) exactly.
- **DB migrations:** no `prisma/migrations/` folder. Apply DDL by writing a `scripts/add-*-table.mjs` (mirror `scripts/add-user-profile-table.mjs`) that runs raw SQL via `@libsql/client`, then run `npx prisma generate`.
- **`userId` is the user's email.** The owner is `SUPER_ADMIN_EMAIL = "sushant.gawali@gmail.com"`; gate owner-only code with `isSupAdmin(email)` from `src/lib/session.ts`.
- **Claude calls** use `anthropic.messages.stream({ model: "claude-haiku-4-5-20251001", ... }).finalMessage()` and parse JSON from the text block (no tool-use). Mirror `src/lib/bank-accounts/ai-categorize.ts`.
- **WhatsApp** posts to `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, env-gated by `WHATSAPP_ENABLED === "true"`. Mirror `src/lib/notifications/whatsapp-service.ts`.
- **Tests:** Vitest, `environment: "node"`, files `src/**/*.test.ts`. **Mock** prisma / `fetch` / anthropic / imapflow — never hit a real DB or network. Mirror `src/app/api/user/profile/route.test.ts` and `src/lib/notifications/whatsapp-service.test.ts`.
- **Currency:** format with `toLocaleString("en-IN")`; render times/dates in `timeZone: "Asia/Kolkata"`.
- **Commits:** conventional messages, **no `Co-Authored-By: Claude` trailer**.
- **Run a single test file** with: `npx vitest run <path>`.

---

### Task 1: `BankAlert` model + table migration

**Files:**
- Modify: `prisma/schema.prisma` (append model)
- Create: `scripts/add-bank-alert-table.mjs`

**Interfaces:**
- Produces: the `BankAlert` Prisma model → `prisma.bankAlert.{findUnique,upsert,findMany,count}` with compound unique `userId_emailMessageId`. Consumed by Task 6 (alert-store).

- [ ] **Step 1: Add the model to the schema**

Append to `prisma/schema.prisma`:

```prisma
model BankAlert {
  id               String   @id @default(cuid())
  userId           String
  emailMessageId   String
  emailDate        DateTime
  txnTime          DateTime?
  direction        String   // "debit" | "credit"
  amount           Float
  merchant         String?
  accountLast4     String?
  availableBalance Float?
  channel          String?  // card | upi | atm | neft | imps | emi | netbanking | other
  rawSubject       String?
  rawSnippet       String?
  parseStatus      String   @default("parsed") // parsed | unparsed | ignored
  createdAt        DateTime @default(now())

  @@unique([userId, emailMessageId])
  @@index([userId, emailDate])
}
```

- [ ] **Step 2: Create the migration script**

Create `scripts/add-bank-alert-table.mjs` (mirrors `scripts/add-user-profile-table.mjs`):

```js
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = `
CREATE TABLE IF NOT EXISTS "BankAlert" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "userId"           TEXT NOT NULL,
  "emailMessageId"   TEXT NOT NULL,
  "emailDate"        DATETIME NOT NULL,
  "txnTime"          DATETIME,
  "direction"        TEXT NOT NULL,
  "amount"           REAL NOT NULL,
  "merchant"         TEXT,
  "accountLast4"     TEXT,
  "availableBalance" REAL,
  "channel"          TEXT,
  "rawSubject"       TEXT,
  "rawSnippet"       TEXT,
  "parseStatus"      TEXT NOT NULL DEFAULT 'parsed',
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankAlert_userId_emailMessageId_key" ON "BankAlert"("userId", "emailMessageId");
CREATE INDEX IF NOT EXISTS "BankAlert_userId_emailDate_idx" ON "BankAlert"("userId", "emailDate");
`;

for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
  await client.execute(statement);
  console.log("✓", statement.slice(0, 80));
}

console.log("\nBankAlert table pushed to Turso successfully.");
```

- [ ] **Step 3: Apply the migration**

Run: `node scripts/add-bank-alert-table.mjs`
Expected: three `✓ CREATE ...` lines, then `BankAlert table pushed to Turso successfully.`

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` success message.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (the `BankAlert` delegate now exists on the client).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma scripts/add-bank-alert-table.mjs
git commit -m "feat(bank-alerts): add BankAlert model + table migration"
```

---

### Task 2: `digest-message.ts` — pure template-param builder

**Files:**
- Create: `src/lib/bank-alerts/digest-message.ts`
- Test: `src/lib/bank-alerts/digest-message.test.ts`

**Interfaces:**
- Produces:
  - `interface DigestExpense { amount: number; merchant: string | null; txnTime: Date | null }`
  - `interface DigestParamsInput { expenses: DigestExpense[]; date: Date; unparsedCount: number }`
  - `interface DigestParams { params: [string, string, string, string]; total: number; count: number }`
  - `function buildDigestParams(input: DigestParamsInput): DigestParams`
  - `function formatINR(n: number): string`
  - Consumed by Task 7 (digest-service).

- [ ] **Step 1: Write the failing test**

Create `src/lib/bank-alerts/digest-message.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDigestParams, type DigestExpense } from "./digest-message";

const date = new Date("2026-06-23T16:30:00Z"); // 10:00pm IST

function exp(amount: number, merchant: string | null, iso: string | null): DigestExpense {
  return { amount, merchant, txnTime: iso ? new Date(iso) : null };
}

const NO_NEWLINE = /^[^\n\r\t]*$/;

describe("buildDigestParams", () => {
  it("totals, counts, and lists debits sorted by amount desc", () => {
    const { params, total, count } = buildDigestParams({
      date,
      unparsedCount: 0,
      expenses: [
        exp(540, "Swiggy", "2026-06-23T14:44:00Z"),
        exp(1200, "Amazon", "2026-06-23T12:32:00Z"),
      ],
    });
    expect(total).toBe(1740);
    expect(count).toBe(2);
    expect(params[0]).toBe("23 Jun 2026");
    expect(params[1]).toBe("1,740");
    expect(params[2]).toBe("2");
    // Amazon (1200) before Swiggy (540)
    expect(params[3].indexOf("Amazon")).toBeLessThan(params[3].indexOf("Swiggy"));
    expect(params[3]).toContain(" • ");
  });

  it("renders the no-expense heartbeat", () => {
    const { params, total, count } = buildDigestParams({ date, unparsedCount: 0, expenses: [] });
    expect(total).toBe(0);
    expect(count).toBe(0);
    expect(params[1]).toBe("0");
    expect(params[3]).toBe("No expenses today ✅");
  });

  it("appends an unparsed-count note", () => {
    const { params } = buildDigestParams({ date, unparsedCount: 2, expenses: [exp(10, "X", null)] });
    expect(params[3]).toContain("⚠️ 2 alerts not parsed");
  });

  it("truncates long lists and summarises the remainder", () => {
    const expenses = Array.from({ length: 60 }, (_, i) =>
      exp(1000 + i, `Merchant-Number-${i}`, null),
    );
    const { params } = buildDigestParams({ date, unparsedCount: 0, expenses });
    expect(params[3].length).toBeLessThanOrEqual(1024);
    expect(params[3]).toMatch(/…\+\d+ more \(₹[\d,]+\)/);
  });

  it("never emits newlines, tabs, or 4+ spaces in any parameter", () => {
    const { params } = buildDigestParams({
      date,
      unparsedCount: 1,
      expenses: [exp(99, "Has   lots    of spaces", null), exp(5, null, null)],
    });
    for (const p of params) {
      expect(p).toMatch(NO_NEWLINE);
      expect(p).not.toMatch(/ {4,}/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bank-alerts/digest-message.test.ts`
Expected: FAIL — `Cannot find module './digest-message'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bank-alerts/digest-message.ts`:

```ts
// Pure builders that turn the day's expenses into the 4 positional parameters
// for the `daily_expense_digest` WhatsApp template. Meta forbids newlines,
// tabs, and 4+ consecutive spaces inside template parameter VALUES, so every
// returned string is single-line and space-collapsed.

export interface DigestExpense {
  amount: number; // INR, positive
  merchant: string | null;
  txnTime: Date | null;
}

export interface DigestParamsInput {
  expenses: DigestExpense[];
  date: Date; // the run date (today, IST)
  unparsedCount: number;
}

export interface DigestParams {
  params: [string, string, string, string]; // [date, total, count, itemList]
  total: number;
  count: number;
}

const MAX_ITEMS_CHARS = 900; // headroom under Meta's 1024 body limit

export function formatINR(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

export function formatTime(d: Date | null): string {
  if (!d) return "—";
  const s = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return s.replace(/\s/g, "").toLowerCase(); // "8:14 PM" -> "8:14pm"
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// Collapse anything Meta forbids in a parameter value.
function sanitizeParam(s: string): string {
  return s.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

export function buildDigestParams(input: DigestParamsInput): DigestParams {
  const { expenses, date, unparsedCount } = input;
  const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, e) => sum + e.amount, 0);
  const count = sorted.length;

  let itemList: string;
  if (count === 0) {
    itemList = "No expenses today ✅";
  } else {
    const items = sorted.map(
      (e) => `₹${formatINR(e.amount)} ${e.merchant ?? "Unknown"} (${formatTime(e.txnTime)})`,
    );
    const kept: string[] = [];
    let used = 0;
    let i = 0;
    for (; i < items.length; i++) {
      const addLen = (kept.length ? 3 : 0) + items[i].length; // " • " separator
      if (used + addLen > MAX_ITEMS_CHARS) break;
      kept.push(items[i]);
      used += addLen;
    }
    if (i < items.length) {
      const remaining = sorted.slice(i);
      const remSum = remaining.reduce((s, e) => s + e.amount, 0);
      kept.push(`…+${remaining.length} more (₹${formatINR(remSum)})`);
    }
    itemList = kept.join(" • ");
  }

  if (unparsedCount > 0) {
    itemList += ` (⚠️ ${unparsedCount} alert${unparsedCount === 1 ? "" : "s"} not parsed)`;
  }

  return {
    params: [
      sanitizeParam(formatDate(date)),
      sanitizeParam(formatINR(total)),
      sanitizeParam(String(count)),
      sanitizeParam(itemList),
    ],
    total,
    count,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bank-alerts/digest-message.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-alerts/digest-message.ts src/lib/bank-alerts/digest-message.test.ts
git commit -m "feat(bank-alerts): pure WhatsApp digest message builder"
```

---

### Task 3: `sendWhatsAppTemplate()` on the WhatsApp service

**Files:**
- Modify: `src/lib/notifications/whatsapp-service.ts` (append function)
- Modify: `src/lib/notifications/whatsapp-service.test.ts` (append describe block)

**Interfaces:**
- Produces: `function sendWhatsAppTemplate(phone: string, templateName: string, languageCode: string, bodyParams: string[]): Promise<void>`. Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/notifications/whatsapp-service.test.ts` (after the existing `describe`):

```ts
import { sendWhatsAppTemplate } from "./whatsapp-service";

describe("sendWhatsAppTemplate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("skips when WHATSAPP_ENABLED is not true", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false");
    await sendWhatsAppTemplate("+919876543210", "daily_expense_digest", "en", ["a", "b", "c", "d"]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts a template-typed message with body parameters", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await sendWhatsAppTemplate("+919876543210", "daily_expense_digest", "en", ["23 Jun", "1,740", "2", "items"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/12345/messages",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("daily_expense_digest");
    expect(body.template.language.code).toBe("en");
    expect(body.template.components[0]).toEqual({
      type: "body",
      parameters: [
        { type: "text", text: "23 Jun" },
        { type: "text", text: "1,740" },
        { type: "text", text: "2" },
        { type: "text", text: "items" },
      ],
    });
  });

  it("throws on non-ok response", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_TOKEN", "t");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1");
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Bad template" } }) });
    await expect(
      sendWhatsAppTemplate("+919876543210", "x", "en", ["a"]),
    ).rejects.toThrow("Bad template");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications/whatsapp-service.test.ts`
Expected: FAIL — `sendWhatsAppTemplate is not a function` / no export.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/notifications/whatsapp-service.ts`:

```ts
/**
 * Send a pre-approved WhatsApp template message (required for business-initiated
 * messages outside the 24h session window). `bodyParams` fill the template's
 * {{1}}, {{2}}, ... body variables in order.
 */
export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
): Promise<void> {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    console.log(`[WhatsApp] Skipped template for ${phone}: WHATSAPP_ENABLED is not true`);
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error?.message ?? `WhatsApp API error: ${res.status}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications/whatsapp-service.test.ts`
Expected: PASS (existing 3 + new 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/whatsapp-service.ts src/lib/notifications/whatsapp-service.test.ts
git commit -m "feat(notifications): add sendWhatsAppTemplate for template messages"
```

---

### Task 4: `alert-parser.ts` — pre-filter + Claude extraction

**Files:**
- Create: `src/lib/bank-alerts/alert-parser.ts`
- Test: `src/lib/bank-alerts/alert-parser.test.ts`

**Interfaces:**
- Consumes: nothing from sibling tasks — `parseAlertEmail` accepts a structural `{ subject, text }`, so this task has no cross-file type dependency and can be built in any order.
- Produces:
  - `type Channel = "card" | "upi" | "atm" | "neft" | "imps" | "emi" | "netbanking" | "other"`
  - `interface ParsedAlert { direction: "debit" | "credit"; amount: number; merchant: string | null; txnTime: string | null; accountLast4: string | null; availableBalance: number | null; channel: Channel }`
  - `type ParseOutcome = { status: "parsed"; alert: ParsedAlert } | { status: "ignored" } | { status: "unparsed" }`
  - `function isLikelyTransaction(email: { subject: string; text: string }): boolean`
  - `function parseAlertEmail(email: { subject: string; text: string }): Promise<ParseOutcome>`
  - Consumed by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test**

Create `src/lib/bank-alerts/alert-parser.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const finalMessage = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  anthropic: { messages: { stream: vi.fn(() => ({ finalMessage })) } },
}));

import { isLikelyTransaction, parseAlertEmail } from "./alert-parser";
import { anthropic } from "@/lib/anthropic";

function modelReturns(obj: unknown) {
  finalMessage.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(obj) }] });
}

const debitEmail = {
  messageId: "<1@axis>",
  date: new Date("2026-06-23T14:44:00Z"),
  subject: "Transaction alert on your Axis Bank Debit Card",
  text: "INR 540.00 spent on your card ending 1234 at Swiggy on 23-06-2026.",
};

describe("isLikelyTransaction", () => {
  it("accepts emails with an amount and an action verb", () => {
    expect(isLikelyTransaction(debitEmail)).toBe(true);
  });
  it("rejects OTP / promo emails", () => {
    expect(isLikelyTransaction({ subject: "Your OTP", text: "Your one time password is 123456" })).toBe(false);
  });
});

describe("parseAlertEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ignored without calling Claude when pre-filter rejects", async () => {
    const promo = { subject: "Newsletter", text: "Hello from Axis" };
    const out = await parseAlertEmail(promo);
    expect(out.status).toBe("ignored");
    expect(anthropic.messages.stream).not.toHaveBeenCalled();
  });

  it("returns a parsed alert with mapped fields", async () => {
    modelReturns({
      isTransaction: true,
      direction: "debit",
      amount: 540,
      merchant: "Swiggy",
      txnTime: "2026-06-23T20:14:00+05:30",
      accountLast4: "1234",
      availableBalance: 10250.5,
      channel: "card",
    });
    const out = await parseAlertEmail(debitEmail);
    expect(out).toEqual({
      status: "parsed",
      alert: {
        direction: "debit",
        amount: 540,
        merchant: "Swiggy",
        txnTime: "2026-06-23T20:14:00+05:30",
        accountLast4: "1234",
        availableBalance: 10250.5,
        channel: "card",
      },
    });
  });

  it("returns ignored when the model says it is not a transaction", async () => {
    modelReturns({ isTransaction: false });
    expect((await parseAlertEmail(debitEmail)).status).toBe("ignored");
  });

  it("returns unparsed when the model output is unusable", async () => {
    modelReturns({ isTransaction: true, direction: "sideways" });
    expect((await parseAlertEmail(debitEmail)).status).toBe("unparsed");
  });

  it("returns unparsed when the Claude call throws", async () => {
    finalMessage.mockRejectedValue(new Error("network"));
    expect((await parseAlertEmail(debitEmail)).status).toBe("unparsed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bank-alerts/alert-parser.test.ts`
Expected: FAIL — `Cannot find module './alert-parser'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bank-alerts/alert-parser.ts`:

```ts
// Two-stage extraction of a structured expense from one Axis Bank alert email:
//   1. a free deterministic pre-filter that drops non-transaction mail, and
//   2. a Claude Haiku call returning the structured fields as JSON.
import { anthropic } from "@/lib/anthropic";

export type Channel =
  | "card" | "upi" | "atm" | "neft" | "imps" | "emi" | "netbanking" | "other";

export interface ParsedAlert {
  direction: "debit" | "credit";
  amount: number;
  merchant: string | null;
  txnTime: string | null; // ISO 8601 if present
  accountLast4: string | null;
  availableBalance: number | null;
  channel: Channel;
}

export type ParseOutcome =
  | { status: "parsed"; alert: ParsedAlert }
  | { status: "ignored" }
  | { status: "unparsed" };

const AMOUNT_RE = /(?:rs\.?|inr|₹)\s?\d[\d,]*(?:\.\d+)?/i;
const ACTION_RE =
  /\b(debited|credited|spent|withdrawn|purchase|transaction|debit|credit|paid|sent|received)\b/i;

export function isLikelyTransaction(email: { subject: string; text: string }): boolean {
  const hay = `${email.subject}\n${email.text}`;
  return AMOUNT_RE.test(hay) && ACTION_RE.test(hay);
}

function stripFences(s: string): string {
  return s.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const stripped = stripFences(raw);
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const first = stripped.indexOf("{");
    const last = stripped.lastIndexOf("}");
    if (first !== -1 && last > first) {
      return JSON.parse(stripped.slice(first, last + 1)) as Record<string, unknown>;
    }
    throw new Error(`alert-parser: malformed JSON: ${raw.slice(0, 200)}`);
  }
}

const CHANNELS: Channel[] = ["card", "upi", "atm", "neft", "imps", "emi", "netbanking", "other"];

function coerceAlert(o: Record<string, unknown>): ParsedAlert | null {
  const direction = o.direction === "credit" ? "credit" : o.direction === "debit" ? "debit" : null;
  const amount = typeof o.amount === "number" && o.amount > 0 ? o.amount : null;
  if (!direction || amount === null) return null;
  const channel = CHANNELS.includes(o.channel as Channel) ? (o.channel as Channel) : "other";
  return {
    direction,
    amount,
    merchant: typeof o.merchant === "string" && o.merchant.trim() ? o.merchant.trim() : null,
    txnTime: typeof o.txnTime === "string" && o.txnTime.trim() ? o.txnTime : null,
    accountLast4: typeof o.accountLast4 === "string" && o.accountLast4.trim() ? o.accountLast4 : null,
    availableBalance: typeof o.availableBalance === "number" ? o.availableBalance : null,
    channel,
  };
}

const SYSTEM = `You extract a single bank transaction from one Axis Bank alert email.
Return ONLY a JSON object, no prose, with this exact shape:
{
  "isTransaction": true,
  "direction": "debit" | "credit",
  "amount": <number, positive INR, no currency symbol or commas>,
  "merchant": <string payee/counterparty/location, or null>,
  "txnTime": <ISO 8601 datetime if the email states one, else null>,
  "accountLast4": <last 4 digits of the account/card if present, else null>,
  "availableBalance": <number if the email states available balance, else null>,
  "channel": "card" | "upi" | "atm" | "neft" | "imps" | "emi" | "netbanking" | "other"
}
If the email is NOT a real money-movement transaction (OTP, promo, statement-ready,
login alert, failed/declined transaction), return {"isTransaction": false}.`;

export async function parseAlertEmail(email: { subject: string; text: string }): Promise<ParseOutcome> {
  if (!isLikelyTransaction(email)) return { status: "ignored" };

  try {
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: `Subject: ${email.subject}\n\n${email.text}` }],
    });
    const res = await stream.finalMessage();
    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { status: "unparsed" };

    const obj = parseJsonObject(textBlock.text);
    if (obj.isTransaction === false) return { status: "ignored" };
    const alert = coerceAlert(obj);
    return alert ? { status: "parsed", alert } : { status: "unparsed" };
  } catch {
    return { status: "unparsed" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bank-alerts/alert-parser.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-alerts/alert-parser.ts src/lib/bank-alerts/alert-parser.test.ts
git commit -m "feat(bank-alerts): Axis alert pre-filter + Claude extraction"
```

---

### Task 5: `gmail-client.ts` — IMAP fetch of Axis alerts

**Files:**
- Create: `src/lib/bank-alerts/gmail-client.ts`
- Test: `src/lib/bank-alerts/gmail-client.test.ts`
- Modify: `package.json` (add `imapflow`, `mailparser`, `@types/mailparser`)

**Interfaces:**
- Produces:
  - `interface RawEmail { messageId: string; date: Date; subject: string; text: string }`
  - `function fetchAxisAlerts(opts: { user: string; password: string; sender: string; since: Date }): Promise<RawEmail[]>`
  - Consumed by Task 7.

- [ ] **Step 1: Add dependencies**

Run: `npm install imapflow mailparser && npm install -D @types/mailparser`
Expected: packages added to `package.json`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/bank-alerts/gmail-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const connect = vi.fn();
const mailboxOpen = vi.fn();
const logout = vi.fn();
const fetch = vi.fn();

vi.mock("imapflow", () => ({
  ImapFlow: vi.fn(() => ({ connect, mailboxOpen, logout, fetch })),
}));
const simpleParser = vi.fn();
vi.mock("mailparser", () => ({ simpleParser }));

import { fetchAxisAlerts } from "./gmail-client";
import { ImapFlow } from "imapflow";

function asyncIterableOf<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const i of items) yield i;
    },
  };
}

describe("fetchAxisAlerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the inbox read-only, searches by sender+since, and maps results", async () => {
    fetch.mockReturnValue(asyncIterableOf([{ source: Buffer.from("raw"), uid: 7, envelope: {} }]));
    simpleParser.mockResolvedValue({
      messageId: "<abc@axis>",
      date: new Date("2026-06-23T14:44:00Z"),
      subject: "Debit alert",
      text: "INR 540 spent",
      html: null,
    });

    const since = new Date("2026-06-22T16:30:00Z");
    const out = await fetchAxisAlerts({
      user: "me@gmail.com",
      password: "app-pass",
      sender: "alerts@axis.bank.in",
      since,
    });

    expect(ImapFlow).toHaveBeenCalledWith(
      expect.objectContaining({ host: "imap.gmail.com", port: 993, secure: true }),
    );
    expect(mailboxOpen).toHaveBeenCalledWith("INBOX", { readOnly: true });
    expect(fetch).toHaveBeenCalledWith(
      { from: "alerts@axis.bank.in", since },
      expect.objectContaining({ source: true }),
    );
    expect(logout).toHaveBeenCalled();
    expect(out).toEqual([
      { messageId: "<abc@axis>", date: new Date("2026-06-23T14:44:00Z"), subject: "Debit alert", text: "INR 540 spent" },
    ]);
  });

  it("falls back to stripped HTML when there is no text part", async () => {
    fetch.mockReturnValue(asyncIterableOf([{ source: Buffer.from("raw"), uid: 8, envelope: {} }]));
    simpleParser.mockResolvedValue({
      messageId: "<def@axis>",
      date: new Date("2026-06-23T10:00:00Z"),
      subject: "HTML alert",
      text: undefined,
      html: "<p>INR&nbsp;99 <b>debited</b></p>",
    });

    const out = await fetchAxisAlerts({ user: "u", password: "p", sender: "s", since: new Date(0) });
    expect(out[0].text).toBe("INR 99 debited");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/bank-alerts/gmail-client.test.ts`
Expected: FAIL — `Cannot find module './gmail-client'`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/bank-alerts/gmail-client.ts`:

```ts
// Read-only IMAP fetch of recent Axis Bank alert emails from Gmail.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export interface RawEmail {
  messageId: string;
  date: Date;
  subject: string;
  text: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchAxisAlerts(opts: {
  user: string;
  password: string;
  sender: string;
  since: Date;
}): Promise<RawEmail[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: opts.user, pass: opts.password },
    logger: false,
  });

  const out: RawEmail[] = [];
  await client.connect();
  try {
    await client.mailboxOpen("INBOX", { readOnly: true });
    for await (const msg of client.fetch(
      { from: opts.sender, since: opts.since },
      { source: true, envelope: true },
    )) {
      const parsed = await simpleParser(msg.source as Buffer);
      const text = parsed.text ?? (parsed.html ? htmlToText(parsed.html) : "");
      out.push({
        messageId: parsed.messageId ?? `${msg.uid}@imap`,
        date: parsed.date ?? msg.envelope?.date ?? new Date(),
        subject: parsed.subject ?? msg.envelope?.subject ?? "",
        text,
      });
    }
  } finally {
    await client.logout();
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bank-alerts/gmail-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/bank-alerts/gmail-client.ts src/lib/bank-alerts/gmail-client.test.ts
git commit -m "feat(bank-alerts): read-only IMAP fetch of Axis alert emails"
```

---

### Task 6: `alert-store.ts` — persistence, dedup, window query

**Files:**
- Create: `src/lib/bank-alerts/alert-store.ts`
- Test: `src/lib/bank-alerts/alert-store.test.ts`

**Interfaces:**
- Consumes: `ParseOutcome` (Task 4); `prisma.bankAlert` (Task 1).
- Produces:
  - `function isAlreadyStored(userId: string, messageId: string): Promise<boolean>`
  - `interface StoreAlertInput { userId: string; messageId: string; emailDate: Date; subject: string; rawSnippet: string; outcome: ParseOutcome }`
  - `function upsertAlert(input: StoreAlertInput): Promise<void>`
  - `interface RecentDebit { amount: number; merchant: string | null; txnTime: Date | null }`
  - `function getRecentDebits(userId: string, since: Date): Promise<RecentDebit[]>`
  - `function countRecentUnparsed(userId: string, since: Date): Promise<number>`
  - Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

Create `src/lib/bank-alerts/alert-store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bankAlert: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import {
  isAlreadyStored,
  upsertAlert,
  getRecentDebits,
  countRecentUnparsed,
} from "./alert-store";
import { prisma } from "@/lib/prisma";

const since = new Date("2026-06-22T16:30:00Z");

describe("alert-store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isAlreadyStored reflects findUnique", async () => {
    vi.mocked(prisma.bankAlert.findUnique).mockResolvedValue({ id: "x" } as never);
    expect(await isAlreadyStored("u@e.com", "<1>")).toBe(true);
    vi.mocked(prisma.bankAlert.findUnique).mockResolvedValue(null);
    expect(await isAlreadyStored("u@e.com", "<1>")).toBe(false);
  });

  it("upsertAlert maps a parsed outcome (txnTime → Date)", async () => {
    await upsertAlert({
      userId: "u@e.com",
      messageId: "<1>",
      emailDate: new Date("2026-06-23T14:44:00Z"),
      subject: "Debit alert",
      rawSnippet: "INR 540 ...",
      outcome: {
        status: "parsed",
        alert: {
          direction: "debit", amount: 540, merchant: "Swiggy",
          txnTime: "2026-06-23T20:14:00+05:30", accountLast4: "1234",
          availableBalance: 100, channel: "card",
        },
      },
    });
    const arg = vi.mocked(prisma.bankAlert.upsert).mock.calls[0][0];
    expect(arg.where).toEqual({ userId_emailMessageId: { userId: "u@e.com", emailMessageId: "<1>" } });
    expect(arg.create).toMatchObject({
      parseStatus: "parsed", direction: "debit", amount: 540, merchant: "Swiggy",
      txnTime: new Date("2026-06-23T20:14:00+05:30"), channel: "card",
    });
  });

  it("upsertAlert stores ignored/unparsed with safe placeholders", async () => {
    await upsertAlert({
      userId: "u@e.com", messageId: "<2>", emailDate: new Date(), subject: "Promo",
      rawSnippet: "Sale!", outcome: { status: "ignored" },
    });
    const arg = vi.mocked(prisma.bankAlert.upsert).mock.calls[0][0];
    expect(arg.create).toMatchObject({ parseStatus: "ignored", amount: 0, direction: "debit" });
  });

  it("getRecentDebits queries parsed debits in the window", async () => {
    vi.mocked(prisma.bankAlert.findMany).mockResolvedValue([
      { amount: 540, merchant: "Swiggy", txnTime: null },
    ] as never);
    const rows = await getRecentDebits("u@e.com", since);
    expect(prisma.bankAlert.findMany).toHaveBeenCalledWith({
      where: { userId: "u@e.com", parseStatus: "parsed", direction: "debit", emailDate: { gte: since } },
      select: { amount: true, merchant: true, txnTime: true },
      orderBy: { emailDate: "asc" },
    });
    expect(rows).toEqual([{ amount: 540, merchant: "Swiggy", txnTime: null }]);
  });

  it("countRecentUnparsed counts unparsed rows in the window", async () => {
    vi.mocked(prisma.bankAlert.count).mockResolvedValue(3 as never);
    expect(await countRecentUnparsed("u@e.com", since)).toBe(3);
    expect(prisma.bankAlert.count).toHaveBeenCalledWith({
      where: { userId: "u@e.com", parseStatus: "unparsed", emailDate: { gte: since } },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bank-alerts/alert-store.test.ts`
Expected: FAIL — `Cannot find module './alert-store'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bank-alerts/alert-store.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { ParseOutcome } from "./alert-parser";

export interface StoreAlertInput {
  userId: string;
  messageId: string;
  emailDate: Date;
  subject: string;
  rawSnippet: string;
  outcome: ParseOutcome;
}

export interface RecentDebit {
  amount: number;
  merchant: string | null;
  txnTime: Date | null;
}

export async function isAlreadyStored(userId: string, messageId: string): Promise<boolean> {
  const existing = await prisma.bankAlert.findUnique({
    where: { userId_emailMessageId: { userId, emailMessageId: messageId } },
    select: { id: true },
  });
  return existing !== null;
}

export async function upsertAlert(input: StoreAlertInput): Promise<void> {
  const { userId, messageId, emailDate, subject, rawSnippet, outcome } = input;
  const base = {
    userId,
    emailMessageId: messageId,
    emailDate,
    rawSubject: subject,
    rawSnippet,
  };

  const data =
    outcome.status === "parsed"
      ? {
          ...base,
          parseStatus: "parsed",
          direction: outcome.alert.direction,
          amount: outcome.alert.amount,
          merchant: outcome.alert.merchant,
          txnTime: outcome.alert.txnTime ? new Date(outcome.alert.txnTime) : null,
          accountLast4: outcome.alert.accountLast4,
          availableBalance: outcome.alert.availableBalance,
          channel: outcome.alert.channel,
        }
      : {
          ...base,
          parseStatus: outcome.status, // "ignored" | "unparsed"
          direction: "debit", // placeholder; non-parsed rows are excluded from digests
          amount: 0,
        };

  await prisma.bankAlert.upsert({
    where: { userId_emailMessageId: { userId, emailMessageId: messageId } },
    create: data,
    update: data,
  });
}

export async function getRecentDebits(userId: string, since: Date): Promise<RecentDebit[]> {
  return prisma.bankAlert.findMany({
    where: { userId, parseStatus: "parsed", direction: "debit", emailDate: { gte: since } },
    select: { amount: true, merchant: true, txnTime: true },
    orderBy: { emailDate: "asc" },
  });
}

export async function countRecentUnparsed(userId: string, since: Date): Promise<number> {
  return prisma.bankAlert.count({
    where: { userId, parseStatus: "unparsed", emailDate: { gte: since } },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bank-alerts/alert-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-alerts/alert-store.ts src/lib/bank-alerts/alert-store.test.ts
git commit -m "feat(bank-alerts): BankAlert persistence, dedup, window query"
```

---

### Task 7: `digest-service.ts` — orchestrator + `.env.example`

**Files:**
- Create: `src/lib/bank-alerts/digest-service.ts`
- Test: `src/lib/bank-alerts/digest-service.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `fetchAxisAlerts` (5), `parseAlertEmail` (4), `isAlreadyStored`/`upsertAlert`/`getRecentDebits`/`countRecentUnparsed` (6), `buildDigestParams` (2), `sendWhatsAppTemplate` (3), `prisma.userProfile` (existing).
- Produces:
  - `interface DigestResult { summary: {...}; params: string[]; messageText: string; sent: boolean }`
  - `function buildDigest(): Promise<DigestResult>` (no send)
  - `function runDailyExpenseDigest(): Promise<DigestResult>` (build + send)
  - Consumed by Tasks 8 and 9.

- [ ] **Step 1: Write the failing test**

Create `src/lib/bank-alerts/digest-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./gmail-client", () => ({ fetchAxisAlerts: vi.fn() }));
vi.mock("./alert-parser", () => ({ parseAlertEmail: vi.fn() }));
vi.mock("./alert-store", () => ({
  isAlreadyStored: vi.fn(),
  upsertAlert: vi.fn(),
  getRecentDebits: vi.fn(),
  countRecentUnparsed: vi.fn(),
}));
vi.mock("@/lib/notifications/whatsapp-service", () => ({ sendWhatsAppTemplate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { userProfile: { findUnique: vi.fn() } } }));

import { buildDigest, runDailyExpenseDigest } from "./digest-service";
import { fetchAxisAlerts } from "./gmail-client";
import { parseAlertEmail } from "./alert-parser";
import { isAlreadyStored, upsertAlert, getRecentDebits, countRecentUnparsed } from "./alert-store";
import { sendWhatsAppTemplate } from "@/lib/notifications/whatsapp-service";
import { prisma } from "@/lib/prisma";

const email = { messageId: "<1>", date: new Date("2026-06-23T14:44:00Z"), subject: "Debit", text: "INR 540 spent" };

function setEnv() {
  vi.stubEnv("EXPENSE_DIGEST_USER_ID", "u@e.com");
  vi.stubEnv("GMAIL_USER", "u@gmail.com");
  vi.stubEnv("GMAIL_APP_PASSWORD", "pass");
  vi.stubEnv("AXIS_ALERT_SENDER", "alerts@axis.bank.in");
}

describe("digest-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
    vi.mocked(fetchAxisAlerts).mockResolvedValue([email]);
    vi.mocked(isAlreadyStored).mockResolvedValue(false);
    vi.mocked(parseAlertEmail).mockResolvedValue({
      status: "parsed",
      alert: { direction: "debit", amount: 540, merchant: "Swiggy", txnTime: null, accountLast4: null, availableBalance: null, channel: "card" },
    });
    vi.mocked(getRecentDebits).mockResolvedValue([{ amount: 540, merchant: "Swiggy", txnTime: null }]);
    vi.mocked(countRecentUnparsed).mockResolvedValue(0);
  });

  it("buildDigest ingests, aggregates, and does NOT send", async () => {
    const res = await buildDigest();
    expect(upsertAlert).toHaveBeenCalledOnce();
    expect(res.summary.debitCount).toBe(1);
    expect(res.summary.total).toBe(540);
    expect(res.params[1]).toBe("540");
    expect(res.sent).toBe(false);
    expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  it("buildDigest skips already-stored emails", async () => {
    vi.mocked(isAlreadyStored).mockResolvedValue(true);
    await buildDigest();
    expect(parseAlertEmail).not.toHaveBeenCalled();
    expect(upsertAlert).not.toHaveBeenCalled();
  });

  it("runDailyExpenseDigest sends the built params to the resolved phone", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({ phone: "+919876543210" } as never);
    vi.stubEnv("WHATSAPP_DIGEST_TEMPLATE_NAME", "daily_expense_digest");
    vi.stubEnv("WHATSAPP_DIGEST_TEMPLATE_LANG", "en");

    const res = await runDailyExpenseDigest();
    expect(sendWhatsAppTemplate).toHaveBeenCalledWith(
      "+919876543210", "daily_expense_digest", "en", res.params,
    );
    expect(res.sent).toBe(true);
    expect(res.summary.sent).toBe(true);
  });

  it("runDailyExpenseDigest does not send when no phone is configured", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null);
    const res = await runDailyExpenseDigest();
    expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    expect(res.sent).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bank-alerts/digest-service.test.ts`
Expected: FAIL — `Cannot find module './digest-service'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bank-alerts/digest-service.ts`:

```ts
// Orchestrates the daily expense digest. `buildDigest` does everything except
// send (used by the preview/dry-run path); `runDailyExpenseDigest` builds then
// sends via WhatsApp. The EXPENSE_DIGEST_ENABLED gate lives in the scheduler
// (Task 8) so manual sends work regardless of the daily toggle; the actual
// WhatsApp send is still gated by WHATSAPP_ENABLED inside sendWhatsAppTemplate.
import { fetchAxisAlerts } from "./gmail-client";
import { parseAlertEmail } from "./alert-parser";
import {
  isAlreadyStored,
  upsertAlert,
  getRecentDebits,
  countRecentUnparsed,
} from "./alert-store";
import { buildDigestParams } from "./digest-message";
import { sendWhatsAppTemplate } from "@/lib/notifications/whatsapp-service";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DigestSummary {
  fetched: number;
  parsed: number;
  ignored: number;
  unparsed: number;
  debitCount: number;
  total: number;
  sent: boolean;
}

export interface DigestResult {
  summary: DigestSummary;
  params: string[];
  messageText: string;
  sent: boolean;
}

function renderPreview(params: string[]): string {
  const [date, total, count, items] = params;
  return `📊 Expense digest — ${date}\n\nSpent ₹${total} across ${count} txn(s).\n\n${items}`;
}

async function resolvePhone(userId: string): Promise<string | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { phone: true },
  });
  return profile?.phone ?? process.env.EXPENSE_DIGEST_PHONE ?? null;
}

export async function buildDigest(): Promise<DigestResult> {
  const userId = process.env.EXPENSE_DIGEST_USER_ID;
  if (!userId) throw new Error("EXPENSE_DIGEST_USER_ID is not set");
  const sender = process.env.AXIS_ALERT_SENDER ?? "alerts@axis.bank.in";
  const since = new Date(Date.now() - DAY_MS);

  const emails = await fetchAxisAlerts({
    user: process.env.GMAIL_USER ?? "",
    password: process.env.GMAIL_APP_PASSWORD ?? "",
    sender,
    since,
  });

  let parsed = 0;
  let ignored = 0;
  let unparsed = 0;
  for (const email of emails) {
    if (await isAlreadyStored(userId, email.messageId)) continue;
    const outcome = await parseAlertEmail(email);
    await upsertAlert({
      userId,
      messageId: email.messageId,
      emailDate: email.date,
      subject: email.subject,
      rawSnippet: email.text.slice(0, 500),
      outcome,
    });
    if (outcome.status === "parsed") parsed++;
    else if (outcome.status === "ignored") ignored++;
    else unparsed++;
  }

  const debits = await getRecentDebits(userId, since);
  const unparsedCount = await countRecentUnparsed(userId, since);
  const { params, total, count } = buildDigestParams({
    expenses: debits,
    date: new Date(),
    unparsedCount,
  });

  return {
    summary: { fetched: emails.length, parsed, ignored, unparsed, debitCount: count, total, sent: false },
    params,
    messageText: renderPreview(params),
    sent: false,
  };
}

export async function runDailyExpenseDigest(): Promise<DigestResult> {
  const result = await buildDigest();
  const userId = process.env.EXPENSE_DIGEST_USER_ID!;
  const phone = await resolvePhone(userId);
  if (!phone) {
    console.warn("[ExpenseDigest] No phone configured; digest not sent");
    return result;
  }
  await sendWhatsAppTemplate(
    phone,
    process.env.WHATSAPP_DIGEST_TEMPLATE_NAME ?? "daily_expense_digest",
    process.env.WHATSAPP_DIGEST_TEMPLATE_LANG ?? "en",
    result.params,
  );
  return { ...result, sent: true, summary: { ...result.summary, sent: true } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bank-alerts/digest-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add env vars to `.env.example`**

Append to `.env.example`:

```env

# Daily expense digest (Axis email → WhatsApp)
EXPENSE_DIGEST_ENABLED=false              # gates the 22:00 IST cron
EXPENSE_DIGEST_USER_ID=                   # app user id (= email) that owns BankAlert rows
EXPENSE_DIGEST_PHONE=                     # fallback WhatsApp number if UserProfile.phone unset
GMAIL_USER=                               # Gmail address that receives Axis alerts
GMAIL_APP_PASSWORD=                       # 16-char Google app password (requires 2FA)
AXIS_ALERT_SENDER=alerts@axis.bank.in     # confirm exact Axis sender from inbox
WHATSAPP_DIGEST_TEMPLATE_NAME=daily_expense_digest
WHATSAPP_DIGEST_TEMPLATE_LANG=en
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/bank-alerts/digest-service.ts src/lib/bank-alerts/digest-service.test.ts .env.example
git commit -m "feat(bank-alerts): digest orchestrator (buildDigest + runDailyExpenseDigest)"
```

---

### Task 8: Register the 22:00 IST cron

**Files:**
- Modify: `src/lib/notifications/scheduler.ts`
- Test: `src/lib/notifications/scheduler.test.ts`

**Interfaces:**
- Consumes: `runDailyExpenseDigest` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/scheduler.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const schedule = vi.fn();
vi.mock("node-cron", () => ({ default: { schedule } }));
vi.mock("./fd-reminder-service", () => ({ sendFdReminders: vi.fn() }));
vi.mock("@/lib/bank-alerts/digest-service", () => ({ runDailyExpenseDigest: vi.fn() }));

import { startScheduler } from "./scheduler";

describe("startScheduler", () => {
  it("registers the daily expense digest at 22:00 IST", () => {
    startScheduler();
    expect(schedule).toHaveBeenCalledWith(
      "0 22 * * *",
      expect.any(Function),
      { timezone: "Asia/Kolkata" },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications/scheduler.test.ts`
Expected: FAIL — no `"0 22 * * *"` schedule registered.

- [ ] **Step 3: Write the implementation**

Modify `src/lib/notifications/scheduler.ts` — add the import and a second `cron.schedule` block inside `startScheduler`, before the final `console.log`:

```ts
import cron from "node-cron";
import { sendFdReminders } from "./fd-reminder-service";
import { runDailyExpenseDigest } from "@/lib/bank-alerts/digest-service";

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  cron.schedule("0 9 * * *", async () => {
    console.log("[Scheduler] Running FD maturity reminders");
    try {
      await sendFdReminders();
      console.log("[Scheduler] FD reminders completed");
    } catch (err) {
      console.error("[Scheduler] FD reminders failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  cron.schedule("0 22 * * *", async () => {
    if (process.env.EXPENSE_DIGEST_ENABLED !== "true") return;
    console.log("[Scheduler] Running daily expense digest");
    try {
      await runDailyExpenseDigest();
      console.log("[Scheduler] Expense digest completed");
    } catch (err) {
      console.error("[Scheduler] Expense digest failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  console.log("[Scheduler] FD reminder (09:00) + expense digest (22:00) crons registered, IST");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications/scheduler.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/scheduler.ts src/lib/notifications/scheduler.test.ts
git commit -m "feat(bank-alerts): register 22:00 IST expense-digest cron"
```

---

### Task 9: Owner-only trigger route (`dryRun` preview vs real send)

**Files:**
- Create: `src/app/api/bank-alerts/digest/run/route.ts`
- Test: `src/app/api/bank-alerts/digest/run/route.test.ts`

**Interfaces:**
- Consumes: `getServerSession`, `authOptions`, `isSupAdmin`, `buildDigest`, `runDailyExpenseDigest`.
- Produces: `POST` handler. Body `{ dryRun?: boolean }` (defaults to `true`). Returns `DigestResult` JSON or `{ error }`.

> Before writing, skim `node_modules/next/dist/docs/` for the route-handler guide (per `AGENTS.md`), and mirror `src/app/api/user/profile/route.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/bank-alerts/digest/run/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/bank-alerts/digest-service", () => ({
  buildDigest: vi.fn(),
  runDailyExpenseDigest: vi.fn(),
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";
import { buildDigest, runDailyExpenseDigest } from "@/lib/bank-alerts/digest-service";
import { NextRequest } from "next/server";

function makeReq(body?: object) {
  return new NextRequest("http://localhost/api/bank-alerts/digest/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const RESULT = { summary: {}, params: ["a"], messageText: "x", sent: false };

describe("POST /api/bank-alerts/digest/run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-owner callers with 403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "someone@else.com" } } as never);
    const res = await POST(makeReq({ dryRun: true }));
    expect(res.status).toBe(403);
    expect(buildDigest).not.toHaveBeenCalled();
  });

  it("dryRun:true previews via buildDigest, no send", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "sushant.gawali@gmail.com" } } as never);
    vi.mocked(buildDigest).mockResolvedValue(RESULT as never);
    const res = await POST(makeReq({ dryRun: true }));
    expect(res.status).toBe(200);
    expect(buildDigest).toHaveBeenCalledOnce();
    expect(runDailyExpenseDigest).not.toHaveBeenCalled();
  });

  it("dryRun:false runs the real send", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "sushant.gawali@gmail.com" } } as never);
    vi.mocked(runDailyExpenseDigest).mockResolvedValue({ ...RESULT, sent: true } as never);
    const res = await POST(makeReq({ dryRun: false }));
    expect(res.status).toBe(200);
    expect(runDailyExpenseDigest).toHaveBeenCalledOnce();
    expect(buildDigest).not.toHaveBeenCalled();
  });

  it("returns 500 when the digest throws", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "sushant.gawali@gmail.com" } } as never);
    vi.mocked(buildDigest).mockRejectedValue(new Error("IMAP down"));
    const res = await POST(makeReq({ dryRun: true }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "IMAP down" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/bank-alerts/digest/run/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/bank-alerts/digest/run/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin } from "@/lib/session";
import { buildDigest, runDailyExpenseDigest } from "@/lib/bank-alerts/digest-service";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!isSupAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let dryRun = true;
  try {
    const body = await req.json();
    dryRun = body?.dryRun !== false; // default to preview unless explicitly false
  } catch {
    // no/invalid body → default dry run
  }

  try {
    const result = dryRun ? await buildDigest() : await runDailyExpenseDigest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Digest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/bank-alerts/digest/run/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bank-alerts/digest/run/route.ts src/app/api/bank-alerts/digest/run/route.test.ts
git commit -m "feat(bank-alerts): owner-only digest trigger route (dryRun preview/send)"
```

---

### Task 10: Settings UI — preview/send test panel

**Files:**
- Create: `src/app/dashboard/settings/expense-digest-test-panel.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

**Interfaces:**
- Consumes: `POST /api/bank-alerts/digest/run` (Task 9), `isSA` (already computed in `page.tsx`).

> This project has no component-test infrastructure (Vitest runs in `node`, no jsdom/@testing-library). The panel is a thin presentational shell over the already-tested route, so it is verified by type-check + a manual browser check rather than a unit test.

- [ ] **Step 1: Create the client panel**

Create `src/app/dashboard/settings/expense-digest-test-panel.tsx`:

```tsx
"use client";

import { useState } from "react";

interface DigestResult {
  summary: {
    fetched: number;
    parsed: number;
    ignored: number;
    unparsed: number;
    debitCount: number;
    total: number;
    sent: boolean;
  };
  params: string[];
  messageText: string;
  sent: boolean;
}

export function ExpenseDigestTestPanel() {
  const [loading, setLoading] = useState<null | "preview" | "send">(null);
  const [result, setResult] = useState<DigestResult | null>(null);
  const [error, setError] = useState("");

  async function run(dryRun: boolean) {
    setError("");
    setResult(null);
    setLoading(dryRun ? "preview" : "send");
    try {
      const res = await fetch("/api/bank-alerts/digest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      setResult(data as DigestResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button onClick={() => run(true)} disabled={loading !== null} className="ab-btn ab-btn-secondary">
          {loading === "preview" ? "Previewing…" : "Preview"}
        </button>
        <button onClick={() => run(false)} disabled={loading !== null} className="ab-btn ab-btn-accent">
          {loading === "send" ? "Sending…" : "Send test now"}
        </button>
      </div>

      {error && (
        <p className="text-[13px] text-[var(--accent-error)] bg-[var(--chip-error-bg)] rounded-lg px-3 py-2.5 font-medium">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <pre className="text-[13px] whitespace-pre-wrap rounded-lg p-3 bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border)]">
            {result.messageText}
          </pre>
          <p className="text-[12px] text-[var(--text-secondary)]">
            Fetched {result.summary.fetched} · parsed {result.summary.parsed} · ignored{" "}
            {result.summary.ignored} · unparsed {result.summary.unparsed} · debits{" "}
            {result.summary.debitCount} · {result.sent ? "sent ✅" : "preview only (not sent)"}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the settings page**

In `src/app/dashboard/settings/page.tsx`, add the import near the other settings-form imports:

```tsx
import { ExpenseDigestTestPanel } from "./expense-digest-test-panel";
```

Then, immediately after the closing `</section>` of the existing **Notifications** card (and before the final closing `</div>`), add:

```tsx
      {isSA && (
        <section className="ab-card p-6 space-y-5">
          <div>
            <p className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight">Daily Expense Digest</p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-relaxed">
              Preview or send a test of the 22:00 IST Axis expense digest. Preview reads &amp; parses
              the last 24h of alerts without sending; Send test now delivers the real WhatsApp.
            </p>
          </div>
          <ExpenseDigestTestPanel />
        </section>
      )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Run the dev server (`npm run dev`), sign in as the owner (`sushant.gawali@gmail.com`), open `/dashboard/settings`, and confirm the **Daily Expense Digest** card renders with **Preview** and **Send test now** buttons. Click **Preview** and confirm a rendered digest + summary line appears (or a clear error if Gmail env vars aren't set yet). Note: a real send requires `WHATSAPP_ENABLED=true` and an approved template.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/expense-digest-test-panel.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat(bank-alerts): owner-only expense digest test panel in settings"
```

---

## Final verification

- [ ] Run the whole suite: `npx vitest run` — expected: all green, including the new files.
- [ ] Type-check: `npx tsc --noEmit` — expected: no errors.
- [ ] Confirm the external-setup checklist in the spec (§ External setup) is handed to the user: Axis sender, Gmail app password, Meta app + approved `daily_expense_digest` template, long-lived token, then set env vars and `EXPENSE_DIGEST_ENABLED=true`.

---

## Self-Review

**Spec coverage:**
- BankAlert table → Task 1 ✓
- IMAP Gmail fetch (read-only, app password) → Task 5 ✓
- Pre-filter + Claude Haiku extraction → Task 4 ✓
- Persistence/dedup/window query → Task 6 ✓
- Digest message + no-newline template params → Task 2 ✓
- WhatsApp template send → Task 3 ✓
- Orchestrator buildDigest/runDailyExpenseDigest → Task 7 ✓
- 22:00 IST cron + EXPENSE_DIGEST_ENABLED gate → Task 8 ✓
- Owner-only trigger route w/ dryRun → Task 9 ✓
- Settings preview/send panel → Task 10 ✓
- Env vars + .env.example → Task 7 ✓
- Error handling (parse→unparsed, IMAP abort, send caught by scheduler) → Tasks 4/7/8 ✓

**Type consistency:** `RawEmail` (5) consumed by 7 (structurally compatible with `parseAlertEmail`'s `{ subject, text }` param); `ParseOutcome`/`ParsedAlert` (4) consumed by 6/7; `DigestExpense`/`buildDigestParams` (2) consumed by 7; `RecentDebit` shape matches `DigestExpense` (amount/merchant/txnTime) consumed by 7; `sendWhatsAppTemplate` (3) signature matches the call in 7; `DigestResult` (7) consumed by 9/10. Compound unique `userId_emailMessageId` consistent across 1/6.

**Sequencing:** every task is independently buildable in number order — `alert-parser` (4) takes a structural `{ subject, text }` and no longer imports from `gmail-client` (5), so there is no cross-task type-ordering hazard.
