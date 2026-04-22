# Bank Accounts Module — Design

**Date:** 2026-04-22
**Status:** Draft for review
**Author:** brainstorming session

## Overview

A new top-level module under `/dashboard/bank-accounts` that lets the user upload PDF bank statements, extracts transactions using Claude, categorizes them, and provides analysis views (category breakdown, month-over-month trend, top merchants, daily spending heatmap, income vs expense) plus a filterable transaction list. Supports multiple bank accounts, tracks both credits and debits, auto-detects inter-account transfers, and learns merchant → category rules over time to reduce Claude API cost.

## Goals

- Upload a PDF bank statement; get a clean, categorized transaction list.
- View spending by category for any selected month.
- Filter/search transactions by account, category, date range, direction, amount, or description.
- Track income and expenses side-by-side, excluding inter-account transfers from spending totals.
- Reduce Claude API cost over time via a user-editable merchant rule table.

## Non-Goals (MVP)

- Budget tracking per category.
- Account balance progression / reconciliation against statement closing balance.
- CSV or Excel import.
- Bank API auto-sync.
- Export to CSV or custom reports.

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| Q1 | Support **any bank statement** — use Claude for parsing, build learning layer to cut cost. |
| Q2 | **Preset + user-defined custom** categories. |
| Q3 | Track **credits and debits equally** (income and expense views both). |
| Q4 | **Multiple bank accounts**, first-class `BankAccount` entity. |
| Q5 | Dedup by `(account_id, bank_ref)` when present, else `(account_id, date, amount, normalized_description)`. Auto-skip duplicates, show summary. |
| Q6 | Categorization = **rules-first, Claude-fallback**. User corrections can become rules. |
| Q7 | Inter-account transfers **auto-detected and auto-excluded** from spending totals. |
| Q8 | MVP views: **A, B, C, D, E** (category breakdown, month trend, top merchants, daily heatmap, income vs expense). |
| Approach | **Approach 1 (text-first) + vision fallback** for scanned PDFs. |

## Architecture

### Extraction pipeline

```
Upload PDF
  → pdfjs-dist text extraction
  → text < threshold? → vision fallback (PDF as document)
  → Claude call (cached system prompt: schema + category list + bank hint)
  → staged StatementImport (preview)
  → dedup check
  → user reviews/edits in preview table
  → commit: apply rules → insert transactions → transfer detection
```

Concurrency: up to 5 files at once, cancellable (matches existing FD bulk-upload pattern).

### Categorization order (at import commit)

1. **User merchant rule match** (longest pattern wins) → `categorySource = 'rule'`.
2. **Claude's suggested category** (validated against the allowed list) → `categorySource = 'claude'`.
3. **No match** → `categoryId = null`, flagged for review.

Post-commit: transfer detection may overwrite `categoryId` to the `Transfer` system category where both sides of a transfer are found.

### Transfer detection

Runs after each successful import, across all of the user's saved transactions:

- For each debit on account A, look for credits on account B (both same user) where:
  - Exact amount match (compared as integer paise to avoid float rounding)
  - Date within ±1 day
  - Neither side already in a `transferGroupId`
  - Neither side has `categorySource = 'user'`
- On match: assign both a shared `transferGroupId`, set `categoryId` to system `Transfer`, `categorySource = 'transfer-detect'`.
- Tie-break when multiple candidates: closest date, then description containing the other account's label / last-4.

### Spending aggregation rule

All "spending" aggregations:
`direction = 'debit' AND (categoryId IS NULL OR category.kind != 'transfer')`

All "income" aggregations:
`direction = 'credit' AND (categoryId IS NULL OR category.kind != 'transfer')`

Uncategorized transactions (null `categoryId`) are included in their direction's totals and appear under an "Uncategorized" bucket in category breakdown views. Only the `transfer` kind is excluded from spending/income rollups. Transfers remain filterable and visible in the transaction list.

## Data model

Five new Prisma tables. All include `userId` (same pattern as existing models).

### `BankAccount`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String | Owner |
| `label` | String | e.g. "HDFC Savings" |
| `bankName` | String | |
| `accountNumberLast4` | String? | For display + transfer-detection heuristics |
| `accountType` | Enum | `savings` \| `current` \| `credit` |
| `disabled` | Boolean | Soft-delete |
| `createdAt`, `updatedAt` | DateTime | |

### `TransactionCategory`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String? | `null` = system preset, visible to all users |
| `name` | String | |
| `kind` | Enum | `expense` \| `income` \| `transfer` |
| `icon` | String? | Lucide icon name |
| `color` | String? | Hex or CSS var |
| `sortOrder` | Int | |
| `disabled` | Boolean | Soft-delete preserves historical labels |
| `createdAt`, `updatedAt` | DateTime | |

Seeded presets (visible to all users, `userId = null`):
Grocery, Food & Dining, Petrol, Medical, Utilities, Rent, Travel, Shopping, Entertainment, Salary, Interest, Refund, Transfer.

### `Transaction`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String | |
| `accountId` | String | FK → `BankAccount` |
| `txnDate` | String (YYYY-MM-DD) | Stored as string to avoid TZ drift |
| `valueDate` | String? (YYYY-MM-DD) | When different from txnDate |
| `description` | String | Original bank text |
| `normalizedDescription` | String | Uppercase, trimmed, refs stripped |
| `amount` | Decimal | Always positive |
| `direction` | Enum | `debit` \| `credit` |
| `runningBalance` | Decimal? | When statement provides it |
| `bankRef` | String? | UPI ref / cheque / txn id from statement |
| `categoryId` | String? | FK → `TransactionCategory` |
| `categorySource` | Enum | `claude` \| `rule` \| `user` \| `transfer-detect` |
| `transferGroupId` | String? | Shared UUID between two sides of an inter-account transfer |
| `notes` | String? | User-editable |
| `importId` | String | FK → `StatementImport` |
| `createdAt`, `updatedAt` | DateTime | |

**Dedup uniqueness:**
- Unique index on `(userId, accountId, bankRef)` (filtered: where `bankRef` is not null).
- Unique index on `(userId, accountId, txnDate, amount, normalizedDescription)` (filtered: where `bankRef` is null).

### `MerchantRule`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String | |
| `pattern` | String | Case-insensitive; supports `*` wildcard |
| `categoryId` | String | FK → `TransactionCategory` |
| `matchCount` | Int | Usage counter |
| `createdFromTransactionId` | String? | Traceability |
| `createdAt`, `updatedAt` | DateTime | |

Rules are applied ordered by pattern specificity (length desc) so `SWIGGY INSTAMART` wins over `SWIGGY`. Patterns shorter than 3 characters or matching > 50% of the user's existing descriptions are rejected on creation.

### `StatementImport`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String | |
| `accountId` | String | FK → `BankAccount` |
| `fileUrl` | String | Stored PDF |
| `fileName` | String | |
| `pageCount` | Int? | |
| `statementPeriodStart` | String? (YYYY-MM-DD) | From Claude extraction |
| `statementPeriodEnd` | String? (YYYY-MM-DD) | |
| `status` | Enum | `pending` \| `extracting` \| `preview` \| `saved` \| `failed` \| `cancelled` |
| `extractedCount` | Int | |
| `newCount` | Int | |
| `duplicateCount` | Int | |
| `claudeInputTokens` | Int? | |
| `claudeOutputTokens` | Int? | |
| `claudeCostUsd` | Decimal? | |
| `errorMessage` | String? | User-facing reason when `failed` |
| `stagedTransactions` | Json? | Preview rows before commit |
| `createdAt`, `updatedAt` | DateTime | |

No changes to existing tables. A single Prisma migration adds these five.

## Import flow (UI sequence)

1. **Upload step**: select target `BankAccount` (or "+ Add new"), drop 1–20 PDFs (≤5MB each) or a ZIP (≤100MB). Password prompt appears per-file if PDF is encrypted.
2. **Extraction progress**: per-file status (`pending` → `extracting` → `preview` | `failed`), up to 5 concurrent, cancellable.
3. **Preview**: combined table of extracted rows, grouped by file. Columns: date, description, amount, direction, category (editable). Summary banner: *"42 new · 8 duplicates skipped · 2 need review"*. User edits/drops rows.
4. **Commit**: apply rules → insert → run transfer detection → update `StatementImport.status = 'saved'` + cost metrics.
5. **Error**: import marked `failed`, user can retry or delete.

## User correction flow (post-import)

- Inline category dropdown in any transaction list.
- On change: `categorySource = 'user'`, then prompt *"Apply to all future transactions matching 'SWIGGY\*'?"* with an editable suggested pattern.
- Pattern generator strips trailing digits, city suffixes, and ref-id-looking strings.
- Accept → insert `MerchantRule`. Second prompt: *"Also re-categorize N past matching transactions?"* (only affects rows where `categorySource != 'user'`).
- Bulk re-categorize: select N rows, change category once, same prompts fire.

## Analysis views

### `/dashboard/bank-accounts` (overview)

- **Header bar**: month picker `[< April 2026 >]`, account selector `[All ▾]`, `[Import Statement]` button.
- **Stat cards**: Total Spending, Total Income, Net, Transaction Count (all reactive to month + account).
- **View A — Category breakdown (selected month)**: horizontal bar chart; click a bar → drill to list filtered by category + month.
- **View B — Month-over-month trend (last 12 months)**: grouped spend/income bars; click a month → switch whole dashboard.
- **View C — Top merchants (selected month)**: top-10 list with count and total.
- **View D — Daily heatmap (selected month)**: 6×7 grid, color intensity = spend; click → filter list to that day.
- **View E — Income vs expense (last 6 months)**: dual-line area chart.

### `/dashboard/bank-accounts/list`

- Filters (server-side, URL-synced): date range, account, category (multi), direction, description search, amount range.
- Columns: date, description, account, category (inline-editable), amount, actions.
- Sortable, paginated, default date desc.

### `/dashboard/bank-accounts/accounts`

CRUD for `BankAccount`. Per-account stats: total tracked, last imported, txn count. Delete is blocked for accounts with transactions; user must disable.

### `/dashboard/bank-accounts/categories`

CRUD for categories + merchant rules. Rule row: pattern, category, match count, delete.

### `/dashboard/bank-accounts/imports`

History of `StatementImport` rows. Columns: file, account, period, status, txn count, **Claude cost**. Page footer: *"Total API cost: $X.XX · Last 10 imports: $Y.YY · Rules cover Z% of transactions"* — makes the learning layer's payoff visible.

## Module structure

```
src/app/dashboard/bank-accounts/
  page.tsx                        overview (views A–E)
  list/page.tsx                   full transaction table
  accounts/page.tsx               BankAccount CRUD
  categories/page.tsx             categories + rules
  imports/page.tsx                import history
  import/page.tsx                 upload wizard
  import/[id]/page.tsx            resume pending import

src/app/api/bank-accounts/
  accounts/route.ts
  accounts/[id]/route.ts
  categories/route.ts
  categories/[id]/route.ts
  rules/route.ts
  rules/[id]/route.ts
  transactions/route.ts
  transactions/[id]/route.ts
  transactions/categorize/route.ts
  import/upload/route.ts
  import/[id]/route.ts
  import/[id]/extract/route.ts
  import/[id]/commit/route.ts
  analytics/summary/route.ts
  analytics/categories/route.ts
  analytics/merchants/route.ts

src/lib/bank-accounts/
  extract-transactions.ts
  extract-transactions-prompt.ts
  pdf-text.ts
  dedup.ts
  normalize-description.ts
  merchant-rules.ts
  transfer-detect.ts
  categorize.ts
  category-seed.ts
  aggregations.ts
  cost-tracking.ts

src/components/bank-accounts/
  month-picker.tsx
  stat-cards.tsx
  category-breakdown-chart.tsx
  month-trend-chart.tsx
  top-merchants-list.tsx
  daily-heatmap.tsx
  income-expense-chart.tsx
  transaction-table.tsx
  category-cell.tsx
  transfer-badge.tsx
  import-wizard/
    upload-step.tsx
    extract-progress.tsx
    preview-table.tsx
    commit-step.tsx
```

Reuses existing utilities: `getSessionUserId`, `requireUserId`, Prisma client, `runWithConcurrency`, file-upload endpoint, `ab-card` styles, Shadcn UI.

New dependency: `pdfjs-dist`.

## Edge cases & handling

| Case | Handling |
|---|---|
| Password-protected PDF | Prompt for password in upload step. Pass to `pdfjs-dist`. Not persisted. Wrong password → user-visible error. |
| Scanned / image-only PDF | Text length below threshold → auto-fallback to vision (PDF as document). |
| Malformed Claude JSON | Retry once with stricter prompt. Second failure → `failed` with reason. |
| Claude returns category outside allowed list | Coerce to `null`, flag for review. |
| Very large statement (200+ rows) | Single call if within output-token cap; else split by visible page breaks. |
| Overlapping-period statements | Dedup rule resolves automatically; preview shows skipped count. |
| Delete a category in use | Soft-delete only (`disabled = true`). Historical labels preserved. |
| Delete an account with transactions | Blocked; disable instead. |
| Transfer detection race with pending import | Detection only operates on `saved` rows. |
| Running balance missing | Field nullable; views needing it skip gracefully (no MVP view needs it). |
| Over-broad merchant rule | Reject patterns < 3 chars or matching > 50% of descriptions. Show match-count preview before save. |
| Dates / timezones | All dates as local `YYYY-MM-DD` strings, no TZ shifts. |

## Testing strategy

No test framework is present in the repo today. The spec does not introduce one. Manual verification checklist (kept in the implementation plan):

1. **Extraction**: feed 2–3 real statements; verify structure, counts, categories.
2. **Dedup**: re-upload same statement → 0 new / N duplicates; upload overlapping-period statement → partial overlap.
3. **Transfer detection**: upload both sides of a real transfer → grouped + excluded from spend totals.
4. **Rule learning**: re-categorize a SWIGGY row, accept prompt, upload a fresh SWIGGY-containing statement, verify pre-categorization.
5. **Filters & URL sync**: every filter combination round-trips through URL.
6. **Cost tracking**: `claudeInputTokens` / `claudeOutputTokens` recorded; imports page shows running total and rule-coverage %.

Unit-testable pure functions (if/when a test runner is added): `normalize-description`, `dedup.hashKey`, `merchant-rules.applyRules`, `merchant-rules.suggestPattern`, `transfer-detect.findPairs`, aggregation helpers.

## Observability

- `StatementImport` is the audit log: file, tokens, cost, errors, status.
- `Transaction.categorySource` records which path categorized each row — imports page surfaces rule-coverage % as it grows.
- Server logs Claude request/response summaries (no PII beyond what's already in the statement).

## Security & privacy

- Bank statements contain sensitive data. Use the existing file-upload endpoint pattern (same as FD PDFs). Storage encryption-at-rest should be validated separately — flagged as follow-up outside this spec.
- Password-protected PDFs: password held in memory only for request duration.
- All APIs gated by `requireUserId`, same as existing modules.

## Cost expectations

Per bank statement (Claude Sonnet 4.6, with prompt caching):
- First import on empty rule table: ~$0.05–0.08.
- After rule table matures (rules covering ~80% of transactions): still ~$0.05–0.08 per statement for extraction, but categorization shifts to local rules. Further cost reduction possible by splitting extraction and categorization into separate calls (deferred micro-optimization).

Realistic annual cost for single-user, 12 statements/year: well under ₹200.

## Open items (for implementation plan)

- Pick exact `pdfjs-dist` version / wrapper strategy.
- Decide initial preset category icons and colors.
- MVP stores preview staging as JSON on `StatementImport.stagedTransactions`. A separate staging table can be introduced later if batch sizes grow.
- Chart library: Recharts is already installed, use it for A/B/E/D.
