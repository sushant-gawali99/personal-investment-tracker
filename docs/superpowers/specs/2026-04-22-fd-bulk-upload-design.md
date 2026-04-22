# FD Bulk Upload

**Date:** 2026-04-22
**Status:** Approved

## Overview

Add a bulk-upload flow that accepts multiple PDFs, images, or a zip archive containing them, extracts FD fields from each file via the existing Claude extraction endpoint, lets the user review and edit the results in a table, and saves the selected rows as FD records. One file = one FD. The flow lives on a dedicated page and reuses existing single-file endpoints; parallelism and progress tracking happen client-side.

## Goals

- Create many FDs in one session from a collection of certificate files.
- Reuse the existing single-file `/api/fd/extract`, `/api/fd/upload`, and `POST /api/fd` endpoints — no per-request server-side job state.
- Provide live per-row progress, per-row retry, and non-blocking duplicate warnings.
- Keep the existing single-FD flow unchanged.

## Non-Goals

- Back-side images for bulk-uploaded FDs (single-image-per-FD by design).
- Multi-FD-per-PDF extraction.
- Persisting bulk-upload sessions across reloads.
- Server-side background jobs or async queue.
- Bulk renew, bulk edit, or undo after save.
- CSV / spreadsheet import.

## Limits

| Limit | Value |
|---|---|
| Files per batch | 20 |
| Per-file size | 5 MB (unchanged from single-FD flow) |
| Zip file size | 20 MB |
| Client concurrency | 5 |

Files beyond the cap are rejected with a toast; unsupported files inside a zip are ignored silently.

## Architecture

### Flow phases (all client-driven)

1. **Drop** — user drops PDFs, images, zips, or a mix. Client expands zips via `jszip`, filters for supported types (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`), dedupes by `name+size`, enforces 20-file cap.
2. **Extract** — auto-triggered after drop. Each file becomes a row in state `pending`. A concurrency-5 queue calls the existing `/api/fd/extract` endpoint per file (`pdfFile` for PDFs, `front` for images). Row status transitions `pending → extracting → extracted | extract_failed`.
3. **Duplicate check** — after all extractions settle, a single `GET /api/fd/duplicates` call flags rows whose `(bankName, fdNumber)` already exists for the user. Non-blocking warning badge.
4. **Review** — user reviews/edits rows in an editable table. Essential columns visible; click row chevron to expand for full-field editing. Duplicates, errors, and selection state are all user-controllable.
5. **Save** — on "Save selected", concurrency-5 queue processes each selected row: `POST /api/fd/upload` for the file, then `POST /api/fd` with merged extracted + edited fields and the returned URL. Row status `saving → saved | save_failed`.
6. **Summary** — banner with counts (saved / failed / skipped). "Upload more" resets state; "Go to FDs" navigates to the list.

### Why no new extraction endpoint

The existing `/api/fd/extract` already handles a single PDF or single image. Parallelizing on the client gives free live progress, natural per-row retry, and keeps the server stateless. No job records, no polling endpoints.

## Components

### New files

| File | Purpose |
|---|---|
| `src/app/dashboard/fd/bulk/page.tsx` | Server component. Auth guard mirroring `/fd/new/page.tsx`. Renders `<BulkUploadForm />`. |
| `src/app/dashboard/fd/bulk/bulk-upload-form.tsx` | Client component. Owns all bulk state via `useReducer`. |
| `src/app/dashboard/fd/bulk/bulk-drop-zone.tsx` | Multi-file drop zone accepting PDFs, images, and zips. |
| `src/app/dashboard/fd/bulk/bulk-row-table.tsx` | Review table with expandable rows. |
| `src/lib/zip.ts` | `expandZip(file: File): Promise<File[]>` using `jszip`. |
| `src/lib/bulk-queue.ts` | Generic `runWithConcurrency<T, R>(items, limit, fn, abortSignal)`. |
| `src/app/api/fd/duplicates/route.ts` | New `GET` endpoint for duplicate checks (details below). |

### Shared refactor

Extract the editable FD field inputs currently embedded in `src/app/dashboard/fd/new/fd-new-form.tsx` into a shared module `src/app/dashboard/fd/_shared/fd-fields.tsx` so both the bulk expanded-row editor and the single-FD form use the same inputs. This is the one refactor the bulk work justifies — scope stays tight.

### Entry point

Add a secondary "Bulk Upload" button next to the primary "Add FD" button on the FD list page (`src/app/dashboard/fd/page.tsx`), linking to `/dashboard/fd/bulk`.

## UI

```
┌─ Bulk Upload FDs ──────────────────────────────────┐
│ [Drop PDFs, images, or a .zip here]                │
│ Up to 20 files, 5 MB each.                         │
├─────────────────────────────────────────────────────┤
│ Files (N / 20)                         [Cancel all]│
│ ┌──────────────────────────────────────────────┐   │
│ │ ☑ | Status | Bank | FD # | Principal | Rate │   │
│ │ ☑ | ✓      | HDFC | 1234 | 100000   | 7.5  │ ⋁ │
│ │   └── [full editable fields for this FD] ──┘   │
│ │ ☑ | ⚠ dup  | SBI  | 5678 | 50000    | 6.8  │ ⋁ │
│ │ ☐ | ✗ fail | —    | —    | —        | —    │ ↻ │
│ └──────────────────────────────────────────────┘   │
│ [Extract all] [Save selected (N)]                   │
└─────────────────────────────────────────────────────┘
```

**Status pills:**

| Status | Pill |
|---|---|
| `pending` | grey |
| `extracting` | spinner |
| `extracted` | green check |
| `extract_failed` | red + retry button |
| `saving` | spinner |
| `saved` | green check |
| `save_failed` | red + retry button |
| duplicate | amber warning badge (additive, shown alongside status) |

**Drop zone behavior:** accepts multiple files and zips. Second drop appends (doesn't replace). Over-cap excess rejected with toast listing accepted count.

## Client State

Single `useReducer` in `bulk-upload-form.tsx`:

```ts
type RowStatus =
  | "pending" | "extracting" | "extracted" | "extract_failed"
  | "saving" | "saved" | "save_failed";

type BulkRow = {
  id: string;                     // uuid
  file: File;                     // original file retained in memory
  kind: "pdf" | "image";
  status: RowStatus;
  error?: string;
  isDuplicate?: boolean;
  selected: boolean;              // default true
  extracted?: FdExtracted;        // shape matches /api/fd/extract response
  edited?: Partial<FdExtracted>;  // user edits
};

type State = { rows: BulkRow[] };
```

Merged view for save = `{ ...extracted, ...edited }`.

Memory envelope: 20 × 5 MB = 100 MB worst case, held as `File` objects. Acceptable; garbage-collected on navigation.

## Server Changes

### New endpoint

**`GET /api/fd/duplicates?keys=<bank>|<fdNumber>,<bank>|<fdNumber>,...`**

- Auth guard (same pattern as other FD routes).
- Parses `keys` param → up to 20 tuples of `{bankName, fdNumber}`. Separator `|` chosen to avoid colon/comma collisions inside values.
- Query: `prisma.fixedDeposit.findMany({ where: { userId, OR: [{bankName, fdNumber}, ...] }, select: { bankName: true, fdNumber: true } })`.
- Response: `{ duplicates: Array<{bankName: string, fdNumber: string}> }`.
- Rows with null `fdNumber` are skipped client-side (no reliable match key).

### Unchanged

- `/api/fd/extract` — reused per row, single-file path.
- `/api/fd/upload` — reused per row.
- `POST /api/fd` — reused per row.
- `prisma/schema.prisma` — no changes. `sourceImageBackUrl` stays null for bulk image FDs. `priorPeriods` typically null from single-face bulk extraction; existing create handler already tolerates null.

## Error Handling

| Case | Behavior |
|---|---|
| Extract failure (422 / network / timeout) | Row → `extract_failed` with message; per-row retry; save skips row. |
| Upload failure during save | Row → `save_failed`; file retained in memory; retry re-uploads. |
| Create failure (validation / DB) | Row → `save_failed` with server error surfaced. |
| Zip parse failure | Toast "Could not read zip: <name>"; siblings proceed. |
| Empty zip / only unsupported files | Toast "No supported files found in <zip>"; no rows created. |
| Over-cap drop | Accept up to cap; toast "Only N files added; 20-file limit reached". |
| Duplicate files dropped together | Deduped by `name+size` on drop; toast if any deduped. |
| `fdNumber` null after extraction | Skip duplicate check for that row. |
| Page navigation with in-flight work | `beforeunload` warning while any row is `extracting` or `saving`. |
| Malformed Claude JSON | Treated as extract failure; retry available. |

**Cancellation:** "Cancel all" button uses a shared `AbortController` to abort in-flight fetches; already-completed rows stay.

## Data Flow

```
User drops files/zips
  │
  ▼
[expandZip] → [filter supported] → [dedupe] → [enforce cap]
  │
  ▼
Rows created (status=pending)
  │
  ▼
runWithConcurrency(rows, 5, extractRow)
  │  per row: POST /api/fd/extract
  ▼
All extracts settled
  │
  ▼
GET /api/fd/duplicates?keys=... → mark isDuplicate
  │
  ▼
User reviews / edits / unchecks rows
  │
  ▼
Click "Save selected"
  │
  ▼
runWithConcurrency(selected, 5, saveRow)
  │  per row: POST /api/fd/upload → POST /api/fd
  ▼
Summary banner
```

## Testing / Verification

No automated test infrastructure exists in this project. The implementation plan will include a manual verification checklist covering:

- Drop mixed loose files (pdf + image + image).
- Drop a zip containing pdf + image + non-supported file.
- Drop zip + loose files together.
- Drop over-cap (25 files).
- Forced extraction failure (e.g., disconnect network mid-extract).
- Forced save failure (e.g., submit invalid field via browser tools).
- Duplicate flagging for a known existing FD.
- Per-row retry for both extract and save failures.
- Cancel-all mid-batch.
- Concurrency cap behavior (observe no more than 5 in-flight requests).

## Dependencies

- `jszip` — new dependency, client-only. ~100 KB gzipped.
