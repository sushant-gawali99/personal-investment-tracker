# Zerodha Sorting & Invested Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add alphabetical default sort, clickable sortable headers with ▲/▼/⇅ indicators, and a per-row "Invested" column to the Equity Holdings and Mutual Funds tables on the Zerodha dashboard.

**Architecture:** All changes are in a single client component `src/app/dashboard/zerodha/zerodha-dashboard.tsx`. Holdings already has sort state; we extend it to cover Symbol and a derived "invested" key. MF has no sort state; we add it at the component top level (hooks must not be inside the inline IIFE). A shared `SortIcon` component renders the indicator.

**Tech Stack:** React (useState, useMemo), TypeScript, Tailwind CSS, existing dark-theme CSS class conventions.

---

### Task 1: Holdings table — SortIcon component, default sort, Symbol + Invested sortable

**Files:**
- Modify: `src/app/dashboard/zerodha/zerodha-dashboard.tsx`

- [ ] **Step 1: Add `SortIcon` component**

After the closing `}` of `SymbolAvatar` (around line 83), insert:

```tsx
function SortIcon({ col, activeKey, dir }: { col: string; activeKey: string; dir: "asc" | "desc" }) {
  if (col !== activeKey) return <span className="text-[#a0a0a5] ml-1 text-[10px]">⇅</span>;
  return <span className="text-[#ededed] ml-1 text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>;
}
```

- [ ] **Step 2: Change `HoldingSortKey` type and default sort state**

Replace lines 87–88 in `ZerodhaDashboard`:

```ts
// Before
const [sortKey, setSortKey] = useState<keyof Holding>("pnl");
const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

// After — add type alias above component, or inline union
```

Add this type alias after the `MFHolding` interface (before line 40):

```ts
type HoldingSortKey = keyof Holding | "invested";
type MFSortKey = keyof MFHolding | "invested" | "value";
```

Then update the two useState lines inside `ZerodhaDashboard`:

```ts
const [sortKey, setSortKey] = useState<HoldingSortKey>("tradingsymbol");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
```

- [ ] **Step 3: Update `toggleSort` to use `HoldingSortKey` and default to asc**

Replace the existing `toggleSort` function:

```ts
function toggleSort(key: HoldingSortKey) {
  if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  else { setSortKey(key); setSortDir("asc"); }
}
```

- [ ] **Step 4: Update `filtered` useMemo to handle string and derived sort keys**

Replace the existing `filtered` useMemo:

```ts
const filtered = useMemo(() =>
  holdings
    .filter((h) => h.tradingsymbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "tradingsymbol") {
        return sortDir === "asc"
          ? a.tradingsymbol.localeCompare(b.tradingsymbol)
          : b.tradingsymbol.localeCompare(a.tradingsymbol);
      }
      const av = sortKey === "invested" ? a.average_price * a.quantity : a[sortKey as keyof Holding] as number;
      const bv = sortKey === "invested" ? b.average_price * b.quantity : b[sortKey as keyof Holding] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    }),
  [holdings, search, sortKey, sortDir]
);
```

- [ ] **Step 5: Update Holdings table headers to be sortable and show SortIcon**

Replace the `<thead>` block of the Holdings table (the `<tr>` with `<th>` elements):

```tsx
<tr>
  <th className={thL} onClick={() => toggleSort("tradingsymbol")}>Symbol <SortIcon col="tradingsymbol" activeKey={sortKey} dir={sortDir} /></th>
  <th className={thR} onClick={() => toggleSort("quantity")}>Qty <SortIcon col="quantity" activeKey={sortKey} dir={sortDir} /></th>
  <th className={thR} onClick={() => toggleSort("average_price")}>Avg Cost <SortIcon col="average_price" activeKey={sortKey} dir={sortDir} /></th>
  <th className={thR} onClick={() => toggleSort("invested")}>Invested <SortIcon col="invested" activeKey={sortKey} dir={sortDir} /></th>
  <th className={thR} onClick={() => toggleSort("last_price")}>LTP <SortIcon col="last_price" activeKey={sortKey} dir={sortDir} /></th>
  <th className={thR}>Value</th>
  <th className={thR} onClick={() => toggleSort("pnl")}>P&amp;L <SortIcon col="pnl" activeKey={sortKey} dir={sortDir} /></th>
</tr>
```

- [ ] **Step 6: Add Invested cell to each Holdings row and fix empty-row colSpan**

In the `filtered.map((h) => ...)` row, insert the Invested `<td>` between the Avg Cost cell and the LTP cell:

```tsx
<td className="px-4 py-3 text-right mono text-[#a0a0a5]">{formatINR(h.average_price)}</td>
<td className="px-4 py-3 text-right mono text-[#a0a0a5]">{formatINR(h.average_price * h.quantity)}</td>
<td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(h.last_price)}</td>
```

Also update the empty-state row's `colSpan` from `6` to `7`:

```tsx
<tr><td colSpan={7} className="px-4 py-10 text-center text-[#a0a0a5] text-[13px]">No holdings found.</td></tr>
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/zerodha/zerodha-dashboard.tsx
git commit -m "feat: sortable headers + Invested column on Holdings table"
```

---

### Task 2: MF table — sort state, sortable headers, Invested column

**Files:**
- Modify: `src/app/dashboard/zerodha/zerodha-dashboard.tsx`

- [ ] **Step 1: Add MF sort state and `toggleMfSort` at component top level**

After the `toggleSort` function, add:

```ts
const [mfSortKey, setMfSortKey] = useState<MFSortKey>("fund");
const [mfSortDir, setMfSortDir] = useState<"asc" | "desc">("asc");

function toggleMfSort(key: MFSortKey) {
  if (mfSortKey === key) setMfSortDir((d) => (d === "asc" ? "desc" : "asc"));
  else { setMfSortKey(key); setMfSortDir("asc"); }
}
```

- [ ] **Step 2: Add `sortedMfHoldings` useMemo at component top level**

After the `filtered` useMemo, add:

```ts
const sortedMfHoldings = useMemo(() => {
  return [...mfHoldings].sort((a, b) => {
    if (mfSortKey === "invested") {
      const av = a.average_price * a.quantity;
      const bv = b.average_price * b.quantity;
      return mfSortDir === "asc" ? av - bv : bv - av;
    }
    if (mfSortKey === "value") {
      const av = a.last_price * a.quantity;
      const bv = b.last_price * b.quantity;
      return mfSortDir === "asc" ? av - bv : bv - av;
    }
    const aRaw = a[mfSortKey as keyof MFHolding];
    const bRaw = b[mfSortKey as keyof MFHolding];
    if (typeof aRaw === "string" || aRaw === null) {
      const av = (aRaw ?? "") as string;
      const bv = ((bRaw ?? "") as string);
      return mfSortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const av = (aRaw ?? 0) as number;
    const bv = (bRaw ?? 0) as number;
    return mfSortDir === "asc" ? av - bv : bv - av;
  });
}, [mfHoldings, mfSortKey, mfSortDir]);
```

- [ ] **Step 3: Replace MF table headers with sortable versions**

Replace the `<thead><tr>` inside the MF table:

```tsx
<tr>
  <th className={thL} onClick={() => toggleMfSort("fund")}>Fund <SortIcon col="fund" activeKey={mfSortKey} dir={mfSortDir} /></th>
  <th className={thR} onClick={() => toggleMfSort("quantity")}>Units <SortIcon col="quantity" activeKey={mfSortKey} dir={mfSortDir} /></th>
  <th className={thR} onClick={() => toggleMfSort("average_price")}>Avg NAV <SortIcon col="average_price" activeKey={mfSortKey} dir={mfSortDir} /></th>
  <th className={thR} onClick={() => toggleMfSort("invested")}>Invested <SortIcon col="invested" activeKey={mfSortKey} dir={mfSortDir} /></th>
  <th className={thR} onClick={() => toggleMfSort("last_price")}>Current NAV <SortIcon col="last_price" activeKey={mfSortKey} dir={mfSortDir} /></th>
  <th className={thR} onClick={() => toggleMfSort("value")}>Value <SortIcon col="value" activeKey={mfSortKey} dir={mfSortDir} /></th>
  <th className={thR} onClick={() => toggleMfSort("pnl")}>P&amp;L <SortIcon col="pnl" activeKey={mfSortKey} dir={mfSortDir} /></th>
</tr>
```

- [ ] **Step 4: Replace `mfHoldings.map` with `sortedMfHoldings.map` and add Invested cell**

In the MF table body, change `mfHoldings.map((h) => {` to `sortedMfHoldings.map((h) => {`.

Then insert the Invested `<td>` between the Avg NAV cell and the Current NAV cell:

```tsx
<td className="px-4 py-3 text-right mono text-[#a0a0a5]">{formatINR(h.average_price)}</td>
<td className="px-4 py-3 text-right mono text-[#a0a0a5]">{formatINR(h.average_price * h.quantity)}</td>
<td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(h.last_price)}</td>
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/zerodha/zerodha-dashboard.tsx
git commit -m "feat: sortable headers + Invested column on MF Holdings table"
```

---

### Task 3: Build verification

**Files:** none

- [ ] **Step 1: Run production build**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npm run build
```

Expected: build completes with no errors. The Turbopack NFT warning on `upload/route.ts` is pre-existing and acceptable.

- [ ] **Step 2: Commit if any build-time fixes were needed**

If the build surfaces errors not caught by `tsc --noEmit`, fix and commit:

```bash
git add -p
git commit -m "fix: resolve build errors from Zerodha sorting feature"
```
