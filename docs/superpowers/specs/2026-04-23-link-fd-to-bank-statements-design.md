# Link Fixed Deposits to Bank Statement Transactions

**Date:** 2026-04-23
**Status:** Draft

## Context

Today the app has two parallel import systems:

1. **Bank account import** — the main flow. User uploads a bank statement PDF, transactions land in the `Transaction` table tied to a `BankAccount`.
2. **FD statement import** — a separate flow at `/dashboard/fd/statements`. User uploads the same kind of statement again, rows land in `FDStatement` / `FDStatementTxn`, matched to specific `FixedDeposit` records by FD number.

The duplication is wasteful: the user uploads the same statement twice, gets two copies of the data, and only the FD-side copy knows about FD linkage. Interest credits in the bank account transaction table show up as un-labelled income.

## Goal

Remove the FD statement import entirely. Detect FD-related transactions (interest, maturity, TDS, transfers) as part of the normal bank statement import, auto-link them to the matching `FixedDeposit`, and surface the link on both the FD detail page and the bank transactions list.

## Non-goals

- Manual link/unlink UI. Auto-detect only.
- Backfill of existing `Transaction` rows at migration time. Only new imports get linked automatically. (The one exception is described in "Trigger 2" below: when a new FD is *created*, existing transactions are re-scanned for that FD's number.)
- Preserving existing `FDStatement` / `FDStatementTxn` data. The tables are dropped.
- Re-introducing any separate PDF parsing for FD statements. The bank import is now the only pipeline.

## Schema

### Drop

- `model FDStatement`
- `model FDStatementTxn`
- `FixedDeposit.statementTxns` relation

### Modify `Transaction`

```prisma
model Transaction {
  // ... existing fields ...
  fdId       String?
  fd         FixedDeposit? @relation(fields: [fdId], references: [id], onDelete: SetNull)
  fdTxnType  String?       // interest | maturity | premature_close | tds | transfer_in | transfer_out
  // ... existing fields ...

  @@index([fdId])
}
```

### Modify `FixedDeposit`

```prisma
model FixedDeposit {
  // ... existing fields ...
  transactions Transaction[]   // replaces statementTxns
}
```

One Prisma migration. SQLite `ALTER TABLE` for the two new nullable columns; `DROP TABLE` for the two removed models. No data copy.

## Detection & linking logic

### New module: `src/lib/fd-link/`

Move and repurpose the two files from `src/lib/fd-statement/` that carry the real logic:

- `src/lib/fd-link/classify.ts` — classifies a transaction description into an `fdTxnType` using the same keyword / TDS rules as today.
- `src/lib/fd-link/match.ts` — extracts an FD number from a description and resolves it against a list of the user's `FixedDeposit` rows. Exact match on `fdNumber` or `accountNumber`, with a suffix fallback. Returns `matched | ambiguous | none`.

Delete the rest of `src/lib/fd-statement/`:

- `parse-pdf.ts`
- `regex-parser.ts`
- `ai-parser.ts`
- any glue / type files that exist only to support the removed PDF flow.

### Core function

```ts
// src/lib/fd-link/link.ts
type LinkResult = {
  fdId: string;
  fdTxnType: FdTxnType;
  categoryId: string | null;
};

function linkTransactionToFd(
  txn: { description: string; direction: "debit" | "credit"; amount: number },
  fds: FixedDeposit[],
  categoryMap: Map<FdTxnType, string>, // resolved in the caller
): LinkResult | null
```

- Extracts the FD/account number from `txn.description`.
- If `match()` returns `none` or `ambiguous`, returns `null`.
- Otherwise classifies `fdTxnType` and looks up the category id.

### Trigger 1 — bank statement commit

In `src/lib/bank-accounts/commit-import.ts`, after the primary insert of new `Transaction` rows succeeds, run a second pass:

1. Load all non-disabled `FixedDeposit` rows for the user (single query).
2. Resolve / seed the four category ids (see below) once per commit.
3. For each newly inserted transaction, call `linkTransactionToFd`.
4. Batch-update (`prisma.$transaction([...update(), ...])`) the rows that matched.

The link pass never throws outward. Failure is logged; the import is still considered saved. This matches how transfer detection is already layered on at the end of commit.

### Trigger 2 — FD created or updated

When a `FixedDeposit` is created (`POST /api/fd` and the bulk path) or when its `fdNumber` / `accountNumber` changes (`PATCH /api/fd/[id]`):

1. If the FD has no `fdNumber` and no `accountNumber`, skip.
2. Query `Transaction` rows for the same `userId` whose `description` contains the FD or account number, filtered to `fdId IS NULL`.
3. Resolve / seed the four category ids once.
4. Run `linkTransactionToFd` scoped to a single-element FD list. Update matches.

Same fire-and-forget model: the FD write is already committed when this runs; link failure is logged only.

Deleting or disabling an FD relies on the FK's `onDelete: SetNull` (for delete) and on filtering by `fd.disabled` in reads (for disable). No teardown pass needed.

### Precedence rules

- **FD id:** auto-link always sets `fdId` (and `fdTxnType`) when a unique match is found. `fdId` for a transaction is effectively immutable from the user's side — there is no manual override.
- **Category:** the FD link sets `categoryId` and `categorySource = "fd-link"` **unless** the row's current `categorySource` is `"user"`. User-set categories are sticky.
- **Ambiguous matches:** leave `fdId` / `fdTxnType` / `categoryId` untouched.

## Auto-categorization

Seed four categories per user on first use (idempotent: find-by-name, create if missing):

| fdTxnType                      | Category name | Kind     |
|--------------------------------|---------------|----------|
| `interest`                     | FD Interest   | income   |
| `maturity`, `premature_close`  | FD Maturity   | income   |
| `tds`                          | TDS           | expense  |
| `transfer_in`, `transfer_out`  | Transfer      | transfer |

If "Transfer" or "TDS" already exists for the user (preset or user-created, matched case-insensitively on `name`), reuse the existing row.

Seeding happens lazily inside the link pass, not on app startup — no blanket migration.

## UI changes

### Delete

- `src/app/dashboard/fd/statements/**` (list page, upload page, detail page, and their client components)
- `src/app/api/fd/statements/**` (parse, list, detail, pdf routes)
- Any link / CTA into `/dashboard/fd/statements` (the FD list page "Upload statement" button, any dashboard widget that counts FD statements, any nav entries)
- `src/lib/fd-statement/parse-pdf.ts`, `regex-parser.ts`, `ai-parser.ts`, and any module that exists only to support them
- The `FdTxnSection` import on `fd-detail-content.tsx` stays, but its source file moves — see below.

### FD detail page — `src/app/dashboard/fd/[id]/page.tsx`

- Continue to render `FdTxnSection` with the same visual design.
- Server component now loads rows from `Transaction` where `fdId = fd.id` (ordered by `txnDate desc`), rather than from `FDStatementTxn`.
- Shape the rows into the existing `FdTxnRow` type: map `Transaction.amount` + `direction` into the `debit` / `credit` fields, `fdTxnType` → `type`, `description` → `particulars`.
- Move the `FdTxnSection` component out of `src/app/dashboard/fd/statements/` (which is being deleted) into `src/app/dashboard/fd/fd-txn-section.tsx` (or similar). Adjust the import in `fd-detail-content.tsx`.

### Bank transactions list — `src/app/dashboard/bank-accounts/list`

- For each transaction row with `fdId !== null`, render a small pill next to the description:
  `🔗 FD · {bankName} · {fdNumber ?? "••" + accountLast4}`
  - Desktop: inline, between description and amount.
  - Mobile: on its own line below the description.
- The pill is a `<Link>` to `/dashboard/fd/{fdId}`.
- Requires the list query to include the related FD's `bankName`, `fdNumber`, `accountNumber` so the render is a single query — add an `include: { fd: { select: { bankName, fdNumber, accountNumber } } }` where the list is fetched.

### Navigation / misc cleanup

- Remove "FD Statements" from the dashboard nav if it exists.
- Remove any stats tile or summary that counts FDStatement / FDStatementTxn records.

## Error handling

- Link pass wraps the per-commit work in a try/catch. Errors log to `console.error` and are swallowed — the commit succeeds. (Mirrors transfer detection.)
- Ambiguous or missing FD matches are not errors; they just produce `null` and move on.
- Category seeding races across two concurrent commits are prevented by the unique constraint that already exists on `TransactionCategory(userId, name)` — if two commits try to create "FD Interest" simultaneously, one wins, the other catches `P2002` and re-reads.

## Testing

- **Unit:** `linkTransactionToFd` against a curated set of description strings (SBI interest, ICICI interest, TDS, maturity, transfer in/out, ambiguous suffix match, no FD number). Matrix of `fdTxnType` → category mapping.
- **Integration:** run the commit pipeline end-to-end with a canned statement and a pre-seeded FD; assert transactions land with correct `fdId`, `fdTxnType`, `categoryId`.
- **Regression:** existing commit tests must still pass with the link pass enabled.
- **UI smoke:** FD detail page renders the linked transactions; bank list page shows the FD pill and clicking through goes to the right FD.

## Migration plan

1. Write Prisma migration: add `fdId`, `fdTxnType` on `Transaction`; drop `FDStatement`, `FDStatementTxn`.
2. Ship the detection module and wire both triggers.
3. Ship the UI changes + deletions in the same release.
4. No data migration script. Users who had old FD-statement imports simply lose that view; they can re-upload the underlying bank statements through the normal import path (or not — they already have the transactions in the bank table).

## Open risks

- Category seeding adds four per-user rows the first time they import after this ships. This is acceptable but should be visible to the user (they'll see new categories appear in their list).
- If an FD certificate is added without an `fdNumber` (rare but possible — user may only have `accountNumber`), Trigger 2 falls back to the account number, which for some banks collides with the savings account number. Suffix matching should be restricted enough that this doesn't produce false positives, but it's worth watching.
