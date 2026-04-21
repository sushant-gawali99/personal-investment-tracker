# FD Disable (replace Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace destructive FD delete with a reversible "Disable" toggle. Disabled FDs are hidden from the default list and all totals, accessible via a new "Disabled" filter pill, and re-enable-able with one click.

**Architecture:** Schema adds a single `disabled Boolean` column. The existing generic `PATCH /api/fd/[id]` handles the toggle via its `{ ...body }` spread — no API handler code changes needed. A new `FDDisableButton` client component replaces `FDDeleteButton` in both the detail page header and the list expansion row. The list filter state gains a fourth pill; `fd-list.tsx` visually dims disabled rows and gates actions.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + LibSQL/Turso, React client components, TypeScript, Tailwind CSS, lucide-react icons.

---

## File Map

| Path | Change | Reason |
| --- | --- | --- |
| `prisma/schema.prisma` | **Modify** | Add `disabled Boolean @default(false)` to `FixedDeposit` |
| (Turso DB) | **DDL** | `ALTER TABLE FixedDeposit ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0` |
| `src/app/dashboard/fd/fd-disable-button.tsx` | **Create** | Client component that toggles `disabled` via PATCH, with confirm dialog |
| `src/app/dashboard/fd/[id]/page.tsx` | **Modify** | Swap FDDeleteButton→FDDisableButton, hide Renew buttons when disabled, add Disabled chip |
| `src/app/dashboard/fd/page.tsx` | **Modify** | Summary-stats `resolved` array filters out disabled FDs |
| `src/app/dashboard/fd/fd-list.tsx` | **Modify** | Add "Disabled" pill, update Filter type / counts / filter logic, dim disabled rows, swap expansion actions |
| `src/app/dashboard/fd/[id]/fd-delete-button.tsx` | **Delete** | Replaced by FDDisableButton |
| `src/app/api/fd/[id]/route.ts` | **Modify** | Remove the DELETE handler (PATCH handler unchanged — already handles `disabled` via body spread) |

---

### Task 1: Schema + Turso DDL

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the column to schema**

In `prisma/schema.prisma`, inside the `FixedDeposit` model, add the `disabled` field right after `notes` and before `sourceImageUrl`:

```prisma
  notes          String?
  disabled       Boolean  @default(false)
  sourceImageUrl     String?
```

- [ ] **Step 2: Apply the DDL to the live Turso database**

This project does not use Prisma migrations — it applies DDL directly to Turso. Apply:

```sql
ALTER TABLE FixedDeposit ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0
```

Use whichever of these works in this environment:

- The Turso CLI: `turso db shell <db-name>` then paste the SQL
- The Turso HTTP pipeline API with the URL+token from `.env.local` (`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`)
- A one-off Node script using `@libsql/client`

Confirm the column now exists (a `SELECT disabled FROM FixedDeposit LIMIT 1` should succeed).

- [ ] **Step 3: Regenerate the Prisma client**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx prisma generate
```

Expected: `✔ Generated Prisma Client`.

- [ ] **Step 4: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors. (Existing routes/code still type-check; the new field is simply available now.)

- [ ] **Step 5: Commit**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
git add prisma/schema.prisma
git commit -m "feat: add disabled flag to FixedDeposit schema"
```

---

### Task 2: Create `FDDisableButton` component

**Files:**
- Create: `src/app/dashboard/fd/fd-disable-button.tsx`

- [ ] **Step 1: Create the file with this exact content**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Loader2 } from "lucide-react";

export function FDDisableButton({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    const confirmMsg = disabled
      ? "Enable this FD? It will reappear in the main list."
      : "Disable this FD? It will be hidden from the list and excluded from totals. You can re-enable it from the Disabled filter.";
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await fetch(`/api/fd/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !disabled }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const label = disabled ? "Enable" : "Disable";
  const Icon = disabled ? RotateCcw : Archive;
  const styleProps = disabled
    ? undefined
    : { color: "#f5a524", borderColor: "rgba(245, 165, 36, 0.3)" };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      className="ab-btn ab-btn-secondary"
      style={styleProps}
      aria-label={label}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {busy ? (disabled ? "Enabling…" : "Disabling…") : label}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
git add src/app/dashboard/fd/[id]/fd-disable-button.tsx
git commit -m "feat: add FDDisableButton client component"
```

---

### Task 3: Detail page — swap button, gate Renew, add Disabled chip

**Files:**
- Modify: `src/app/dashboard/fd/[id]/page.tsx`

- [ ] **Step 1: Replace the import**

Find the line:

```tsx
import { FDDeleteButton } from "./fd-delete-button";
```

Replace with:

```tsx
import { FDDisableButton } from "../fd-disable-button";
```

- [ ] **Step 2: Update the header action buttons**

Find this block in the header card JSX:

```tsx
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/fd/renew/${fd.id}`}
              className="ab-btn ab-btn-secondary"
            >
              <RefreshCw size={13} /> Renew
            </Link>
            <FDDeleteButton id={fd.id} />
          </div>
```

Replace with:

```tsx
          <div className="flex items-center gap-2">
            {!fd.disabled && (
              <Link
                href={`/dashboard/fd/renew/${fd.id}`}
                className="ab-btn ab-btn-secondary"
              >
                <RefreshCw size={13} /> Renew
              </Link>
            )}
            <FDDisableButton id={fd.id} disabled={fd.disabled} />
          </div>
```

- [ ] **Step 3: Add the Disabled chip to the status row**

Find this block in the header card:

```tsx
                {fd.renewals.length > 0 && (
                  <span className="ab-chip ab-chip-accent">
                    Renewal #{fd.renewals.length}
                  </span>
                )}
                {statusBadge}
```

Replace with:

```tsx
                {fd.renewals.length > 0 && (
                  <span className="ab-chip ab-chip-accent">
                    Renewal #{fd.renewals.length}
                  </span>
                )}
                {fd.disabled && <span className="ab-chip">Disabled</span>}
                {statusBadge}
```

- [ ] **Step 4: Hide the "Renew Now" button inside the matured banner when disabled**

Find this block (inside the `{isMatured && (...)}` banner):

```tsx
          <Link
            href={`/dashboard/fd/renew/${fd.id}`}
            className="ab-btn ab-btn-secondary"
          >
            <RefreshCw size={13} /> Renew Now
          </Link>
```

Wrap it in a `disabled` guard:

```tsx
          {!fd.disabled && (
            <Link
              href={`/dashboard/fd/renew/${fd.id}`}
              className="ab-btn ab-btn-secondary"
            >
              <RefreshCw size={13} /> Renew Now
            </Link>
          )}
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
git add src/app/dashboard/fd/[id]/page.tsx
git commit -m "feat: detail page uses FDDisableButton, hides Renew when disabled"
```

---

### Task 4: List server page + `fd-list.tsx` — filter pill, counts, dimmed rows, expansion actions

**Files:**
- Modify: `src/app/dashboard/fd/page.tsx`
- Modify: `src/app/dashboard/fd/fd-list.tsx`

Both files commit together — `fd-list.tsx` uses `fd.disabled` which the server page already forwards, but the summary-stat change in `page.tsx` is part of the same behavioral shift.

- [ ] **Step 1: Update `src/app/dashboard/fd/page.tsx`**

Find this block:

```tsx
  // Summary stats resolve each FD to its latest-renewal values for totals.
  const resolved = fds.map((fd) => {
```

Replace with:

```tsx
  // Summary stats resolve each FD to its latest-renewal values for totals.
  // Disabled FDs never contribute to totals.
  const resolved = fds.filter((fd) => !fd.disabled).map((fd) => {
```

Also find the existence guard for the stats grid:

```tsx
      {fds.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```

Leave it as-is — if the only FDs are disabled, the stats still render with zeros, which is fine and consistent (the stats are about *active* holdings and showing zeros is honest).

- [ ] **Step 2: Replace the full content of `src/app/dashboard/fd/fd-list.tsx`**

Write this content, replacing the existing file:

```tsx
"use client";

import Link from "next/link";
import { useState, Fragment } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatDate, daysUntil } from "@/lib/format";
import { FDDetailContent, type FDDetailData } from "./fd-detail-content";
import { FDDisableButton } from "./fd-disable-button";

type FD = FDDetailData & { disabled: boolean };

type Filter = "all" | "active" | "matured" | "disabled";

export function FDList({ fds }: { fds: FD[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const now = new Date();

  const banks = Array.from(new Set(fds.map((fd) => fd.bankName))).sort();

  function resolveCurrent(fd: FD) {
    const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
    return {
      principal: latest?.principal ?? fd.principal,
      interestRate: latest?.interestRate ?? fd.interestRate,
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
      startDate: new Date(latest?.startDate ?? fd.startDate),
      maturityDate: new Date(latest?.maturityDate ?? fd.maturityDate),
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
    };
  }

  const filtered = fds.filter((fd) => {
    if (filter === "disabled") {
      if (!fd.disabled) return false;
    } else {
      if (fd.disabled) return false;
      const matured = resolveCurrent(fd).maturityDate <= now;
      if (filter === "active" && matured) return false;
      if (filter === "matured" && !matured) return false;
    }
    if (bankFilter !== "all" && fd.bankName !== bankFilter) return false;
    return true;
  });

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (fds.length === 0) {
    return (
      <div className="ab-card p-12 text-center">
        <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">No fixed deposits added yet</p>
        <p className="text-[14px] text-[#a0a0a5] mt-1.5">Upload an FD certificate to get started.</p>
      </div>
    );
  }

  const counts = {
    all: fds.filter((fd) => !fd.disabled).length,
    active: fds.filter((fd) => !fd.disabled && resolveCurrent(fd).maturityDate > now).length,
    matured: fds.filter((fd) => !fd.disabled && resolveCurrent(fd).maturityDate <= now).length,
    disabled: fds.filter((fd) => fd.disabled).length,
  };

  const HEADERS = ["Bank", "FD No.", "Principal", "Rate", "Tenure", "Duration", "At Maturity", "Status", ""];
  const COL_COUNT = HEADERS.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 bg-[#1c1c20] rounded-full w-fit">
          {(["all", "active", "matured", "disabled"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all capitalize",
                filter === f
                  ? "bg-[#17171a] text-[#ededed] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#a0a0a5] hover:text-[#ededed]"
              )}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        <select
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          className="bg-[#17171a] border border-[#3a3a3f] rounded-full px-4 py-2 text-[13px] font-semibold text-[#ededed] focus:outline-none focus:border-[#ededed] focus:shadow-[0_0_0_1px_#ededed] cursor-pointer transition-all"
        >
          <option value="all">All banks ({fds.length})</option>
          {banks.map((b) => (
            <option key={b} value={b}>
              {b} ({fds.filter((fd) => fd.bankName === b).length})
            </option>
          ))}
        </select>

        {(bankFilter !== "all" || filter !== "all") && (
          <button
            onClick={() => { setFilter("all"); setBankFilter("all"); }}
            className="text-[13px] text-[#ededed] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="ab-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
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
            <tbody className="divide-y divide-[#2a2a2e]">
              {filtered.map((fd) => {
                const current = resolveCurrent(fd);
                const isMatured = current.maturityDate <= now;
                const days = daysUntil(current.maturityDate);
                const displayMaturityValue = current.maturityAmount ?? current.principal;
                const maturedDaysAgo = isMatured ? Math.floor((now.getTime() - current.maturityDate.getTime()) / 86400000) : 0;
                const isExpanded = expandedIds.has(fd.id);

                const statusBadge = fd.disabled ? (
                  <span className="ab-chip">Disabled</span>
                ) : isMatured ? (
                  <span className="inline-flex items-center gap-1 ab-chip ab-chip-warning">
                    <CheckCircle2 size={10} />
                    {maturedDaysAgo === 0 ? "Matured today" : `Matured ${maturedDaysAgo}d ago`}
                  </span>
                ) : days <= 7 ? (
                  <span className="inline-flex items-center gap-1 ab-chip ab-chip-error">
                    <AlertTriangle size={10} />{days}d left
                  </span>
                ) : days <= 30 ? (
                  <span className="ab-chip ab-chip-warning">{days}d left</span>
                ) : (
                  <span className="ab-chip ab-chip-success">{days}d left</span>
                );

                return (
                  <Fragment key={fd.id}>
                    <tr
                      onClick={() => toggleExpanded(fd.id)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        fd.disabled ? "opacity-50 hover:opacity-70 hover:bg-[#1c1c20]" :
                          isMatured ? "bg-[#2a1f0d] hover:bg-[#2a1f0d]" : "hover:bg-[#1c1c20]",
                        isExpanded && "bg-[#17171a]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
                            <span className="font-bold text-[11px] text-[#ff385c]">
                              {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                          </div>
                          <span className="font-semibold text-[#ededed] text-[14px]">{fd.bankName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#a0a0a5] mono">{fd.fdNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-right mono text-[#ededed] font-medium">{formatINR(current.principal)}</td>
                      <td className="px-4 py-3 text-right mono text-[#ededed] font-medium">{current.interestRate}%</td>
                      <td className="px-4 py-3 text-[#a0a0a5]">{current.tenureMonths}m</td>
                      <td className="px-4 py-3 text-[#a0a0a5] text-[13px] whitespace-nowrap">
                        {formatDate(current.startDate)} <span className="text-[#6e6e73]">→</span> {formatDate(current.maturityDate)}
                      </td>
                      <td className="px-4 py-3 text-right mono text-[#ededed] font-semibold">{formatINR(displayMaturityValue)}</td>
                      <td className="px-4 py-3">{statusBadge}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpanded(fd.id); }}
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#6e6e73] hover:text-[#ededed] hover:bg-[#1c1c20] transition-colors"
                        >
                          <ChevronRight
                            size={14}
                            className={cn("transition-transform duration-200", isExpanded && "rotate-90")}
                          />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#0e0e11]">
                        <td colSpan={COL_COUNT} className="px-6 py-6">
                          <FDDetailContent fd={fd} />
                          <div className="flex items-center justify-between gap-4 flex-wrap pt-5 mt-5 border-t border-[#2a2a2e]">
                            <Link
                              href={`/dashboard/fd/${fd.id}`}
                              className="text-[12px] text-[#a0a0a5] hover:text-[#ededed] font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              Open full page <ArrowUpRight size={12} />
                            </Link>
                            <div className="flex items-center gap-2">
                              {!fd.disabled && (
                                <Link
                                  href={`/dashboard/fd/renew/${fd.id}`}
                                  className="ab-btn ab-btn-secondary"
                                >
                                  <RefreshCw size={13} /> Renew
                                </Link>
                              )}
                              <FDDisableButton id={fd.id} disabled={fd.disabled} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors. The `FD` type now requires `disabled: boolean`, which is satisfied by the Prisma type flowing from the server page.

- [ ] **Step 4: Commit**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
git add src/app/dashboard/fd/page.tsx src/app/dashboard/fd/fd-list.tsx
git commit -m "feat: FD list gains Disabled filter, dims disabled rows, swaps Delete for Disable"
```

---

### Task 5: Cleanup — remove obsolete Delete code

**Files:**
- Delete: `src/app/dashboard/fd/[id]/fd-delete-button.tsx`
- Modify: `src/app/api/fd/[id]/route.ts`

- [ ] **Step 1: Delete the old button component**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
rm src/app/dashboard/fd/[id]/fd-delete-button.tsx
```

- [ ] **Step 2: Remove the DELETE handler from the FD route**

In `src/app/api/fd/[id]/route.ts`, delete the entire `DELETE` export (the final handler in the file). The file should now contain only the `PATCH` export and its imports.

Final file content:

```tsx
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { id } = await params;

  const existing = await prisma.fixedDeposit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId && existing.userId !== "" && existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const fd = await prisma.fixedDeposit.update({
    where: { id },
    data: {
      ...body,
      principal: body.principal ? Number(body.principal) : undefined,
      interestRate: body.interestRate ? Number(body.interestRate) : undefined,
      tenureMonths: body.tenureMonths ? Number(body.tenureMonths) : undefined,
      maturityAmount: body.maturityAmount ? Number(body.maturityAmount) : undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      maturityDate: body.maturityDate ? new Date(body.maturityDate) : undefined,
    },
  });
  return NextResponse.json({ fd });
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
git add src/app/dashboard/fd/\[id\]/fd-delete-button.tsx src/app/api/fd/\[id\]/route.ts
git commit -m "chore: remove obsolete FD delete button and DELETE route"
```

---

### Task 6: Build verification

**Files:** none

- [ ] **Step 1: Run the production build**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npm run build
```

Expected: build succeeds. The pre-existing Turbopack NFT warning on `src/app/api/fd/upload/route.ts` is unrelated and acceptable.

- [ ] **Step 2: Commit any build-time fixes**

If the build surfaces issues not caught by `tsc --noEmit`, fix them and commit:

```bash
git add -p
git commit -m "fix: resolve build errors from FD disable feature"
```
