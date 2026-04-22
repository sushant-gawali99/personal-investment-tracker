# FD Bank Statement Import — Design

**Date:** 2026-04-22
**Status:** Approved for planning

## Problem

FDs earn periodic interest and eventually mature (or are closed prematurely). Today, the app tracks the FD itself but has no record of actual interest credits or maturity events posted to the user's bank account. The user wants to upload a bank PDF statement, auto-extract FD-related transactions, match them to existing FDs, and see a transaction history inside each FD's expanded area.

## Goals

- Upload a PDF bank statement scoped to a user-selected bank.
- Extract FD-related transactions: interest credits, maturity, premature closure, transfers to/from FD, TDS.
- Match each transaction to an existing `FixedDeposit` by FD number / account number (exact + suffix fallback).
- Persist transactions so they appear in the FD's expanded detail area.
- Maintain a history of uploaded statements (re-downloadable, deletable).
- Idempotent re-upload — duplicate transactions are silently skipped.

## Non-goals

- No automatic balance reconciliation against the statement.
- No auto-creation of FDs from statement entries (the user creates FDs via existing flows).
- No scheduled / email-based ingestion. Upload is manual.

## Architecture

New vertical slice parallel to existing FD modules:

- **UI**: `/dashboard/fd/statements` (list, upload, detail)
- **API**: `/api/fd/statements/*`
- **Parser lib**: `src/lib/fd-statement/`
- **Storage**: same pattern as existing `FixedDeposit.sourcePdfUrl`
- **AI client**: reuse existing `src/lib/anthropic.ts`

The FD list page gets a "Statements" link pointing at the new page. The FD expanded area (`fd-detail-content.tsx`) gets a new "Interest & Transactions" section driven by the matched txns.

## Data model (Prisma)

```prisma
model FDStatement {
  id            String   @id @default(cuid())
  userId        String
  bankName      String
  fileName      String
  sourcePdfUrl  String
  fromDate      DateTime?
  toDate        DateTime?
  txnCount      Int      @default(0)
  matchedCount  Int      @default(0)
  parseMethod   String   // "regex" | "ai"
  uploadedAt    DateTime @default(now())
  transactions  FDStatementTxn[]
  @@index([userId, bankName])
}

model FDStatementTxn {
  id               String   @id @default(cuid())
  statementId      String
  statement        FDStatement   @relation(fields: [statementId], references: [id], onDelete: Cascade)
  fdId             String?
  fd               FixedDeposit? @relation(fields: [fdId], references: [id], onDelete: SetNull)
  txnDate          DateTime
  particulars      String
  debit            Float    @default(0)
  credit           Float    @default(0)
  type             String   // interest | maturity | premature_close | transfer_in | transfer_out | tds | other
  detectedFdNumber String?
  @@index([fdId, txnDate])
  @@index([statementId])
  @@unique([statementId, txnDate, particulars, debit, credit])
}
```

`FixedDeposit` gets `statementTxns FDStatementTxn[]` back-relation.

The unique constraint gives idempotent re-upload: re-running the same statement inserts zero duplicate rows. (Scoped to `statementId` — so two different uploads of the same PDF create two statements but the second's txn-write step can be made idempotent by matching on `(bankName, userId, txnDate, particulars, debit, credit)` before insert — see pipeline below.)

## Parser + matching pipeline

Location: `src/lib/fd-statement/`

| File | Purpose |
|---|---|
| `parse-pdf.ts` | Extract plain text from PDF (use `pdf-parse` or whatever's already installed; check first). |
| `regex-parser.ts` | Tabular text → `ParsedTxn[]`. |
| `ai-parser.ts` | Haiku 4.5 fallback. Sends PDF to Claude, expects structured JSON. |
| `classify.ts` | Pure function: row → `{type, detectedFdNumber}`. |
| `match.ts` | Pure function: `detectedFdNumber` + bank → `fdId` (or null / ambiguous). |

### `ParsedTxn` shape

```ts
type ParsedTxn = {
  txnDate: string;       // ISO
  particulars: string;
  debit: number;
  credit: number;
  type: TxnType;
  detectedFdNumber: string | null;
};
```

### Classification rules

| Particulars contains | Type |
|---|---|
| `Int.` or `MAT INT` | `interest` |
| `PREMAT` / `PRECLOSE` / `PREMATURE` | `premature_close` |
| `CLSD` AND `txnDate < FD.maturityDate` (post-match) | `premature_close` |
| `MAT` + `CLSD` | `maturity` |
| `TR TO FD` | `transfer_out` |
| `Transfer fr FD` | `transfer_in` |
| `TDS` | `tds` |
| none of the above | `other` |

Note: `premature_close` vs `maturity` refinement happens *after* matching, since it needs the FD's `maturityDate`. Initial classification can tag it `maturity`; a second pass downgrades to `premature_close` when the txnDate is before the matched FD's maturity.

### Regex-first strategy

1. `parse-pdf.ts` produces raw text.
2. `regex-parser.ts` attempts to extract rows. Heuristics: line starts with a date pattern; split by whitespace/columns; extract `date | particulars | ca/tr | debit | credit | balance`.
3. If regex returns 0 rows OR flags structural anomalies (e.g., no `Int.` keywords found in a statement with 3+ pages), call `ai-parser.ts`.
4. Record `parseMethod = "regex"` or `"ai"` on the `FDStatement`.

### AI parser

Reuses the existing Anthropic client. Model: `claude-haiku-4-5-20251001`. Prompt asks for a JSON array of transactions with the `ParsedTxn` shape (minus `type` — which we compute client/server-side via `classify.ts` for consistency). PDF sent as a document block (same pattern as `/api/fd/extract`).

### Matching

`match.ts` looks up `FixedDeposit` where `userId = ? AND bankName = ?` AND one of:

- `fdNumber = detected`
- `accountNumber = detected`
- `fdNumber ENDS WITH detected`
- `detected ENDS WITH fdNumber` (handles the Lokmanya case where `18883` appears in statement but FD is stored as `999030244018883`)

If >1 candidate match, return `ambiguous` and leave `fdId = null`.

## UI

### Page: `/dashboard/fd/statements`

Header: "Bank Statements" + "Upload Statement" button.

Table columns: **Bank | Period | Uploaded | Txns | Matched | Actions**

Actions: Download PDF, View, Delete.

### Upload flow

Routed as `/dashboard/fd/statements/new`, three steps managed in a single client component:

1. **Upload**: Bank dropdown (required; user picks) + PDF drop zone. On submit → `POST /api/fd/statements/parse` → response includes parsed txns with match suggestions. PDF is *not* persisted yet.
2. **Review**: Table of parsed txns, grouped by FD.
   - Matched rows display the resolved FD label; editable via combobox.
   - Unmatched rows highlighted; user picks an FD or marks "skip".
   - A toggle shows/hides skipped/`other`/TDS rows.
   - Summary counts: "X interest, Y maturity, Z premature_close, W unmatched".
3. **Save**: `POST /api/fd/statements` with finalized matches + PDF → persists. Redirect to `/dashboard/fd/statements`.

### Statement detail: `/dashboard/fd/statements/[id]`

All transactions for that upload in one table. Download button for the source PDF.

### FD expanded area

New "Interest & Transactions" section inside `fd-detail-content.tsx`:

- Table columns: **Date | Type (badge) | Particulars | Amount | Statement**
- `Statement` column links back to the statement detail page.
- Sorted newest first.
- Only rendered when the FD has at least one matched txn.

## API routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/fd/statements/parse` | Multipart PDF + bank. Runs parse + classify + match. Returns `{ statementMeta, txns: [...] }`. No DB writes. |
| POST | `/api/fd/statements` | JSON body + PDF reference. Persists `FDStatement` + `FDStatementTxn[]`. Idempotent via unique constraint. |
| GET | `/api/fd/statements` | List statements for current user. |
| GET | `/api/fd/statements/[id]` | Statement + transactions. |
| DELETE | `/api/fd/statements/[id]` | Cascade removes txns. |
| GET | `/api/fd/statements/[id]/pdf` | Download the source PDF. |

PDF storage follows the same pattern as `FixedDeposit.sourcePdfUrl`. Actual upload handoff can piggyback on `/api/fd/upload` or a dedicated route — implementer's call during planning.

## Error handling

- Parser returns 0 txns after AI fallback → 422 with message "Could not parse statement; please check format."
- User's chosen bank has no FDs → accept upload with a warning; all txns will be unmatched.
- Duplicate txns silently skipped on save via the unique constraint; response reports `{ inserted: N, skipped: M }`.
- Ambiguous matches (>1 FD candidate) → `fdId = null`, user resolves in review step.

## Testing

- Unit tests for `classify.ts` — table-driven with real rows from the attached `statement-50.pdf`.
- Unit tests for `match.ts` — exact, suffix-forward, suffix-reverse, ambiguous, no-match cases.
- Integration test: upload `statement-50.pdf` with bank = Lokmanya → assert parsed count + per-type counts + suffix matches resolve.
- Manual smoke: upload statement, step through review, save, open an affected FD, verify new section shows interest rows with correct dates/amounts, verify PDF redownload.

## Open items deferred to planning

- Which PDF-text library (confirm what's already in `node_modules`).
- Exact Zod schema for the AI response.
- Whether PDF storage is on local disk or cloud (follow whatever existing FD PDFs do).
