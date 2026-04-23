# Re-import Statement (Super Admin)

**Date:** 2026-04-23  
**Status:** Approved

## Overview

Add a "Re-import" button to each row in the imports list, visible only to super admins. Clicking it deletes all transactions linked to that statement, re-runs the full AI extraction pipeline on the stored PDF, and auto-commits all results — no preview step. This is a silent, destructive override intended for admin corrections.

## API

**Route:** `POST /api/bank-accounts/import/[id]/reimport`

1. **Auth guard:** Verify session; call `isSupAdmin(session.email)` — return 403 if not super admin.
2. **Ownership check:** Confirm the `StatementImport` record belongs to the effective user (session user or impersonated user).
3. **Delete transactions:** `DELETE FROM Transaction WHERE importId = id AND userId = userId`.
4. **Reset import record:** Set `status: "extracting"`, `newCount: 0`, `extractedCount: 0`, `duplicateCount: 0`, `stagedTransactions: null`, `errorMessage: null`.
5. **Return 202** immediately.
6. **Background:** Call existing `extractTransactions()` pipeline. Since old transactions are deleted, dedup finds no matches — all extracted rows auto-commit. Final status lands at `"saved"` or `"failed"`.

No new extraction logic is written — the existing pipeline is reused as-is.

## UI

**File:** `src/app/dashboard/bank-accounts/imports/imports-list.tsx`

- Add `isSuperAdmin: boolean` prop to `ImportsList`.
- Pass `isSuperAdmin` from the page server component (call `isSupAdmin(session.email)`).
- For each import row, render a "Re-import" button when `isSuperAdmin === true`, placed next to the existing Delete button.
- Button states:
  - **Idle:** icon + "Re-import" label
  - **Loading:** spinner, button disabled (per-row state, not global)
  - **Done:** brief checkmark flash, then reset to idle
- On click: POST `/api/bank-accounts/import/[id]/reimport`; on 202, reset button state and call `router.refresh()` so the status badge updates as extraction runs in the background.
- Visible for all import statuses (`saved`, `failed`, `preview`, `extracting`, `pending`).

## Data Flow

```
[Re-import click]
      │
      ▼
POST /api/bank-accounts/import/[id]/reimport
      │
      ├─ 403 if not super admin
      ├─ 404 if import not found / wrong user
      ├─ Delete Transaction rows for this import
      ├─ Reset StatementImport → status: "extracting"
      └─ 202 Accepted
            │
            ▼ (background)
      extractTransactions() — existing pipeline
            │
            ├─ PDF read from stored fileUrl
            ├─ JS parser or Claude extraction
            ├─ Dedup: no matches (old rows deleted) → all new
            ├─ commitImport() — auto-commit all rows
            └─ StatementImport → status: "saved" | "failed"
```

## Error Handling

- If the PDF file is missing from disk, extraction fails gracefully — `StatementImport.status` → `"failed"` with `errorMessage` set. The admin sees the failed badge and can investigate.
- No partial-commit risk: transactions are deleted before extraction starts; if extraction fails, the import is left with zero transactions and status `"failed"`.

## Scope

- No changes to the extraction pipeline, commit logic, or dedup logic.
- No new database migrations.
- Two files changed: new API route file, updated `ImportsList` component + its parent page.
