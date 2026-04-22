# FD Tenure with Days + Verbatim Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend FD tenure handling to capture a separate days component and a verbatim label from the certificate, while preserving exact behavior for every row that exists today.

**Architecture:** Add two columns (`tenureDays Int @default(0)`, `tenureText String?`) to `FixedDeposit` and `FDRenewal`. A new `formatTenure(...)` helper centralizes display. AI extraction returns all three fields; both forms get a two-field tenure input (Months + Days). Interest math in `analytics.ts` shifts from `tenureMonths / 12` to `tenureMonths / 12 + tenureDays / 365`, which is exact when `tenureDays = 0` (i.e., all pre-existing rows).

**Tech Stack:** Next.js 16 App Router, Prisma 7 + LibSQL/Turso, React client components, TypeScript, Tailwind CSS, Anthropic SDK for AI extraction.

**Spec:** `docs/superpowers/specs/2026-04-22-fd-tenure-days-design.md`

---

## File Map

| Path | Change | Reason |
| --- | --- | --- |
| `prisma/schema.prisma` | **Modify** | Add `tenureDays`, `tenureText` to `FixedDeposit` + `FDRenewal` |
| (Turso DB) | **DDL** | 4× `ALTER TABLE ... ADD COLUMN` |
| `src/lib/format.ts` | **Modify** | Add `formatTenure()` helper |
| `src/lib/analytics.ts` | **Modify** | Switch `tenureMonths / 12` → `tenureMonths / 12 + tenureDays / 365`; extend `FDSummaryInput` type |
| `src/app/api/fd/extract/route.ts` | **Modify** | AI schema + prompt return `tenureDays`, `tenureText` |
| `src/app/api/fd/route.ts` | **Modify** | POST accepts new fields; validation allows months-or-days > 0 |
| `src/app/api/fd/[id]/route.ts` | **Modify** | PATCH accepts new fields explicitly |
| `src/app/api/fd/[id]/renewals/route.ts` | **Modify** | Renewal POST accepts new fields |
| `src/app/dashboard/fd/new/fd-new-form.tsx` | **Modify** | Two-field tenure input, prior-period blocks, AI pre-fill, sectionStatus, submit payload |
| `src/app/dashboard/fd/new/page.tsx` | **Modify** | Prisma `select` adds new fields for renew pre-fill |
| `src/app/dashboard/fd/renew/[id]/fd-renew-form.tsx` | **Modify** | Two-field tenure input |
| `src/app/dashboard/fd/renew/[id]/page.tsx` | **Modify** | Prisma `select` adds new fields |
| `src/app/dashboard/fd/fd-list.tsx` | **Modify** | Use `formatTenure()` in rows; extend mapped type |
| `src/app/dashboard/fd/fd-detail-content.tsx` | **Modify** | Use `formatTenure()` |
| `src/app/dashboard/page.tsx` | **Modify** | Use `formatTenure()` if dashboard renders tenure text |

---

### Task 1: Schema + Turso DDL

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add columns in Prisma schema**

In `prisma/schema.prisma`, within the `FixedDeposit` model, immediately after the existing `tenureMonths   Int` line add:

```prisma
  tenureMonths   Int
  tenureDays     Int     @default(0)
  tenureText     String?
```

Within the `FDRenewal` model, after its `tenureMonths   Int` line, add the same two fields:

```prisma
  tenureMonths   Int
  tenureDays     Int     @default(0)
  tenureText     String?
```

- [ ] **Step 2: Apply the DDL to Turso**

Run these four statements directly against the Turso database (follow the same mechanism prior tasks used — the repo's convention is direct DDL, no Prisma migrations):

```sql
ALTER TABLE FixedDeposit ADD COLUMN tenureDays INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FixedDeposit ADD COLUMN tenureText TEXT;
ALTER TABLE FDRenewal    ADD COLUMN tenureDays INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FDRenewal    ADD COLUMN tenureText TEXT;
```

If Turso rejects `NOT NULL DEFAULT 0` on an existing table (some SQLite versions do), use two-step:

```sql
ALTER TABLE FixedDeposit ADD COLUMN tenureDays INTEGER DEFAULT 0;
UPDATE FixedDeposit SET tenureDays = 0 WHERE tenureDays IS NULL;
```

(and repeat for FDRenewal). The Prisma schema still declares NOT NULL; at the application level nulls are never written.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: successful generation, no errors.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: successful compilation. New columns are present on the generated types.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(fd): add tenureDays and tenureText columns"
```

No `Co-Authored-By` lines (repo convention).

---

### Task 2: `formatTenure` helper

**Files:**
- Modify: `src/lib/format.ts`

- [ ] **Step 1: Append the helper**

At the bottom of `src/lib/format.ts`, add:

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

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat(format): add formatTenure helper"
```

---

### Task 3: Analytics formula update

**Files:**
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: Extend the input type**

Find the type declaration around line 6 that contains `tenureMonths: number;`. Add `tenureDays: number;` on the next line:

```ts
  tenureMonths: number;
  tenureDays: number;
```

(Keep the rest of the type unchanged.)

If the file has more than one type that contains `tenureMonths`, extend each — run Grep first with pattern `tenureMonths: number` in `src/lib/analytics.ts` to confirm count.

- [ ] **Step 2: Update formula at line 35**

Find:

```ts
  const years = fd.tenureMonths / 12;
```

Replace with:

```ts
  const years = fd.tenureMonths / 12 + fd.tenureDays / 365;
```

- [ ] **Step 3: Update formula at line 126**

Find:

```ts
      ? fds.reduce((s, f) => s + (f.tenureMonths / 12) * f.principal, 0) / fd.totalPrincipal
```

Replace with:

```ts
      ? fds.reduce((s, f) => s + (f.tenureMonths / 12 + f.tenureDays / 365) * f.principal, 0) / fd.totalPrincipal
```

- [ ] **Step 4: Update call sites to pass `tenureDays`**

Grep for imports of analytics functions across `src/`. Any caller that builds an `FDSummaryInput`-shaped object must now include `tenureDays`. Most likely call sites are in page components that already receive FDs from Prisma — after Task 1 the Prisma result type already contains `tenureDays`, so spreading the FD object usually suffices.

Check specifically:
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/fd/page.tsx` (server component that produces the data for `fd-list`)
- `src/app/dashboard/fd/fd-list.tsx` (type mapping at line 45 area)

For each, add `tenureDays` wherever the existing code writes `tenureMonths`:

```ts
tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
tenureDays: latest?.tenureDays ?? fd.tenureDays,
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: success. TypeScript will flag any missed call site where the analytics input type requires `tenureDays` — fix each and rebuild until green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics.ts src/app/dashboard/page.tsx src/app/dashboard/fd/page.tsx src/app/dashboard/fd/fd-list.tsx
git commit -m "feat(analytics): include tenureDays in years calc"
```

(Adjust the file list to exactly the files you touched.)

---

### Task 4: Extract API — AI schema + prompt

**Files:**
- Modify: `src/app/api/fd/extract/route.ts`

- [ ] **Step 1: Extend the output schema section**

Find the comment-block or string literal that documents the expected JSON shape. Around line 18 the current line is:

```ts
  "tenureMonths": number,
```

Replace with three lines:

```ts
  "tenureMonths": number,
  "tenureDays": number,
  "tenureText": string | null,
```

- [ ] **Step 2: Extend `priorPeriods` schema**

Around line 29, the current entry shape is:

```ts
  "priorPeriods": Array<{ "startDate": "YYYY-MM-DD" | null, "maturityDate": "YYYY-MM-DD" | null, "principal": number | null, "interestRate": number | null, "tenureMonths": number | null, "maturityAmount": number | null }> | null
```

Replace with:

```ts
  "priorPeriods": Array<{ "startDate": "YYYY-MM-DD" | null, "maturityDate": "YYYY-MM-DD" | null, "principal": number | null, "interestRate": number | null, "tenureMonths": number | null, "tenureDays": number | null, "tenureText": string | null, "maturityAmount": number | null }> | null
```

- [ ] **Step 3: Update the prompt's tenure rule**

Around line 34:

```ts
- tenureMonths must be an integer (convert years to months if needed)
```

Replace with:

```ts
- tenureMonths must be an integer: the whole-months portion of the tenure (convert "1 year" → 12, "1.5 years" → 18; if the receipt says "45 days" only, tenureMonths is 0)
- tenureDays must be an integer: the leftover days beyond whole months (if the receipt says "12 months 37 days", tenureDays is 37; if it says "45 days", tenureDays is 45; if it says only "6 months", tenureDays is 0)
- tenureText is the verbatim tenure label as printed on the receipt (e.g., "12 months 37 days", "1 year 2 months", "45 days"). Preserve wording, units, and spacing exactly. If no tenure label is legible, set tenureText to null.
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/fd/extract/route.ts
git commit -m "feat(fd-extract): return tenureDays and tenureText"
```

---

### Task 5: `POST /api/fd`

**Files:**
- Modify: `src/app/api/fd/route.ts`

- [ ] **Step 1: Extend destructured fields**

Around line 25:

```ts
    tenureMonths, startDate, maturityDate, maturityAmount,
```

Extend to include new fields:

```ts
    tenureMonths, tenureDays, tenureText, startDate, maturityDate, maturityAmount,
```

Also extend the `renewals` destructuring comment on line 29 to include the new fields (just update the comment — the destructuring is already `renewals` on its own).

- [ ] **Step 2: Update validation at line 32**

Current:

```ts
  if (!bankName || !principal || !interestRate || !tenureMonths || !startDate || !maturityDate) {
```

Replace with a months-or-days check:

```ts
  if (!bankName || !principal || !interestRate || !startDate || !maturityDate) {
```

Then, directly below that block, add:

```ts
  const tenureMonthsNum = Number(tenureMonths) || 0;
  const tenureDaysNum = Number(tenureDays) || 0;
  if (tenureMonthsNum <= 0 && tenureDaysNum <= 0) {
    return NextResponse.json({ error: "Tenure must be greater than 0 (months or days)" }, { status: 400 });
  }
```

(Adjust the import / return shape to match the existing file's style — the file already uses `NextResponse.json`; keep that.)

- [ ] **Step 3: Pass new fields to Prisma create**

Around line 61:

```ts
        tenureMonths: Number(tenureMonths),
```

Replace with:

```ts
        tenureMonths: tenureMonthsNum,
        tenureDays: tenureDaysNum,
        tenureText: typeof tenureText === "string" && tenureText.trim() ? tenureText.trim().slice(0, 100) : null,
```

- [ ] **Step 4: Extend renewals inline type and create**

Around line 79 the renewals filter is typed:

```ts
      const validRenewals = renewals.filter((r: { startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number }) =>
        r.startDate && r.maturityDate && !isNaN(new Date(r.startDate).getTime()) && !isNaN(new Date(r.maturityDate).getTime()) && Number(r.principal) > 0 && Number(r.interestRate) > 0 && Number(r.tenureMonths) > 0
      );
```

Change the type to include new fields and adjust the validation so a renewal is valid if months OR days is positive:

```ts
      const validRenewals = renewals.filter((r: { startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number; tenureDays?: number; tenureText?: string | null }) =>
        r.startDate && r.maturityDate && !isNaN(new Date(r.startDate).getTime()) && !isNaN(new Date(r.maturityDate).getTime()) && Number(r.principal) > 0 && Number(r.interestRate) > 0 && (Number(r.tenureMonths) > 0 || Number(r.tenureDays) > 0)
      );
```

Around line 83, the `data: validRenewals.map(...)` maps each renewal for Prisma. Extend its parameter type and output:

```ts
        data: validRenewals.map((r: { renewalNumber: number; startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number; tenureDays?: number; tenureText?: string | null; maturityAmount?: number; maturityInstruction?: string; payoutFrequency?: string }) => ({
          // ...existing fields up through tenureMonths...
          tenureMonths: Number(r.tenureMonths) || 0,
          tenureDays: Number(r.tenureDays) || 0,
          tenureText: typeof r.tenureText === "string" && r.tenureText.trim() ? r.tenureText.trim().slice(0, 100) : null,
          // ...rest unchanged...
        })),
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/fd/route.ts
git commit -m "feat(api): POST /api/fd accepts tenureDays and tenureText"
```

---

### Task 6: `PATCH /api/fd/[id]`

**Files:**
- Modify: `src/app/api/fd/[id]/route.ts`

- [ ] **Step 1: Extend the update data**

Around line 24:

```ts
      tenureMonths: body.tenureMonths ? Number(body.tenureMonths) : undefined,
```

Add two lines immediately after:

```ts
      tenureMonths: body.tenureMonths !== undefined ? Number(body.tenureMonths) : undefined,
      tenureDays: body.tenureDays !== undefined ? Number(body.tenureDays) : undefined,
      tenureText: body.tenureText !== undefined ? (typeof body.tenureText === "string" && body.tenureText.trim() ? body.tenureText.trim().slice(0, 100) : null) : undefined,
```

(Note: the `tenureMonths` line itself changes from `body.tenureMonths ?` to `body.tenureMonths !== undefined ?` — a bug fix that lets callers explicitly set `0` without the truthy check stripping it.)

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fd/[id]/route.ts
git commit -m "feat(api): PATCH accepts tenureDays and tenureText"
```

---

### Task 7: `POST /api/fd/[id]/renewals`

**Files:**
- Modify: `src/app/api/fd/[id]/renewals/route.ts`

- [ ] **Step 1: Destructure and validate**

Around line 15:

```ts
  const { startDate, maturityDate, principal, interestRate, tenureMonths, maturityAmount, maturityInstruction, payoutFrequency } = body;
```

Replace with:

```ts
  const { startDate, maturityDate, principal, interestRate, tenureMonths, tenureDays, tenureText, maturityAmount, maturityInstruction, payoutFrequency } = body;
```

Around line 17:

```ts
  if (!startDate || !maturityDate || !principal || !interestRate || !tenureMonths) {
```

Replace with:

```ts
  const tenureMonthsNum = Number(tenureMonths) || 0;
  const tenureDaysNum = Number(tenureDays) || 0;
  if (!startDate || !maturityDate || !principal || !interestRate || (tenureMonthsNum <= 0 && tenureDaysNum <= 0)) {
```

- [ ] **Step 2: Create payload**

Around line 31:

```ts
      tenureMonths: Number(tenureMonths),
```

Replace with:

```ts
      tenureMonths: tenureMonthsNum,
      tenureDays: tenureDaysNum,
      tenureText: typeof tenureText === "string" && tenureText.trim() ? tenureText.trim().slice(0, 100) : null,
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/fd/[id]/renewals/route.ts
git commit -m "feat(api): renewals POST accepts tenureDays and tenureText"
```

---

### Task 8: `FDNewForm` — two-field tenure input + AI fill + submit

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Extend the `FDForm` type and its empty constructor**

Around line 81:

```ts
interface FDForm {
  bankName: string; fdNumber: string; accountNumber: string;
  principal: string; interestRate: string; tenureMonths: string;
  ...
}
```

Add `tenureDays: string;` and `tenureText: string;` after `tenureMonths: string;`:

```ts
  principal: string; interestRate: string; tenureMonths: string; tenureDays: string; tenureText: string;
```

Extend `empty` (around line 91):

```ts
  principal: "", interestRate: "", tenureMonths: "", tenureDays: "", tenureText: "",
```

- [ ] **Step 2: Extend `PriorRenewal` type and `emptyPrior`**

Around line 230:

```ts
type PriorRenewal = { startDate: string; maturityDate: string; principal: string; interestRate: string; tenureMonths: string; maturityAmount: string };
const emptyPrior = (): PriorRenewal => ({ startDate: "", maturityDate: "", principal: "", interestRate: "", tenureMonths: "", maturityAmount: "" });
```

Replace with:

```ts
type PriorRenewal = { startDate: string; maturityDate: string; principal: string; interestRate: string; tenureMonths: string; tenureDays: string; tenureText: string; maturityAmount: string };
const emptyPrior = (): PriorRenewal => ({ startDate: "", maturityDate: "", principal: "", interestRate: "", tenureMonths: "", tenureDays: "", tenureText: "", maturityAmount: "" });
```

- [ ] **Step 3: Extend `RenewedFrom` type and initial form pre-fill**

Around line 233, the `RenewedFrom` type has `tenureMonths: number`. Add `tenureDays: number; tenureText: string | null`:

```ts
type RenewedFrom = { id: string; bankName: string; fdNumber: string | null; principal: number; maturityDate: Date | string; interestRate: number; tenureMonths: number; tenureDays: number; tenureText: string | null; nomineeName: string | null; nomineeRelation: string | null } | null;
```

Around line 333 where the form state is initialized from `renewedFrom`:

```ts
    tenureMonths: renewedFrom.tenureMonths.toString(),
```

Add immediately after:

```ts
    tenureMonths: renewedFrom.tenureMonths.toString(),
    tenureDays: renewedFrom.tenureDays.toString(),
    tenureText: renewedFrom.tenureText ?? "",
```

- [ ] **Step 4: Update section-status required-fields check**

Around line 367, the `detailsRequired` array includes `form.tenureMonths`. Replace that entry with a months-or-days check. Current:

```ts
  const detailsRequired = [
    form.bankName,
    form.principal,
    form.interestRate,
    form.tenureMonths,
    form.startDate,
    form.maturityDate,
    form.interestType,
  ];
  const detailsFilled = detailsRequired.filter((v) => v && v.trim() !== "").length;
```

Replace with:

```ts
  const detailsRequired = [
    form.bankName,
    form.principal,
    form.interestRate,
    form.startDate,
    form.maturityDate,
    form.interestType,
  ];
  const hasTenure = (form.tenureMonths && form.tenureMonths.trim() !== "" && parseInt(form.tenureMonths) > 0)
    || (form.tenureDays && form.tenureDays.trim() !== "" && parseInt(form.tenureDays) > 0);
  const detailsFilled = detailsRequired.filter((v) => v && v.trim() !== "").length + (hasTenure ? 1 : 0);
```

Also update the `detailsFilled === detailsRequired.length` check a few lines below to match — since we split tenure out of `detailsRequired` but still count it in `detailsFilled`, the target is `detailsRequired.length + 1`. Find:

```ts
    details: statusFor(
      "details",
      detailsFilled === detailsRequired.length ? "complete" : detailsFilled === 0 ? "empty" : "partial"
    ),
```

Replace with:

```ts
    details: statusFor(
      "details",
      detailsFilled === detailsRequired.length + 1 ? "complete" : detailsFilled === 0 ? "empty" : "partial"
    ),
```

- [ ] **Step 5: Update prior-period filled/complete predicates**

Around line 375:

```ts
    r.startDate && r.maturityDate && r.principal && r.interestRate && r.tenureMonths
```

Replace with:

```ts
    r.startDate && r.maturityDate && r.principal && r.interestRate && (r.tenureMonths || r.tenureDays)
```

Around line 378:

```ts
    r.startDate || r.maturityDate || r.principal || r.interestRate || r.tenureMonths
```

Replace with:

```ts
    r.startDate || r.maturityDate || r.principal || r.interestRate || r.tenureMonths || r.tenureDays
```

- [ ] **Step 6: Update AI-extraction setters**

Around line 482 inside `handleExtract`:

```ts
        tenureMonths: e.tenureMonths?.toString() ?? "",
```

Add immediately after, before the next field:

```ts
        tenureMonths: e.tenureMonths?.toString() ?? "",
        tenureDays: e.tenureDays?.toString() ?? "",
        tenureText: e.tenureText ?? "",
```

Around line 507 within the prior-period mapping:

```ts
              tenureMonths: p.tenureMonths != null ? p.tenureMonths.toString() : "",
```

Add:

```ts
              tenureMonths: p.tenureMonths != null ? p.tenureMonths.toString() : "",
              tenureDays: p.tenureDays != null ? p.tenureDays.toString() : "",
              tenureText: p.tenureText ?? "",
```

- [ ] **Step 7: Update submit validation (handleSubmit missing check)**

Around line 537:

```ts
const detailsMissing =
  !form.bankName || !form.principal || !form.interestRate ||
  !form.tenureMonths || !form.startDate || !form.maturityDate || !form.interestType;
```

Replace with:

```ts
const tenureMonthsNum = parseInt(form.tenureMonths || "0") || 0;
const tenureDaysNum = parseInt(form.tenureDays || "0") || 0;
const detailsMissing =
  !form.bankName || !form.principal || !form.interestRate ||
  (tenureMonthsNum <= 0 && tenureDaysNum <= 0) ||
  !form.startDate || !form.maturityDate || !form.interestType;
```

Around line 541 the prior-period missing check:

```ts
const priorMissing = priorRenewals.some(
  (r) => !r.startDate || !r.maturityDate || !r.principal || !r.interestRate || !r.tenureMonths
);
```

Replace with:

```ts
const priorMissing = priorRenewals.some(
  (r) => !r.startDate || !r.maturityDate || !r.principal || !r.interestRate ||
    ((parseInt(r.tenureMonths || "0") || 0) <= 0 && (parseInt(r.tenureDays || "0") || 0) <= 0)
);
```

- [ ] **Step 8: Update submit payload**

Around line 590, replace the tenureMonths line in the body with both fields. Current:

```ts
          tenureMonths: priorRenewals.length > 0 ? parseInt(priorRenewals[0].tenureMonths) : parseInt(form.tenureMonths),
```

Replace with three lines:

```ts
          tenureMonths: priorRenewals.length > 0 ? (parseInt(priorRenewals[0].tenureMonths) || 0) : (parseInt(form.tenureMonths) || 0),
          tenureDays: priorRenewals.length > 0 ? (parseInt(priorRenewals[0].tenureDays) || 0) : (parseInt(form.tenureDays) || 0),
          tenureText: priorRenewals.length > 0 ? (priorRenewals[0].tenureText || null) : (form.tenureText || null),
```

Around line 608 (renewals mapping in the submit body):

```ts
                tenureMonths: parseInt(r.tenureMonths),
```

Replace with:

```ts
                tenureMonths: parseInt(r.tenureMonths) || 0,
                tenureDays: parseInt(r.tenureDays) || 0,
                tenureText: r.tenureText || null,
```

Around line 617 (the "current as last renewal" entry):

```ts
                tenureMonths: parseInt(form.tenureMonths),
```

Replace with:

```ts
                tenureMonths: parseInt(form.tenureMonths) || 0,
                tenureDays: parseInt(form.tenureDays) || 0,
                tenureText: form.tenureText || null,
```

- [ ] **Step 9: Prior-period UI inputs**

Around line 844, the array of prior-period fields renders:

```ts
            { label: "Principal (₹)", key: "principal" },
            { label: "Interest Rate (% p.a.)", key: "interestRate" },
            { label: "Tenure (months)", key: "tenureMonths" },
            { label: "Maturity Amount (₹)", key: "maturityAmount" },
```

Remove the `"Tenure (months)"` entry from that array (it will become a dedicated two-field row rendered next to Principal/Interest). Replace with:

```ts
            { label: "Principal (₹)", key: "principal" },
            { label: "Interest Rate (% p.a.)", key: "interestRate" },
            { label: "Maturity Amount (₹)", key: "maturityAmount" },
```

Then, inside the same `{[...].map(...)}` wrapper's parent grid, immediately after the closing `))}` of that `.map`, insert a dedicated tenure group that renders months + days side by side:

```tsx
            <div>
              <label className="ab-label">Tenure (months)</label>
              <input
                type="number"
                min="0"
                className="ab-input mono"
                value={r.tenureMonths}
                onChange={(e) => setPriorRenewals((prev) => prev.map((p, j) => j === i ? { ...p, tenureMonths: e.target.value } : p))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="ab-label">Tenure (days)</label>
              <input
                type="number"
                min="0"
                className="ab-input mono"
                value={r.tenureDays}
                onChange={(e) => setPriorRenewals((prev) => prev.map((p, j) => j === i ? { ...p, tenureDays: e.target.value } : p))}
                placeholder="0"
              />
            </div>
```

Place these two `<div>` blocks inside the same grid container as the other prior-period inputs (i.e., as siblings of the `.map` output). The enclosing grid is `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` (per Task 9 of the prior plan); the two tenure inputs occupy two of its cells.

- [ ] **Step 10: Main FD Details tenure input**

Around line 891 the current single-field input:

```tsx
          <div>
            <label htmlFor="tenureMonths" className="ab-label">Tenure (months) *</label>
            <input id="tenureMonths" type="number" min="1" className="ab-input mono" value={form.tenureMonths} onChange={(e) => set("tenureMonths", e.target.value)} placeholder="24" required />
          </div>
```

Replace with two adjacent `<div>` blocks (the enclosing grid is `sm:grid-cols-2 lg:grid-cols-3`, so two cells is fine):

```tsx
          <div>
            <label htmlFor="tenureMonths" className="ab-label">Tenure (months) *</label>
            <input
              id="tenureMonths"
              type="number"
              min="0"
              className="ab-input mono"
              value={form.tenureMonths}
              onChange={(e) => set("tenureMonths", e.target.value)}
              placeholder="24"
            />
          </div>
          <div>
            <label htmlFor="tenureDays" className="ab-label">Tenure (days) *</label>
            <input
              id="tenureDays"
              type="number"
              min="0"
              className="ab-input mono"
              value={form.tenureDays}
              onChange={(e) => set("tenureDays", e.target.value)}
              placeholder="0"
            />
          </div>
```

Note: `required` is removed from both (custom submit validation enforces "at least one > 0"). The asterisk stays on both labels as a UI cue.

- [ ] **Step 11: Verify build**

```bash
npm run build
```

Fix any type errors. Expected: clean build.

- [ ] **Step 12: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): Months + Days tenure inputs and AI/verbatim label"
```

---

### Task 9: New-FD page Prisma select + renew page pre-fill

**Files:**
- Modify: `src/app/dashboard/fd/new/page.tsx`
- Modify: `src/app/dashboard/fd/renew/[id]/page.tsx`

- [ ] **Step 1: Extend `select` in new/page.tsx**

Find (around line 13):

```ts
      select: { id: true, bankName: true, fdNumber: true, principal: true, maturityDate: true, interestRate: true, tenureMonths: true, nomineeName: true, nomineeRelation: true },
```

Replace with:

```ts
      select: { id: true, bankName: true, fdNumber: true, principal: true, maturityDate: true, interestRate: true, tenureMonths: true, tenureDays: true, tenureText: true, nomineeName: true, nomineeRelation: true },
```

- [ ] **Step 2: Extend pass-through in renew/[id]/page.tsx**

Around line 39 (the object that builds `fd` for the renew form):

```ts
        tenureMonths: fd.tenureMonths,
```

Add:

```ts
        tenureMonths: fd.tenureMonths,
        tenureDays: fd.tenureDays,
        tenureText: fd.tenureText,
```

Also ensure any `select` upstream includes the new fields — look at the Prisma query at the top of the file and add `tenureDays: true, tenureText: true` to its `select` clause if present.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/new/page.tsx src/app/dashboard/fd/renew/[id]/page.tsx
git commit -m "feat(fd): pass tenureDays and tenureText through FD fetches"
```

---

### Task 10: `FDRenewForm` — two-field tenure

**Files:**
- Modify: `src/app/dashboard/fd/renew/[id]/fd-renew-form.tsx`

- [ ] **Step 1: Extend props type**

Around line 14 inside the `fd` prop type:

```ts
    tenureMonths: number;
```

Add:

```ts
    tenureMonths: number;
    tenureDays: number;
    tenureText: string | null;
```

- [ ] **Step 2: Local state**

Around line 37:

```ts
  const [tenureMonths, setTenureMonths] = useState(fd.tenureMonths.toString());
```

Add immediately after:

```ts
  const [tenureDays, setTenureDays] = useState(fd.tenureDays.toString());
```

(`tenureText` is not exposed as an editable field per the spec — manual entry derives via smart-concat. We still pass `null` on submit so the server uses smart-concat via `formatTenure` later.)

- [ ] **Step 3: Update submit payload**

Around line 70:

```ts
          tenureMonths: parseInt(tenureMonths),
```

Replace with:

```ts
          tenureMonths: parseInt(tenureMonths) || 0,
          tenureDays: parseInt(tenureDays) || 0,
          tenureText: null,
```

Also, any submit-time guard that checks `tenureMonths` non-empty must allow days-only. Look for a validation block near the top of the submit handler; if it rejects empty `tenureMonths`, change to reject only when both are empty/zero.

- [ ] **Step 4: UI — two inputs side by side**

Around line 116:

```tsx
            <input type="number" min="1" className="ab-input mono" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} required />
```

Replace with two inputs (wrap in a two-column grid if the parent doesn't already do it):

```tsx
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                className="ab-input mono"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(e.target.value)}
                placeholder="Months"
              />
              <input
                type="number"
                min="0"
                className="ab-input mono"
                value={tenureDays}
                onChange={(e) => setTenureDays(e.target.value)}
                placeholder="Days"
              />
            </div>
```

Also update the label next to this input. Find the closest `<label ...>Tenure (months)...</label>` (or similar) and change to `Tenure *` with a small helper below:

```tsx
            <label className="ab-label">Tenure *</label>
            <p className="text-[11px] text-[#a0a0a5] mb-1">Months and/or days — at least one must be &gt; 0.</p>
            {/* the <div className="grid grid-cols-2 gap-3"> block above */}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/fd/renew/[id]/fd-renew-form.tsx
git commit -m "feat(fd-renew): Months + Days tenure inputs"
```

---

### Task 11: Display sites use `formatTenure`

**Files:**
- Modify: `src/app/dashboard/fd/fd-list.tsx`
- Modify: `src/app/dashboard/fd/fd-detail-content.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: `fd-list.tsx`**

At the top of the file, ensure `formatTenure` is imported from `@/lib/format`:

```ts
import { formatTenure, /* ...existing imports... */ } from "@/lib/format";
```

Around line 45, extend the mapped type to include the new fields. Current:

```ts
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
```

Add:

```ts
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
      tenureDays: latest?.tenureDays ?? fd.tenureDays,
      tenureText: latest?.tenureText ?? fd.tenureText,
```

Also extend the TypeScript type for `current` if it's explicit (near the top).

Around line 204:

```tsx
                      <td className="px-4 py-3 text-[#a0a0a5]">{current.tenureMonths}m</td>
```

Replace with:

```tsx
                      <td className="px-4 py-3 text-[#a0a0a5]">{formatTenure(current)}</td>
```

The `current` object already has the three fields after the mapping change above.

- [ ] **Step 2: `fd-detail-content.tsx`**

Import `formatTenure`:

```ts
import { formatTenure, /* ...existing... */ } from "@/lib/format";
```

Extend the two type declarations on lines 15 and 28 that contain `tenureMonths: number;`. For each, add `tenureDays: number;` and `tenureText: string | null;` on the following lines.

Around line 107:

```ts
  const activeTenure = latest?.tenureMonths ?? fd.tenureMonths;
```

Change the shape of `activeTenure` to an object so we can pass to `formatTenure`:

```ts
  const activeTenure = {
    tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
    tenureDays: latest?.tenureDays ?? fd.tenureDays,
    tenureText: latest?.tenureText ?? fd.tenureText,
  };
```

Then find every use of `activeTenure` below this line and replace accordingly. If the JSX was `{activeTenure} months` (or similar), change to `{formatTenure(activeTenure)}`. Grep within the file for `activeTenure` usages and update each.

- [ ] **Step 3: `dashboard/page.tsx`**

Around line 27:

```ts
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
```

Add:

```ts
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
      tenureDays: latest?.tenureDays ?? fd.tenureDays,
      tenureText: latest?.tenureText ?? fd.tenureText,
```

If the file renders tenure text (grep for `tenureMonths`), import `formatTenure` from `@/lib/format` and use it.

Also confirm the Prisma `select` that produced this `fd` / `latest` includes `tenureDays: true, tenureText: true`. If the query is in this file, update it; if elsewhere (e.g., a data helper), update there. The schema exposes them, but `select` filters them out unless listed.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Fix any type errors. Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/fd/fd-list.tsx src/app/dashboard/fd/fd-detail-content.tsx src/app/dashboard/page.tsx
git commit -m "feat(fd-ui): render tenure via formatTenure helper"
```

---

### Task 12: End-to-end manual verification

**Files:** none

- [ ] **Step 1: Existing-data parity**

With dev server running:

1. Open `/dashboard/fd` — every row still shows tenure as before (e.g., "24 months" instead of "24m"; small display polish is fine). Take screenshot for diff.
2. Open an existing FD detail page — active tenure displays the same way it did before this change.
3. Open dashboard page — any tenure-related metric reads identically to pre-change values. Weighted-average tenure, projected maturities: unchanged.

- [ ] **Step 2: New-FD flow (manual)**

At `/dashboard/fd/new`:

1. Fill Bank Name, Principal, Interest Rate, **Months = 12, Days = 37**, Start Date, Maturity Date, Interest Type. Save.
2. On list + detail, the tenure displays "12 months 37 days".
3. Create another FD with Months = 0, Days = 45. Displays "45 days".
4. Create another FD with Months = 6, Days = 0. Displays "6 months".
5. Try Months = 0, Days = 0 — submit is blocked; "details" section marked with red dot.

- [ ] **Step 3: New-FD flow (AI extract)**

Upload a receipt that has a day-level tenure (or mocked). After extract, both Months and Days fields are populated, and after saving, the list displays the receipt's verbatim text (`tenureText`) rather than the smart-concat fallback.

- [ ] **Step 4: Renew flow**

On an existing FD's detail page, click Renew. The renew form pre-fills Months + Days from the existing FD. Change Days to 15, save. The list shows the new tenure via `formatTenure`.

- [ ] **Step 5: Regression checks**

- `npm run build` passes.
- Open the Zerodha section and settings page — confirm unrelated pages still render.
- `git status` is clean after all commits.

---

## Self-Review Notes

**Spec coverage**
- Schema `tenureDays` + `tenureText` on both tables → Task 1.
- Turso DDL → Task 1 step 2.
- `formatTenure` helper → Task 2.
- AI extraction schema + prompt → Task 4.
- API POST/PATCH/renewals accept new fields → Tasks 5, 6, 7.
- New-FD form (main + prior periods) two-field input, AI pre-fill, section-status validation, submit payload → Task 8.
- New-FD and renew pages' Prisma `select` include new fields → Tasks 9.
- Renew form two-field input → Task 10.
- Display sites (list, detail, dashboard) → Task 11.
- Existing-data no-op: verified in Task 12 step 1.
- Interest formula change: Task 3.

**Risks**
- Some `tenureMonths` usages might not be caught by grep alone (e.g., template strings). The `npm run build` gate after each task will surface type errors — if a display site still pretty-prints `tenureMonths`, it'll continue to work (unchanged column) but won't pick up days/text until migrated in Task 11.
- AI extraction depends on the model correctly splitting "1 year 2 months" into months=14/days=0. Prompt is explicit; fallback is that the user edits the two fields after extraction.
- The renew form's existing `required` constraint on `tenureMonths` is removed in Task 10; if there was a native-validation behavior the user relied on, that's now server/client custom logic instead. Acceptable per spec.
