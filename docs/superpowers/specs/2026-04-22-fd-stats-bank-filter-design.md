# FD Stats Reactive to Bank Filter

**Date:** 2026-04-22

## Problem

The 6 summary stat cards on the FD list page (Total FD Corpus, Avg Interest Rate, Active Deposits, Interest This Year, Total Principal, Total Interest Earned) are computed server-side in `page.tsx` across all FDs. The bank filter lives in client state inside `fd-list.tsx`. As a result, selecting a bank from the filter dropdown updates the table rows but leaves the stat cards unchanged.

## Goal

When a bank is selected in the filter dropdown, all 6 stat cards update to reflect only that bank's non-disabled FDs.

## Approach

Move stat computation and stat card rendering from the server component (`page.tsx`) into the client component (`fd-list.tsx`), where `bankFilter` state is available.

## Changes

### `src/app/dashboard/fd/page.tsx`

- Remove all stat computation: `resolved`, `totalPrincipal`, `totalMaturity`, `totalInterest`, `activeFDs`, `avgRate`, `interestThisYear`
- Remove the two stat grid `<div>` blocks (4-card top row + 2-card bottom row)
- Remove the `formatINR` import (no longer needed here)
- `page.tsx` becomes a thin data-fetching shell that renders `<FDList fds={fds} />`

### `src/app/dashboard/fd/fd-list.tsx`

- Add a `useMemo` that computes `resolvedForStats`: non-disabled FDs filtered by `bankFilter`, each resolved to latest-renewal values via the existing `resolveCurrent()` helper. Keyed on `[fds, bankFilter]`.
- Derive all 6 stats from `resolvedForStats` (same formulas as current server code):
  - `totalPrincipal`
  - `totalMaturity` → displayed as "Total FD Corpus"
  - `totalInterest` = `totalMaturity - totalPrincipal`
  - `activeFDs` = count where `maturityDate > now`
  - `avgRate` = mean of `interestRate` values
  - `interestThisYear` = calendar-year prorated interest sum
- Render both stat grids above the filter controls, preserving existing markup and styling exactly.
- Add `formatINR` import (already present in `fd-list.tsx`; verify it covers all usages).

## Behaviour

| Bank filter | Stats scope |
|---|---|
| All banks | All non-disabled FDs (same as today) |
| Specific bank | Non-disabled FDs for that bank only |

The active/matured/disabled tab filter does **not** affect stats — it is a table-view filter only. This matches current server behaviour where only disabled FDs are excluded from totals.

## Files Touched

- `src/app/dashboard/fd/page.tsx`
- `src/app/dashboard/fd/fd-list.tsx`
