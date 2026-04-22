# FD Stats Reactive to Bank Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a bank is selected in the FD list filter dropdown, all 6 summary stat cards update to reflect only that bank's non-disabled FDs.

**Architecture:** Move stat computation and card rendering out of the server component (`page.tsx`) into the client component (`fd-list.tsx`). A `useMemo` keyed on `[fds, bankFilter]` derives all 6 stats from the bank-filtered, non-disabled FD set using the existing `resolveCurrent()` helper already present in `fd-list.tsx`.

**Tech Stack:** Next.js (App Router), React `useMemo`, TypeScript, Tailwind CSS / existing `ab-card` design tokens.

---

### Task 1: Add reactive stat computation and card rendering to `fd-list.tsx`

**Files:**
- Modify: `src/app/dashboard/fd/fd-list.tsx`

- [ ] **Step 1: Add `useMemo` import**

At line 4 of `fd-list.tsx`, `useState` and `Fragment` are already imported from React. Add `useMemo` to that import:

```tsx
import { useState, Fragment, useMemo } from "react";
```

- [ ] **Step 2: Add the stat computation `useMemo` inside `FDList`**

Insert this block immediately after the `const now = new Date();` line (currently line 42), before `normalizeBankName`:

```tsx
const resolvedForStats = useMemo(() => {
  const statsNow = new Date();
  const yearStart = new Date(statsNow.getFullYear(), 0, 1);
  const yearEnd = new Date(statsNow.getFullYear(), 11, 31);

  return fds
    .filter((fd) => {
      if (fd.disabled) return false;
      if (bankFilter !== "all" && normalizeBankName(fd.bankName) !== bankFilter) return false;
      return true;
    })
    .map((fd) => {
      const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
      const principal = latest?.principal ?? fd.principal;
      const interestRate = latest?.interestRate ?? fd.interestRate;
      const maturityAmount = latest?.maturityAmount ?? fd.maturityAmount;
      const startDate = new Date(latest?.startDate ?? fd.startDate);
      const maturityDate = new Date(latest?.maturityDate ?? fd.maturityDate);

      const overlapStart = startDate < yearStart ? yearStart : startDate;
      const overlapEnd = maturityDate > yearEnd ? yearEnd : maturityDate;
      const daysInYear = overlapStart < overlapEnd
        ? (overlapEnd.getTime() - overlapStart.getTime()) / 86400000
        : 0;
      const interestThisYear = (principal * interestRate / 100) * (daysInYear / 365);

      return { principal, interestRate, maturityAmount, maturityDate, interestThisYear, statsNow };
    });
}, [fds, bankFilter]); // eslint-disable-line react-hooks/exhaustive-deps

const stats = useMemo(() => {
  const totalPrincipal = resolvedForStats.reduce((s, r) => s + r.principal, 0);
  const totalMaturity = resolvedForStats.reduce((s, r) => s + (r.maturityAmount ?? r.principal), 0);
  const totalInterest = totalMaturity - totalPrincipal;
  const activeFDs = resolvedForStats.filter((r) => r.maturityDate > new Date()).length;
  const avgRate = resolvedForStats.length > 0
    ? resolvedForStats.reduce((s, r) => s + r.interestRate, 0) / resolvedForStats.length
    : 0;
  const interestThisYear = resolvedForStats.reduce((s, r) => s + r.interestThisYear, 0);
  return { totalPrincipal, totalMaturity, totalInterest, activeFDs, avgRate, interestThisYear };
}, [resolvedForStats]);
```

Note: `normalizeBankName` is used inside the `useMemo` but defined after it in the file. Move `normalizeBankName` above the `useMemo` block, or hoist it to module scope (outside the component) since it has no dependencies. The simplest fix: move it to module scope just above `FDList`:

```tsx
function normalizeBankName(name: string) {
  return name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
}
```

Then remove the duplicate declaration of `normalizeBankName` from inside the component body (currently lines 44–46).

- [ ] **Step 3: Add the stat card grids inside the `FDList` return, above the filter controls**

Currently the component returns a `<div className="space-y-5">` containing the filter row and the table. Insert the two stat grids before the filter `<div>`:

```tsx
return (
  <div className="space-y-5">
    {/* ── Stat cards (reactive to bank filter) ── */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: "Total FD Corpus",   value: formatINR(stats.totalMaturity) },
        { label: "Avg Interest Rate", value: `${stats.avgRate.toFixed(2)}%` },
        { label: "Active Deposits",   value: String(stats.activeFDs) },
        { label: "Interest This Year", value: formatINR(stats.interestThisYear) },
      ].map(({ label, value }) => (
        <div key={label} className="ab-card p-4">
          <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
          <p className="mono text-[20px] font-semibold text-[#ededed]">{value}</p>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="ab-card-flat p-4 flex items-center justify-between">
        <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Principal</p>
        <p className="mono font-semibold text-[#ededed]">{formatINR(stats.totalPrincipal)}</p>
      </div>
      <div className="ab-card-flat p-4 flex items-center justify-between">
        <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Interest Earned</p>
        <p className="mono font-semibold text-[#5ee0a4]">{formatINR(stats.totalInterest)}</p>
      </div>
    </div>
    {/* ── end stat cards ── */}

    <div className="flex items-center gap-3 flex-wrap">
      {/* ... existing filter row unchanged ... */}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/fd/fd-list.tsx
git commit -m "feat(fd): add reactive stat cards to fd-list, keyed on bank filter"
```

---

### Task 2: Strip stat computation and card rendering from `page.tsx`

**Files:**
- Modify: `src/app/dashboard/fd/page.tsx`

- [ ] **Step 1: Remove the stat computation block**

Delete lines 16–46 in `page.tsx` (the entire block from the `// Summary stats resolve…` comment through `}, 0);`):

```tsx
// DELETE everything between these markers:
// "Summary stats resolve each FD to its latest-renewal values for totals."
// ...through...
// "}, 0);"
```

The file should go from the `include: { renewals: … }` line directly to `return (`.

- [ ] **Step 2: Remove the two stat grid `<div>` blocks from the JSX**

Delete the two conditional blocks:

```tsx
// DELETE:
{fds.length > 0 && (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {[
      { label: "Total FD Corpus", value: formatINR(totalMaturity) },
      ...
    ].map(...)}
  </div>
)}

// DELETE:
{fds.length > 0 && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    ...
  </div>
)}
```

- [ ] **Step 3: Remove unused imports from `page.tsx`**

`formatINR` is no longer used. Remove it from the import line:

```tsx
// Before:
import { formatINR } from "@/lib/format";

// After: delete this line entirely
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/fd/page.tsx
git commit -m "refactor(fd): remove server-side stat computation, now handled client-side"
```

---

### Task 3: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the FD list page**

Navigate to `http://localhost:3000/dashboard/fd`.

Verify:
- All 6 stat cards are visible (4-card top row + 2-card bottom row)
- Values match what was previously shown (no regression with "All banks" selected)

- [ ] **Step 3: Select a specific bank from the filter dropdown**

Pick any bank that has fewer FDs than the total.

Verify:
- "Total FD Corpus" changes to reflect only that bank's FDs
- "Avg Interest Rate" changes
- "Active Deposits" count changes
- "Interest This Year" changes
- "Total Principal" changes
- "Total Interest Earned" changes
- The table rows are also filtered to that bank (existing behaviour, should be unchanged)

- [ ] **Step 4: Switch back to "All banks"**

Verify all 6 stats return to the same values as Step 2 (full totals).

- [ ] **Step 5: Test the "disabled" tab interaction**

Switch to a bank filter, then click the "disabled" tab.

Verify: stat cards still show the bank-filtered non-disabled totals (the tab filter does not change stats, only table rows).
