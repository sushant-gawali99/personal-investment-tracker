# Replace FD Delete with Disable

**Date:** 2026-04-22
**Status:** Approved

## Overview

Remove the destructive "Delete" action from Fixed Deposits and replace it with a non-destructive "Disable" toggle. Disabled FDs are hidden from the default list and excluded from all summary totals, but remain accessible via a new "Disabled" filter where they can be re-enabled.

## Goals

- Preserve historical FD records — users no longer lose data by accident
- Keep the active experience clean: disabled FDs do not appear in the default list or contribute to totals
- Provide a clear, one-click path to bring a disabled FD back ("Enable")

## Non-Goals

- Bulk disable / enable
- A "trash bin" with auto-purge after N days
- Persisting disabled state to the deep-link detail URL (the status is part of the record itself)
- Admin-only recovery flows

## Data Model & API

### Schema

Add one column to the `FixedDeposit` model in `prisma/schema.prisma`:

```prisma
disabled Boolean @default(false)
```

Apply the DDL directly to Turso (matching the pattern used when `sourcePdfUrl` was added):

```sql
ALTER TABLE FixedDeposit ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0
```

### API

- **Remove** `DELETE /api/fd/[id]` handler. The underlying Prisma `delete` call is gone.
- **Add** `PATCH /api/fd/[id]` handler accepting a JSON body `{ disabled: boolean }`. It applies the same `requireUserId` + ownership check used by existing FD routes and updates the field. Returns the updated FD.

The existing `GET /api/fd/[id]` stays unchanged.

## Filter UX

The list page's filter pills grow from three to four, mutually exclusive:

**All · Active · Matured · Disabled**

- **All** — non-disabled FDs (both still-active and matured)
- **Active** — non-disabled FDs whose latest-renewal maturity date is still in the future
- **Matured** — non-disabled FDs whose latest-renewal maturity date has passed
- **Disabled** — disabled FDs only

Counts next to each pill reflect their own population (e.g. "All (8)" excludes disabled; "Disabled (2)" shows only disabled).

The bank-name dropdown filter stays orthogonal. "Clear filters" resets to All.

**Summary stats** (Total Corpus, Avg Interest Rate, Active Deposits, Interest This Year, Total Principal, Total Interest Earned) **always exclude disabled FDs**. A disabled FD never pollutes the active totals regardless of the filter selection.

## UI Changes Per Surface

### `fd-disable-button.tsx` (new client component, replaces `fd-delete-button.tsx`)

Props: `{ id: string; disabled: boolean }`.

- When `disabled=false`: renders "Disable" with an `Archive` icon (amber text tone, matching the existing destructive styling)
- When `disabled=true`: renders "Enable" with a `RotateCcw` icon (neutral tone)

Click flow: confirmation dialog → `PATCH /api/fd/[id]` with the inverted boolean → `router.refresh()`.

Dialog copy when disabling:
> Disable this FD? It will be hidden from the list and excluded from totals. You can re-enable it from the Disabled filter.

Dialog copy when enabling:
> Enable this FD? It will reappear in the main list.

### Detail page (`/dashboard/fd/[id]/page.tsx`)

- Replace the `FDDeleteButton` import and usage with `FDDisableButton`
- Renew button is **hidden** when `fd.disabled`
- Matured banner's "Renew Now" button is **hidden** when `fd.disabled` (the banner body still shows)
- Add a "Disabled" chip in the status row (next to the existing Matured / days-remaining chip) when `fd.disabled` — uses the neutral `ab-chip` style

### Expanded row actions bar (in `fd-list.tsx`)

- Active FD: "Open full page ↗" on the left, Renew + Disable on the right
- Disabled FD: "Open full page ↗" on the left, Enable on the right (no Renew)

### Server list page (`src/app/dashboard/fd/page.tsx`)

- Because the filter state lives client-side in `fd-list.tsx`, the Prisma query is unchanged — the server continues to fetch all records (including disabled) and hand them to the client, which filters for display.
- The `resolved` array used for summary-stat totals always excludes disabled rows via an inline `.filter((fd) => !fd.disabled)` step before mapping.

### `fd-list.tsx` adjustments

- `Filter` type becomes `"all" | "active" | "matured" | "disabled"`
- `counts` includes a fourth key `disabled`, computed as the count of `fds` where `fd.disabled === true`
- The `filtered` step gates rows: if filter === "disabled", keep only disabled; otherwise keep only non-disabled and apply the active/matured rule
- The fourth pill button ("Disabled") renders alongside the existing three
- When rendering a row, if `fd.disabled`, wrap the row in a dimmed tone (reduced opacity on the row body) to make the disabled state obvious even at a glance
- Expansion-row action buttons switch based on `fd.disabled`: Renew is hidden, Delete → `FDDisableButton`

## Files

| Path | Change | Responsibility |
| --- | --- | --- |
| `prisma/schema.prisma` | **Modify** | Add `disabled Boolean @default(false)` |
| `src/app/api/fd/[id]/route.ts` | **Modify** | Remove `DELETE`; add `PATCH` that toggles `disabled` |
| `src/app/dashboard/fd/fd-detail-content.tsx` | No change | Shared body works for disabled FDs as-is |
| `src/app/dashboard/fd/[id]/fd-delete-button.tsx` | **Delete** | Replaced by the new disable button |
| `src/app/dashboard/fd/[id]/fd-disable-button.tsx` | **Create** | Toggle Disable / Enable with confirm dialog |
| `src/app/dashboard/fd/[id]/page.tsx` | **Modify** | Swap delete for disable; hide Renew + Renew-Now when disabled; add Disabled chip |
| `src/app/dashboard/fd/page.tsx` | **Modify** | Summary stats exclude disabled; the `resolved` computation filters before reducing |
| `src/app/dashboard/fd/fd-list.tsx` | **Modify** | Add "Disabled" pill; update `Filter` type, filter logic, counts, and row actions (Renew hidden, Disable toggle) |

No other files change. No new dependencies.
