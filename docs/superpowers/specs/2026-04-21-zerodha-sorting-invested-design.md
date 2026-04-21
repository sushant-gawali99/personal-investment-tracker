# Zerodha Sorting & Invested Column Design

**Date:** 2026-04-21
**Status:** Approved

## Overview

Two improvements to the Zerodha dashboard tables:
1. Default alphabetical sorting + sortable headers on both the Stocks (Holdings) and MF Holdings tables
2. A new "Invested" column per row on both tables showing `avg_price × qty`

All changes are client-side in `src/app/dashboard/zerodha/zerodha-dashboard.tsx`. No API, schema, or data-fetching changes required.

## Goals

- Holdings and MF Holdings tables default to alphabetical order by name/symbol
- All column headers on both tables are clickable to sort (asc/desc toggle)
- Each row shows its invested amount (cost basis) alongside current value, making the per-row P&L context immediately visible

## Out of Scope

- Positions table (intraday — excluded from this change)
- Persisting sort preference across sessions
- Server-side sorting

---

## Section 1: Stocks (Holdings) Table

### Default Sort

Change from `pnl` desc → `tradingsymbol` asc.

```ts
// Before
const [sortKey, setSortKey] = useState<keyof Holding>("pnl");
const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

// After
const [sortKey, setSortKey] = useState<keyof Holding>("tradingsymbol");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
```

### Symbol Header Sortable

The Symbol column header gets the same `onClick` handler already used by Qty, Avg Cost, LTP, P&L headers:

```tsx
<th onClick={() => toggleSort("tradingsymbol")} className="... cursor-pointer">
  Symbol {sortIndicator("tradingsymbol")}
</th>
```

### New "Invested" Column

Inserted between "Avg Cost" and "LTP".

**Header:**
```tsx
<th onClick={() => toggleSort("invested")} className="... cursor-pointer text-right">
  Invested {sortIndicator("invested")}
</th>
```

**Cell:**
```tsx
<td className="... text-right mono">{formatINR(h.average_price * h.quantity)}</td>
```

**Sort key:** `"invested"` is a derived value (`average_price * quantity`), not a field on `Holding`. The sort comparator handles it explicitly:

```ts
if (sortKey === "invested") {
  aVal = a.average_price * a.quantity;
  bVal = b.average_price * b.quantity;
}
```

The `sortKey` type needs to accommodate `"invested"` alongside `keyof Holding` — use a union type:

```ts
type HoldingSortKey = keyof Holding | "invested";
const [sortKey, setSortKey] = useState<HoldingSortKey>("tradingsymbol");
```

---

## Section 2: MF Holdings Table

### New Sort State

Add alongside the existing holdings sort state:

```ts
type MFSortKey = keyof MFHolding | "invested";
const [mfSortKey, setMfSortKey] = useState<MFSortKey>("fund");
const [mfSortDir, setMfSortDir] = useState<"asc" | "desc">("asc");
```

### Toggle Handler

```ts
function toggleMfSort(key: MFSortKey) {
  if (mfSortKey === key) setMfSortDir((d) => (d === "asc" ? "desc" : "asc"));
  else { setMfSortKey(key); setMfSortDir("asc"); }
}
```

### Sorted MF Holdings (useMemo)

```ts
const sortedMfHoldings = useMemo(() => {
  return [...mfHoldings].sort((a, b) => {
    let aVal: string | number = mfSortKey === "invested"
      ? a.average_price * a.quantity
      : (a[mfSortKey as keyof MFHolding] ?? 0);
    let bVal: string | number = mfSortKey === "invested"
      ? b.average_price * b.quantity
      : (b[mfSortKey as keyof MFHolding] ?? 0);
    if (typeof aVal === "string") return mfSortDir === "asc"
      ? aVal.localeCompare(bVal as string)
      : (bVal as string).localeCompare(aVal);
    return mfSortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });
}, [mfHoldings, mfSortKey, mfSortDir]);
```

### Sortable Headers & New "Invested" Column

All MF table headers become clickable. The "Invested" column is inserted between Avg NAV and Current NAV.

Column order: **Fund | Units | Avg NAV | Invested | Current NAV | Value | P&L**

The sort indicator uses the same `sortIndicator` helper pattern — a small `mfSortIndicator` variant keyed to `mfSortKey`/`mfSortDir`.

---

## Sort Indicators

Every sortable column header shows a visual indicator:

- **Active sorted column (asc):** `▲` in `#ededed` (bright)
- **Active sorted column (desc):** `▼` in `#ededed` (bright)
- **Inactive sortable column:** `▲▼` stacked (or `⇅`) in `#a0a0a5` (muted) — signals the column is sortable but not currently active

Implemented as a helper function used by both tables:

```tsx
function SortIcon({ col, activeKey, dir }: { col: string; activeKey: string; dir: "asc" | "desc" }) {
  if (col !== activeKey) return <span className="text-[#a0a0a5] ml-1 text-[10px]">⇅</span>;
  return <span className="text-[#ededed] ml-1 text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>;
}
```

Used in headers as: `<SortIcon col="tradingsymbol" activeKey={sortKey} dir={sortDir} />`

---

## Implementation File

Single file changed: `src/app/dashboard/zerodha/zerodha-dashboard.tsx`
