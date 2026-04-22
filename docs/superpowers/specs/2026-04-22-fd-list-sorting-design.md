# FD List Sorting — Design Spec

**Date:** 2026-04-22

## Overview

Add client-side column sorting to the FD list table. Default order is maturity-ascending (soonest/already-matured first, as provided by the server). Users can additionally sort by Principal, Rate, Tenure, or At Maturity via clickable column headers.

## Scope

Single file change: `src/app/dashboard/fd/fd-list.tsx`. No server, database, or routing changes.

## Sort State

```ts
type SortCol = "principal" | "rate" | "tenure" | "atMaturity";
type SortDir = "asc" | "desc";
const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);
```

- `null` = default maturity order (data arrives pre-sorted by `maturityDate asc` from the server)
- Non-null = active column sort applied client-side after filtering

## Sorting Logic

After the existing `filtered` array is computed, derive `sorted`:

- If `sort` is `null`, use `filtered` unchanged.
- Otherwise, sort a copy of `filtered` by the resolved column value using `resolveCurrent()`:
  - `principal` → `current.principal`
  - `rate` → `current.interestRate`
  - `tenure` → `current.tenureMonths`
  - `atMaturity` → `current.maturityAmount ?? current.principal`
- Direction: ascending = smaller first, descending = larger first.

## Header Interaction

- Clicking an inactive sortable header sets that column with `asc` direction.
- Clicking the active header toggles `asc ↔ desc`.

## Visual Indicators

Sortable headers (Principal, Rate, Tenure, At Maturity):

- Inactive: faint `↕` icon (lucide `ChevronsUpDown`, 11px), pointer cursor, subtle hover text brightening.
- Active asc: `↑` icon (lucide `ChevronUp`, 11px), bright text.
- Active desc: `↓` icon (lucide `ChevronDown`, 11px), bright text.

Non-sortable headers (Bank, FD No., Duration, Status, Actions): unchanged, no icon, no pointer cursor.

## What Does Not Change

- Filter logic (status + bank filters)
- `resolveCurrent()` function
- Server query (`orderBy: { maturityDate: "asc" }`)
- Row expansion, detail content, disable button
