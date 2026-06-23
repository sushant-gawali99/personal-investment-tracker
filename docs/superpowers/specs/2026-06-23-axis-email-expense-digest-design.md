# Axis Email → Daily Expense Digest (WhatsApp) — Design Spec

**Date:** 2026-06-23  
**Status:** Draft — pending review

---

## Overview

A scheduled, server-side module that every night at **22:00 IST** reads the last
24 hours of bank-alert emails from Axis Bank (`alerts@axis.bank.in`), extracts each
transaction with Claude, persists them to a dedicated `BankAlert` table, and pushes a
summary of the day's **expenses (debits)** to the user's WhatsApp via an approved
Meta Cloud API template.

This is a **single-user, personal** integration: one mailbox, one phone number, both
configured via server environment variables. It reuses the existing in-process
`node-cron` scheduler and the existing WhatsApp Cloud API service.

### Goals

- Daily, hands-off WhatsApp digest of the previous 24h of spend.
- Robust parsing across Axis alert formats (debit card, UPI, ATM, NEFT/IMPS, auto-debit/EMI).
- Idempotent: re-running the job never double-stores or crashes on a single bad email.

### Non-goals (this version)

- No per-user / multi-tenant configuration UI. (There **is** a single **owner-only test
  panel** on the settings page — see "Manual trigger & UI test panel" — but no per-user
  setup screens.)
- No integration into the existing statement-import `Transaction` ledger (kept separate
  to avoid duplicate/conflicting rows — see "Relationship to existing modules").
- No continuous polling — a single fetch at 22:00 IST is sufficient.

---

## Architecture

```
instrumentation.ts
  └── src/lib/notifications/scheduler.ts        (node-cron; existing 09:00 FD job + NEW 22:00 digest job, IST)
        └── src/lib/bank-alerts/digest-service.ts        runDailyExpenseDigest()
              ├── src/lib/bank-alerts/gmail-client.ts    (imapflow — fetch Axis mail, last 24h)
              ├── src/lib/bank-alerts/alert-parser.ts    (keyword pre-filter → Claude Haiku structured extract)
              ├── src/lib/bank-alerts/alert-store.ts     (prisma — upsert BankAlert, dedup, query window)
              ├── src/lib/bank-alerts/digest-message.ts  (pure — build WhatsApp template params)
              └── src/lib/notifications/whatsapp-service.ts  (Meta Cloud API — NEW sendWhatsAppTemplate())

src/app/api/bank-alerts/digest/run/route.ts    (owner-only trigger; ?dryRun=true → preview, no send)
src/app/dashboard/settings/
  ├── page.tsx                                   (NEW "Daily Expense Digest" card, owner-only)
  └── expense-digest-test-panel.tsx              (client component → "Preview" + "Send test now" buttons)
```

### Startup

The scheduler is already registered in `instrumentation.ts` under the
`NEXT_RUNTIME === "nodejs"` guard, with a module-level boolean preventing duplicate
registrations on dev hot-reload. We **add one cron entry** to the existing
`startScheduler()` — no changes to `instrumentation.ts`.

### Module placement

Ingestion logic lives in a **new `src/lib/bank-alerts/` module** (distinct concern:
email → structured alert). Delivery + scheduling **reuse the existing
`src/lib/notifications/` module**. Each unit has one job and is independently testable.

---

## Core flow — `runDailyExpenseDigest()`

Runs once when the 22:00 IST cron fires:

1. **Gate:** if `EXPENSE_DIGEST_ENABLED !== "true"`, log and return (mirrors `WHATSAPP_ENABLED`).
2. **Fetch:** `gmail-client` opens IMAP, searches the inbox for messages from
   `AXIS_ALERT_SENDER` with `INTERNALDATE` within the last 24h → `RawEmail[]`.
3. **Ingest each email:**
   - Skip if its `Message-ID` is already stored for this user (dedup).
   - Run the keyword **pre-filter**; non-transaction mail (OTP, promos, statement-ready
     notices) is recorded as `parseStatus:"ignored"` and skipped.
   - Otherwise **Claude-extract** the structured fields and **upsert** a `BankAlert`.
   - Extraction failure → store with `parseStatus:"unparsed"` + `rawSnippet`; never throw.
4. **Aggregate:** query `BankAlert` rows for this user with `emailDate` in the last 24h
   and `direction = "debit"`.
5. **Build:** `digest-message` produces the WhatsApp template parameters (§ Digest message).
6. **Send:** `sendWhatsAppTemplate(...)` delivers it to the configured phone.
7. **Log:** one-line summary — `{ fetched, parsed, ignored, unparsed, debitCount, total, sent }`.

The window uses `emailDate` (always present, ≈ transaction time, since Axis alerts arrive
within seconds). `txnTime` parsed from the body is **display-only**.

---

## Gmail ingestion — `gmail-client.ts`

- **Library:** `imapflow` (new dependency) — modern promise-based IMAP client.
- **Auth:** Gmail address + **app password** (`GMAIL_USER`, `GMAIL_APP_PASSWORD`).
  App passwords require 2FA on the Google account. Connection is TLS to
  `imap.gmail.com:993`.
- **Query:** `SINCE`/`INTERNALDATE` filter for the last 24h, `FROM` = `AXIS_ALERT_SENDER`.
  Fetch envelope (`Message-ID`, `From`, `Subject`, `Date`) + the text body.
- **Output:** `RawEmail { messageId, date, subject, text }[]`. HTML-only bodies are
  converted to plain text (strip tags) before parsing.
- The client opens the mailbox **read-only** (`mailbox.open(..., { readOnly: true })`) —
  the module never marks mail read, deletes, or modifies the inbox.

> **Sender address:** the user wrote `alerts@axis.bank.in`; the real Axis sender is often
> `alerts@axisbank.com`. The address is an env var (`AXIS_ALERT_SENDER`) to be confirmed
> from the actual inbox before enabling.

---

## Alert parsing — `alert-parser.ts`

Two stages, to keep token spend near zero and avoid parsing junk:

1. **Pre-filter (free, deterministic):** keep only emails whose subject/body match
   transaction-alert signals (e.g. contains a currency amount **and** one of
   `debited|spent|credited|withdrawn|purchase|transaction|debit|credit`). Everything else →
   `ignored`.
2. **Claude extraction:** send the trimmed plain-text body to **Claude Haiku
   (`claude-haiku-4-5-20251001`)** via the existing `src/lib/anthropic.ts` client, using a
   tool/JSON schema to force structured output:

   ```ts
   interface ParsedAlert {
     direction: "debit" | "credit";
     amount: number;                 // INR, positive
     merchant: string | null;        // payee / counterparty / location
     txnTime: string | null;         // ISO 8601 if present in the body
     accountLast4: string | null;
     availableBalance: number | null;
     channel: "card" | "upi" | "atm" | "neft" | "imps" | "emi" | "netbanking" | "other";
   }
   ```

   The prompt instructs: return `null`/abort if the email is not a real transaction
   (defensive double-check beyond the pre-filter).

- **Merchant cleanup (reuse):** parsed `merchant` strings are optionally normalized via
  the existing `prettifyDescription`/`canonicalMerchant` canon in
  `src/lib/bank-accounts/pretty-description.ts` for consistent names (e.g. "Swiggy",
  "Amazon"). This keeps digest labels consistent with the transactions UI.
- Volume is a handful–few dozen emails/day, so Haiku cost is negligible.

---

## Data model — `BankAlert`

```prisma
model BankAlert {
  id               String   @id @default(cuid())
  userId           String
  emailMessageId   String   // IMAP Message-ID header — dedup key
  emailDate        DateTime // when the alert email arrived; used for the 24h window
  txnTime          DateTime? // parsed transaction time from the body (display only)
  direction        String   // "debit" | "credit"
  amount           Float
  merchant         String?
  accountLast4     String?
  availableBalance Float?
  channel          String?  // card | upi | atm | neft | imps | emi | netbanking | other
  rawSubject       String?
  rawSnippet       String?  // trimmed body excerpt for audit/debug
  parseStatus      String   @default("parsed") // parsed | unparsed | ignored
  createdAt        DateTime @default(now())

  @@unique([userId, emailMessageId])
  @@index([userId, emailDate])
}
```

- Dedup enforced by `@@unique([userId, emailMessageId])` — re-running the job is safe.
- `parseStatus` keeps `ignored`/`unparsed` rows so the inbox isn't re-fetched/re-evaluated
  and so unparseable alerts are auditable.
- Migration applied via the project's Prisma + libsql (Turso) flow.

---

## Digest message & WhatsApp template

### The newline constraint

Meta forbids **newlines, tabs, or 4+ consecutive spaces inside template parameter
*values*** — but the template's **static authored text may contain newlines**. So layout
lives in the static template; the dynamic expense list goes into a **single-line**
parameter using ` • ` separators.

### Template `daily_expense_digest` (category: Utility, language: `en`)

Authored body (created once in Meta Business Manager):

```
📊 *Expense digest — {{1}}*

Spent ₹{{2}} across {{3}} txn(s).

{{4}}
```

| Param | Meaning | Example (single line) |
|---|---|---|
| `{{1}}` | digest date — the run date (today, IST); the window covers the prior 24h up to it | `23 Jun 2026` |
| `{{2}}` | total debits, grouped | `12,480` |
| `{{3}}` | debit count | `7` |
| `{{4}}` | flattened item list | `₹540 Swiggy (8:14pm) • ₹1,200 Amazon (6:02pm) • ₹99 UPI/jiopay (3:30pm)` |

### `digest-message.ts` (pure function)

- Sorts debits by amount desc; formats each as `₹<amt> <merchant> (<txnTime|—>)`.
- Joins with ` • `. If the joined `{{4}}` would exceed a safe cap (~900 chars, under the
  1024 body limit), truncates to the top N and appends `…+<k> more (₹<sum>)`.
- Guarantees no `\n`, `\t`, or 4+ spaces in any parameter (asserted in tests).
- **No-expense case:** if zero debits in 24h, `{{2}}=0`, `{{3}}=0`,
  `{{4}}=No expenses today ✅` (still a single line). A zero-expense digest is still
  sent — it doubles as a daily heartbeat confirming the pipeline ran.
- If any alerts were `unparsed`, appends ` (⚠️ N alert(s) not parsed)` to `{{4}}`.

---

## WhatsApp delivery — extend `whatsapp-service.ts`

The existing file only sends `type:"text"`. Add a generic:

```ts
export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
): Promise<void>
```

- Same env gating as today: returns early unless `WHATSAPP_ENABLED === "true"`.
- POSTs `type:"template"` with a `body` component of positional parameters to
  `https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`.
- Reuses `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`.
- Throws on non-OK response; the scheduler wrapper catches + logs (no crash).

### Destination phone

Reuse `UserProfile.phone` for `EXPENSE_DIGEST_USER_ID` (consistent with FD reminders),
falling back to `EXPENSE_DIGEST_PHONE` if the profile has none.

---

## Manual trigger & UI test panel

So the digest can be tested on demand (and parsing validated *before* the Meta template is
approved), the orchestrator is split so the build is reusable:

```ts
// digest-service.ts
buildDigest(): Promise<DigestResult>          // fetch → parse → store → aggregate → render. NO send.
runDailyExpenseDigest(): Promise<DigestResult> // buildDigest() then sendWhatsAppTemplate()
```

`DigestResult` = `{ summary, params: [p1,p2,p3,p4], debits: ParsedAlert[], unparsedCount, sent }`.

### Route — `app/api/bank-alerts/digest/run/route.ts`

`POST`, **owner-only** — gated by the existing super-admin check (`isSupAdmin` /
`src/lib/session.ts`), the same gate used by the impersonation selector. Body `{ dryRun?: boolean }`:

- `dryRun: true` → `buildDigest()` only; returns the rendered `params` + `debits` +
  `unparsedCount`, **nothing sent** (`sent:false`).
- `dryRun: false` → `runDailyExpenseDigest()`; full pipeline incl. WhatsApp (`sent:true`).

Returns the `DigestResult` JSON either way. Built per the local Next.js route-handler docs
(see AGENTS.md). Note both modes run fetch+parse+**store** (upsert is idempotent), so a
preview also populates `BankAlert` and a later real run dedups cleanly.

### UI — `expense-digest-test-panel.tsx`

A client component in a new **"Daily Expense Digest"** `ab-card` on `/dashboard/settings`,
rendered **only when `isSA`** (owner), mirroring `ImpersonationSelector`. Two buttons:

- **Preview** → `POST { dryRun:true }`; renders the exact WhatsApp text (assembled from the
  returned `params`) plus the parsed expense list and any unparsed count. No phone needed.
- **Send test now** → `POST { dryRun:false }`; sends the real WhatsApp and shows the summary.
  Disabled with a hint if `WHATSAPP_ENABLED !== "true"` (surfaced via the route response).

Loading/disabled states and success/error messaging reuse the existing form styling
(`ab-btn ab-btn-accent`, `ab-input`, the `--chip-*` message boxes) from
`notification-settings-form.tsx`.

---

## Environment variables

```env
# Daily expense digest (Axis email → WhatsApp)
EXPENSE_DIGEST_ENABLED=false              # feature flag, like WHATSAPP_ENABLED
EXPENSE_DIGEST_USER_ID=                   # app user id that owns the BankAlert rows
EXPENSE_DIGEST_PHONE=                     # fallback WhatsApp number if UserProfile.phone unset

# Gmail (IMAP, app password)
GMAIL_USER=                               # e.g. you@gmail.com
GMAIL_APP_PASSWORD=                       # 16-char Google app password (requires 2FA)
AXIS_ALERT_SENDER=alerts@axis.bank.in     # confirm exact Axis sender from inbox

# WhatsApp template (reuses existing WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)
WHATSAPP_DIGEST_TEMPLATE_NAME=daily_expense_digest
WHATSAPP_DIGEST_TEMPLATE_LANG=en
```

Added to `.env.example`. Existing `WHATSAPP_ENABLED`, `WHATSAPP_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `ANTHROPIC_API_KEY` are reused.

---

## Error handling

- **IMAP connection/auth failure** → log + abort the run cleanly (no partial/empty digest sent).
- **Per-email parse failure** → store `parseStatus:"unparsed"` + `rawSnippet`, exclude from
  totals, continue. Digest notes the count.
- **WhatsApp send failure** → thrown, caught + logged by the scheduler wrapper (mirrors FD
  reminders); does not crash the process.
- **Dedup** → `Message-ID` uniqueness makes re-runs (manual + cron same night) safe for
  storage. The send itself is per-invocation; the manual trigger is intended for testing.
- All errors `console.error` with context; the cron callback wraps the call in try/catch.

---

## Testing

Vitest, colocated `*.test.ts` (mirroring `email-service.test.ts`, `whatsapp-service.test.ts`).
Built **test-first (TDD)**:

- `digest-message.test.ts` — formatting, sort, truncation, **no-newline/tab guarantee**,
  no-expense case, unparsed-count note. (Pure, highest-value.)
- `alert-store.test.ts` — dedup on `Message-ID`, 24h-window + debit-only query.
- `alert-parser.test.ts` — pre-filter accept/reject; extraction mapping against **saved
  fixture emails** for each Axis format (card/UPI/ATM/NEFT/IMPS/EMI), with the Claude call mocked.
- `gmail-client.test.ts` — date-window + sender query construction, with imapflow mocked.
- Window/IST date math — unit-tested (reuse/adapt the `getISTDateRange` pattern from
  `fd-reminder-service.ts`).
- `digest/run` route — `dryRun:true` returns rendered params + debit list and **does not**
  call the WhatsApp sender; `dryRun:false` does; non-owner requests are rejected (auth gate).

---

## Relationship to existing modules

- **Statement-import `Transaction` ledger is untouched.** Email alerts are real-time but
  incomplete (no running balance, occasionally truncated merchant) and would later collide
  with the same expense from a monthly statement import. Keeping `BankAlert` separate avoids
  duplicate/conflicting rows. A future "promote alert → Transaction" reconciliation is left
  open but out of scope.
- Reuses: `notifications/scheduler.ts`, `notifications/whatsapp-service.ts`,
  `lib/anthropic.ts`, `lib/prisma.ts`, `bank-accounts/pretty-description.ts` (merchant canon),
  and the FD reminders' IST date-range approach.

---

## External setup (one-time, by the user)

1. **Confirm the Axis sender address** from the inbox; set `AXIS_ALERT_SENDER`.
2. Enable 2FA on the Google account and generate a **Gmail app password**.
3. Create a free **Meta app + WhatsApp** product (test sender number is fine — no business
   verification needed for sending to your own number; see notes below).
4. Create the **`daily_expense_digest` Utility template** (4 body params) and get it approved.
5. Generate a **long-lived System User token** (the default token expires in ~24h, unusable
   for a daily cron).
6. Set the env vars and flip `EXPENSE_DIGEST_ENABLED=true`.

> **Meta business verification is not required** for this use case: the test sender number
> + up to 5 allow-listed recipients (your own number) + an approved Utility template works
> without verifying a business. Verification only matters for using your own sender number
> or higher messaging tiers.

---

## Files to create / modify

| Path | Action |
|---|---|
| `src/lib/bank-alerts/gmail-client.ts` | Create — imapflow fetch, read-only, last-24h Axis mail |
| `src/lib/bank-alerts/alert-parser.ts` | Create — pre-filter + Claude Haiku structured extract |
| `src/lib/bank-alerts/alert-store.ts` | Create — upsert/dedup + 24h debit query |
| `src/lib/bank-alerts/digest-message.ts` | Create — pure template-param builder |
| `src/lib/bank-alerts/digest-service.ts` | Create — `buildDigest()` + `runDailyExpenseDigest()` orchestrator |
| `src/lib/notifications/whatsapp-service.ts` | Modify — add `sendWhatsAppTemplate()` |
| `src/lib/notifications/scheduler.ts` | Modify — add `0 22 * * *` IST cron entry |
| `src/app/api/bank-alerts/digest/run/route.ts` | Create — owner-only trigger; `dryRun` preview vs real send |
| `src/app/dashboard/settings/expense-digest-test-panel.tsx` | Create — Preview + Send-test client panel |
| `src/app/dashboard/settings/page.tsx` | Modify — render the digest panel when `isSA` (owner) |
| `prisma/schema.prisma` | Modify — add `BankAlert` model + migration |
| `.env.example` | Modify — add new env vars |
| `package.json` | Modify — add `imapflow` dependency |
| `src/lib/bank-alerts/*.test.ts` | Create — unit tests (TDD) |

---

## Out of scope

- Per-user UI / multi-tenant config.
- Browsable digest history / past-digest UI.
- Promoting alerts into the `Transaction` ledger / reconciliation.
- Continuous polling or near-real-time alerts.
- Banks other than Axis.
- SMS/push channels.
