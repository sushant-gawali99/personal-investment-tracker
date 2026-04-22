# FD Tenure with Days + Verbatim Label — Design

**Date:** 2026-04-22

## Problem

Some FDs have tenure values that don't fit the current `tenureMonths Int` schema — e.g., "12 months 37 days", "45 days", "1 year 2 months". The current form only accepts whole months, rounds or truncates day-level tenure, and displays "N months" regardless of what the receipt actually said. Users want the exact tenure label from their FD certificate shown back to them.

## Goal

Capture, store, and display FD tenure precisely — including a separate days component and the verbatim label from the receipt when available. Preserve month-based calculation accuracy for backward compatibility.

## Non-goals

- No dropping of the existing `tenureMonths` column.
- No freeform tenure text input for manual entry. Users filling the form by hand enter Months + Days fields; the verbatim-text field is only populated by AI extraction.
- No verbatim preservation of units like "years", "yrs", "½ year" for manual entries — these collapse into the stored `tenureMonths` numeric.
- No historical backfill of `tenureDays` or `tenureText` for existing rows (they default to 0 / null).

## Data Model

### `FixedDeposit` (Prisma)

Add two columns:

```prisma
model FixedDeposit {
  // ...existing fields...
  tenureMonths   Int                 // unchanged
  tenureDays     Int     @default(0) // NEW
  tenureText     String?             // NEW, nullable, verbatim from receipt
  // ...rest...
}
```

### `FDRenewal` (Prisma)

Same two columns:

```prisma
model FDRenewal {
  // ...existing fields...
  tenureMonths   Int                 // unchanged
  tenureDays     Int     @default(0) // NEW
  tenureText     String?             // NEW, nullable
  // ...rest...
}
```

### Turso DDL

This repo applies DDL directly to Turso (no Prisma migrations). Apply four statements:

```sql
ALTER TABLE FixedDeposit ADD COLUMN tenureDays INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FixedDeposit ADD COLUMN tenureText TEXT;
ALTER TABLE FDRenewal    ADD COLUMN tenureDays INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FDRenewal    ADD COLUMN tenureText TEXT;
```

Existing rows: `tenureDays = 0`, `tenureText = NULL`. No data migration needed.

## Display Helper

New helper in `src/lib/format.ts` (or the existing format util — whichever exists; file will be created if absent):

```ts
export function formatTenure(t: {
  tenureMonths: number | null | undefined;
  tenureDays: number | null | undefined;
  tenureText: string | null | undefined;
}): string {
  if (t.tenureText && t.tenureText.trim()) return t.tenureText.trim();

  const m = t.tenureMonths ?? 0;
  const d = t.tenureDays ?? 0;

  if (m > 0 && d > 0) return `${m} months ${d} days`;
  if (m > 0) return `${m} month${m === 1 ? "" : "s"}`;
  if (d > 0) return `${d} day${d === 1 ? "" : "s"}`;
  return "—";
}
```

Used wherever tenure is currently rendered as `"N months"`.

## AI Extraction

Update `POST /api/fd/extract`:

- Extend the JSON schema / structured output to return `tenureText: string` (raw label as printed on receipt) in addition to existing `tenureMonths`.
- Also return `tenureDays: number` — the days component beyond whole months.
- Prompt update: "Extract the tenure exactly as printed on the certificate into `tenureText`. In addition, parse it into `tenureMonths` and `tenureDays` for calculation. A tenure of '1 year 2 months' yields `tenureMonths: 14, tenureDays: 0`. A tenure of '12 months 37 days' yields `tenureMonths: 12, tenureDays: 37`. A tenure of '45 days' yields `tenureMonths: 0, tenureDays: 45`."
- Same three fields are returned per prior-period in the renewal-number case.

## API Payloads

All three mutation endpoints accept `tenureDays` and `tenureText` in addition to the existing `tenureMonths`:

- `POST /api/fd` — accepts `{ ...existing, tenureDays: number, tenureText?: string | null }`.
- `PATCH /api/fd/[id]` — body-spread pattern already handles new keys, but whitelist additions if the handler validates (check current implementation).
- `POST /api/fd/[id]/renewals` — accepts `tenureDays`, `tenureText` per renewal entry.

Validation: at least one of `(tenureMonths > 0, tenureDays > 0)` must be true. Both zero is rejected with a 400.

## Forms

### New FD form (`fd-new-form.tsx`)

Replace the current single "Tenure (months)" field with two inputs:

```
Tenure *
[ Months ]  [ Days ]
```

- Both are number inputs. Defaults are empty.
- AI extraction populates both values + sets `tenureText` internally (not shown as an editable field).
- On submit: `tenureDays = parseInt(daysField || "0")`, `tenureMonths = parseInt(monthsField || "0")`. Reject if both zero.
- Prior-period blocks get the same two-field treatment. Each prior period keeps its own `tenureText` (from AI) through the form state.
- The form's internal `FDForm` type gains `tenureDays: string`. `PriorRenewal` gains `tenureDays: string`. Both forms keep `tenureText: string | null` in state but not in a visible field.
- Section-status validation (`sectionStatus` memo) updates: FD Details `complete` requires `tenureMonths || tenureDays`.

### Renew FD form (`fd-renew-form.tsx`)

Same two-field treatment. No AI extraction in renew (it's manual-only), so `tenureText` stays null there.

## Display Sites

All call `formatTenure(...)`:

- `src/app/dashboard/fd/fd-list.tsx` — each row's tenure cell / summary.
- `src/app/dashboard/fd/fd-detail-content.tsx` — detail panel tenure display.
- `src/app/dashboard/page.tsx` — any dashboard card that mentions tenure.
- `src/lib/analytics.ts` — if it produces text summaries involving tenure. Numeric aggregations (e.g., weighted-average tenure) use `tenureMonths + tenureDays/30` or similar explicit conversion.

## Interest Calculation

Wherever `tenureMonths` feeds maturity math, replace with total days:

```ts
const years = (fd.tenureMonths * 30 + fd.tenureDays) / 365;
```

This is the same approximation the current code uses, just extended to the days portion. Exact files will be identified during plan authoring.

## Validation & Error Handling

- Client: both Months and Days empty/zero → show "Enter tenure in months and/or days" under the field group, section-status goes to error.
- Server: same check; 400 with `{ error: "Tenure must be greater than 0" }`.
- `tenureText` is untrimmed-trusted from AI; stored as-is. Max length: 100 chars (truncate on server if longer to prevent abuse).

## Testing / Verification

Manual verification via preview tools after implementation:

1. Create FD via AI extract with a receipt that says "12 months 37 days" → FD list and detail render "12 months 37 days" verbatim.
2. Create FD manually with Months=6, Days=0 → list renders "6 months".
3. Create FD manually with Months=0, Days=45 → list renders "45 days".
4. Create FD manually with Months=0, Days=0 → submit blocked, error shown.
5. Existing FDs (rows present before migration) render their `tenureMonths` as before, since `tenureDays = 0` and `tenureText = null`.
6. Renew form accepts Months + Days; renewal displays correctly on the detail page's renewal history.

## Affected Files

| Path | Change |
| --- | --- |
| `prisma/schema.prisma` | Add `tenureDays`, `tenureText` on `FixedDeposit` and `FDRenewal` |
| (Turso DB) | 4 ALTER TABLE statements |
| `src/lib/format.ts` (or existing util) | Add `formatTenure()` helper |
| `src/app/api/fd/extract/route.ts` | AI output schema + prompt update |
| `src/app/api/fd/route.ts` | Accept `tenureDays`, `tenureText`; min-1 validation |
| `src/app/api/fd/[id]/route.ts` | Accept new fields (may already pass-through via body spread) |
| `src/app/api/fd/[id]/renewals/route.ts` | Accept new fields per renewal |
| `src/app/dashboard/fd/new/fd-new-form.tsx` | Two-field tenure input; prior-period blocks; sectionStatus |
| `src/app/dashboard/fd/renew/[id]/fd-renew-form.tsx` | Two-field tenure input |
| `src/app/dashboard/fd/fd-list.tsx` | Use `formatTenure()` |
| `src/app/dashboard/fd/fd-detail-content.tsx` | Use `formatTenure()` |
| `src/app/dashboard/page.tsx` | Use `formatTenure()` if renders tenure |
| `src/lib/analytics.ts` | Update any tenure-consuming math |

## Risks

- AI may hallucinate `tenureText` if receipt uses unusual phrasing ("1 yr 6 mo"). Mitigation: prompt is explicit, and user can re-scan or ignore.
- The `tenureMonths * 30` approximation is unchanged from existing code — not a regression.
- Dashboard/analytics places that sort or aggregate by `tenureMonths` (ignoring days) get a small relative miscount. Acceptable, since days are typically <30.
