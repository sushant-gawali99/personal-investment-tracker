# FD List Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add default maturity-ascending sort and clickable column sorting (Principal, Rate, Tenure, At Maturity) to the FD list table.

**Architecture:** All changes are client-side in `fd-list.tsx`. Sort state is React `useState`. When null, data renders in server-provided maturity-ascending order. When a column is active, `filtered` is sorted in-memory before rendering. Sortable headers show `↕` / `↑` / `↓` icons via lucide-react.

**Tech Stack:** React 19, Next.js, TypeScript, lucide-react, Tailwind CSS

---

### Task 1: Add sort state and sorted array derivation

**Files:**
- Modify: `src/app/dashboard/fd/fd-list.tsx`

- [ ] **Step 1: Add sort types and state**

At the top of `fd-list.tsx`, add after the existing `type Filter` line:

```ts
type SortCol = "principal" | "rate" | "tenure" | "atMaturity";
type SortDir = "asc" | "desc";
```

Inside `FDList`, after `const [expandedIds, ...]`:

```ts
const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);
```

- [ ] **Step 2: Add `handleSort` helper**

Inside `FDList`, after the `toggleExpanded` function:

```ts
function handleSort(col: SortCol) {
  setSort((prev) =>
    prev?.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: "asc" }
  );
}
```

- [ ] **Step 3: Derive `sorted` array after `filtered`**

After the `filtered` declaration (line ~63), add:

```ts
const sorted = sort === null ? filtered : [...filtered].sort((a, b) => {
  const ca = resolveCurrent(a);
  const cb = resolveCurrent(b);
  let va: number, vb: number;
  if (sort.col === "principal") { va = ca.principal; vb = cb.principal; }
  else if (sort.col === "rate") { va = ca.interestRate; vb = cb.interestRate; }
  else if (sort.col === "tenure") { va = ca.tenureMonths; vb = cb.tenureMonths; }
  else { va = ca.maturityAmount ?? ca.principal; vb = cb.maturityAmount ?? cb.principal; }
  return sort.dir === "asc" ? va - vb : vb - va;
});
```

- [ ] **Step 4: Replace `filtered.map` with `sorted.map` in the table body**

Find the line `{filtered.map((fd) => {` in the `<tbody>` and change it to:

```tsx
{sorted.map((fd) => {
```

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/fd/fd-list.tsx
git commit -m "feat(fd-list): add sort state and sorted array derivation"
```

---

### Task 2: Update headers to support sortable columns with visual indicators

**Files:**
- Modify: `src/app/dashboard/fd/fd-list.tsx`

- [ ] **Step 1: Add sort icons to imports**

In the lucide-react import line, add `ChevronUp`, `ChevronDown`, `ChevronsUpDown`:

```ts
import { AlertTriangle, CheckCircle2, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, ArrowUpRight } from "lucide-react";
```

- [ ] **Step 2: Replace the static HEADERS array and static `<thead>` with a structured header definition**

Remove:
```ts
const HEADERS = ["Bank", "FD No.", "Principal", "Rate", "Tenure", "Duration", "At Maturity", "Status", ""];
```

Replace with:
```ts
type HeaderDef =
  | { label: string; sortCol?: undefined; align: "left" | "right" | "center"; className?: string }
  | { label: string; sortCol: SortCol; align: "left" | "right" | "center"; className?: string };

const HEADERS: HeaderDef[] = [
  { label: "Bank",       align: "left" },
  { label: "FD No.",     align: "left" },
  { label: "Principal",  align: "right", sortCol: "principal" },
  { label: "Rate",       align: "right", sortCol: "rate" },
  { label: "Tenure",     align: "left",  sortCol: "tenure" },
  { label: "Duration",   align: "left" },
  { label: "At Maturity", align: "right", sortCol: "atMaturity" },
  { label: "Status",     align: "left" },
  { label: "",           align: "center", className: "w-[44px]" },
];
```

- [ ] **Step 3: Replace the static `<thead>` rendering with dynamic header cells**

Replace the existing `<thead>` block:

```tsx
<thead>
  <tr className="bg-[#1c1c20]">
    {HEADERS.map((h, i) => (
      <th
        key={i}
        className={cn(
          "text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold px-4 py-3",
          i === 2 || i === 3 || i === 6 ? "text-right" : i === 8 ? "text-center w-[44px]" : "text-left"
        )}
      >
        {h}
      </th>
    ))}
  </tr>
</thead>
```

With:

```tsx
<thead>
  <tr className="bg-[#1c1c20]">
    {HEADERS.map((h, i) => {
      const isActive = h.sortCol !== undefined && sort?.col === h.sortCol;
      const SortIcon = isActive
        ? sort!.dir === "asc" ? ChevronUp : ChevronDown
        : ChevronsUpDown;
      return (
        <th
          key={i}
          onClick={h.sortCol ? () => handleSort(h.sortCol!) : undefined}
          className={cn(
            "text-[11px] uppercase tracking-wider font-semibold px-4 py-3 select-none",
            h.align === "right" ? "text-right" : h.align === "center" ? "text-center" : "text-left",
            h.className,
            h.sortCol ? "cursor-pointer hover:text-[#ededed] transition-colors" : "",
            isActive ? "text-[#ededed]" : "text-[#a0a0a5]"
          )}
        >
          {h.sortCol ? (
            <span className="inline-flex items-center gap-1">
              {h.align === "right" && (
                <SortIcon size={11} className={isActive ? "text-[#ededed]" : "text-[#6e6e73]"} />
              )}
              {h.label}
              {h.align !== "right" && (
                <SortIcon size={11} className={isActive ? "text-[#ededed]" : "text-[#6e6e73]"} />
              )}
            </span>
          ) : (
            h.label
          )}
        </th>
      );
    })}
  </tr>
</thead>
```

- [ ] **Step 4: Verify the dev server compiles without errors**

```bash
# Check for TypeScript errors
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/fd/fd-list.tsx
git commit -m "feat(fd-list): add sortable column headers with visual indicators"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Start the dev server and open the FD list**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard/fd` in a browser.

- [ ] **Step 2: Verify default order**

Confirm FDs appear maturity-ascending (already-matured / soonest-to-mature first) with no sort icon active.

- [ ] **Step 3: Verify Principal sort**

Click the **Principal** header. Confirm ascending order (smallest first), icon shows `↑`. Click again — descending (largest first), icon shows `↓`.

- [ ] **Step 4: Verify Rate, Tenure, At Maturity**

Repeat the same click-toggle check for **Rate**, **Tenure**, and **At Maturity** headers.

- [ ] **Step 5: Verify sort persists through filter changes**

With a column sort active, switch the status filter (e.g., Active → Matured). Confirm the sort column stays active and the new filtered set is also sorted correctly.

- [ ] **Step 6: Verify sort resets to default when re-clicking active column isn't needed**

Confirm that clicking a different column resets to `asc` on the new column (not inheriting a previous `desc` direction from another column).
