# Re-import Statement (Super Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a super-admin-only "Re-import" button to each imports list row that silently deletes existing transactions, re-runs AI extraction on the stored PDF, and auto-commits all results.

**Architecture:** Extract the shared extraction runner into a lib module so both the existing `/extract` route and the new `/reimport` route can call it. The reimport route deletes transactions for the import, resets its status, fires the runner in the background, and returns 202. The `ImportsList` client component gains a per-row loading state and a Re-import button visible only when `isSuperAdmin` is true.

**Tech Stack:** Next.js App Router (route handlers), Prisma, TypeScript, Vitest, Lucide React

---

### Task 1: Extract `runExtraction` into a shared lib module

The extraction logic currently lives as a private function inside `src/app/api/bank-accounts/import/[id]/extract/route.ts`. Move it to `src/lib/bank-accounts/run-extraction.ts` so the reimport route can reuse it without duplication.

**Files:**
- Create: `src/lib/bank-accounts/run-extraction.ts`
- Modify: `src/app/api/bank-accounts/import/[id]/extract/route.ts`

- [ ] **Step 1: Create `src/lib/bank-accounts/run-extraction.ts`**

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { extractTransactions } from "@/lib/bank-accounts/extract-transactions";
import { categorizeRows } from "@/lib/bank-accounts/categorize";
import { markDuplicates } from "@/lib/bank-accounts/dedup";
import { normalizeDescription } from "@/lib/bank-accounts/normalize-description";
import { commitImport } from "@/lib/bank-accounts/commit-import";
import type { StagedTxn, CategoryLite } from "@/lib/bank-accounts/types";

export function resolveLocalPath(fileUrl: string): string {
  const name = fileUrl.replace("/api/bank-accounts/import/file/", "");
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "bank-statements", name)
    : path.join(process.cwd(), "public", "uploads", "bank-statements", name);
}

/**
 * Runs the full extract → categorize → dedup → commit pipeline in the background.
 * Must never throw — catches all errors and persists them as status=failed.
 */
export async function runExtraction(importId: string, userId: string, pdfPassword?: string): Promise<void> {
  const started = Date.now();
  try {
    const imp = await prisma.statementImport.findFirst({ where: { id: importId, userId } });
    if (!imp) return;

    const bytes = await readFile(resolveLocalPath(imp.fileUrl));

    const categories = await prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
    });
    const categoryNames = categories.map((c) => c.name);
    const categoriesByName = new Map<string, CategoryLite>(
      categories.map((c) => [c.name, { id: c.id, name: c.name, kind: c.kind as CategoryLite["kind"], userId: c.userId }]),
    );

    const extraction = await extractTransactions(Buffer.from(bytes), categoryNames, pdfPassword);

    const rules = await prisma.merchantRule.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, pattern: true, categoryId: true },
    });

    let staged: StagedTxn[] = categorizeRows(extraction.transactions, rules, categoriesByName);

    const existing = await prisma.transaction.findMany({
      where: { userId, accountId: imp.accountId },
      select: { id: true, bankRef: true, txnDate: true, amount: true, normalizedDescription: true },
    });
    const existingForDedup = existing.map((e) => ({
      id: e.id,
      bankRef: e.bankRef,
      txnDate: e.txnDate.toISOString().slice(0, 10),
      amount: e.amount,
      normalizedDescription: e.normalizedDescription,
    }));
    const withDupes = markDuplicates(
      staged.map((s) => ({
        ...s,
        bankRef: s.bankRef,
        txnDate: s.txnDate,
        amount: s.amount,
        normalizedDescription: s.normalizedDescription,
      })),
      existingForDedup,
    );
    staged = staged.map((s, i) => ({
      ...s,
      normalizedDescription: normalizeDescription(s.description),
      isDuplicate: withDupes[i].isDuplicate,
      duplicateOfId: withDupes[i].duplicateOfId,
      skip: withDupes[i].isDuplicate,
    }));

    const dupCount = staged.filter((s) => s.isDuplicate).length;
    const newCount = staged.length - dupCount;

    await prisma.statementImport.update({
      where: { id: importId },
      data: {
        status: "preview",
        statementPeriodStart: extraction.statementPeriodStart ? new Date(extraction.statementPeriodStart) : null,
        statementPeriodEnd: extraction.statementPeriodEnd ? new Date(extraction.statementPeriodEnd) : null,
        openingBalance: extraction.openingBalance,
        closingBalance: extraction.closingBalance,
        extractedCount: staged.length,
        newCount,
        duplicateCount: dupCount,
        claudeInputTokens: extraction.inputTokens,
        claudeOutputTokens: extraction.outputTokens,
        claudeCostUsd: extraction.costUsd,
        stagedTransactions: JSON.stringify(staged),
      },
    });
    console.log(`[extract] import ${importId} extracted in ${Date.now() - started}ms, auto-committing…`);

    const commitResult = await commitImport(importId, userId, staged);
    console.log(
      `[extract] import ${importId} committed: ${commitResult.inserted} inserted, ${commitResult.transfersDetected} transfer pairs, total ${Date.now() - started}ms`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[extract] import ${importId} FAILED after ${Date.now() - started}ms: ${msg}`);
    try {
      await prisma.statementImport.update({
        where: { id: importId },
        data: { status: "failed", errorMessage: msg },
      });
    } catch {
      /* DB write failed — nothing more we can do */
    }
  }
}
```

- [ ] **Step 2: Update extract route to import from the new lib**

Replace `src/app/api/bank-accounts/import/[id]/extract/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { runExtraction } from "@/lib/bank-accounts/run-extraction";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let pdfPassword: string | undefined;
  try {
    const body = (await req.json().catch(() => null)) as { password?: string } | null;
    const pw = body?.password?.trim();
    if (pw) pdfPassword = pw;
  } catch {
    /* no body — extraction proceeds without a password */
  }

  if (imp.status === "extracting") {
    return NextResponse.json({ importId: id, status: "extracting", alreadyRunning: true }, { status: 202 });
  }

  await prisma.statementImport.update({
    where: { id },
    data: { status: "extracting", errorMessage: null },
  });

  void runExtraction(id, userId, pdfPassword);

  return NextResponse.json({ importId: id, status: "extracting" }, { status: 202 });
}
```

- [ ] **Step 3: Verify the app still builds**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bank-accounts/run-extraction.ts src/app/api/bank-accounts/import/\[id\]/extract/route.ts
git commit -m "refactor(bank-accounts): extract runExtraction into shared lib"
```

---

### Task 2: Add the `/reimport` API route

**Files:**
- Create: `src/app/api/bank-accounts/import/[id]/reimport/route.ts`
- Create: `src/app/api/bank-accounts/import/[id]/reimport/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/bank-accounts/import/[id]/reimport/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing the route
vi.mock("@/lib/session", () => ({
  getSessionUserId: vi.fn(),
  isSupAdmin: vi.fn(),
  SUPER_ADMIN_EMAIL: "sushant.gawali@gmail.com",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    statementImport: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/bank-accounts/run-extraction", () => ({
  runExtraction: vi.fn(),
}));
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

import { POST } from "./route";
import { getSessionUserId, isSupAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { runExtraction } from "@/lib/bank-accounts/run-extraction";
import { NextRequest } from "next/server";

function makeReq(id: string) {
  return new NextRequest(`http://localhost/api/bank-accounts/import/${id}/reimport`, { method: "POST" });
}

describe("POST /api/bank-accounts/import/[id]/reimport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    vi.mocked(isSupAdmin).mockReturnValue(false);
    const res = await POST(makeReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not super admin", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("other@example.com");
    vi.mocked(isSupAdmin).mockReturnValue(false);
    const res = await POST(makeReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when import not found", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("sushant.gawali@gmail.com");
    vi.mocked(isSupAdmin).mockReturnValue(true);
    vi.mocked(prisma.statementImport.findFirst).mockResolvedValue(null);
    const res = await POST(makeReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(404);
  });

  it("returns 202, deletes transactions, resets import, and fires runExtraction", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("sushant.gawali@gmail.com");
    vi.mocked(isSupAdmin).mockReturnValue(true);
    vi.mocked(prisma.statementImport.findFirst).mockResolvedValue({
      id: "imp1", userId: "sushant.gawali@gmail.com",
    } as never);
    vi.mocked(prisma.transaction.deleteMany).mockResolvedValue({ count: 5 });
    vi.mocked(prisma.statementImport.update).mockResolvedValue({} as never);
    vi.mocked(runExtraction).mockResolvedValue(undefined);

    const res = await POST(makeReq("imp1"), { params: Promise.resolve({ id: "imp1" }) });

    expect(res.status).toBe(202);
    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
      where: { importId: "imp1", userId: "sushant.gawali@gmail.com" },
    });
    expect(prisma.statementImport.update).toHaveBeenCalledWith({
      where: { id: "imp1" },
      data: {
        status: "extracting",
        newCount: 0,
        extractedCount: 0,
        duplicateCount: 0,
        stagedTransactions: null,
        errorMessage: null,
      },
    });
    expect(runExtraction).toHaveBeenCalledWith("imp1", "sushant.gawali@gmail.com", undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npx vitest run src/app/api/bank-accounts/import/\\[id\\]/reimport/route.test.ts
```

Expected: FAIL — "Cannot find module './route'"

- [ ] **Step 3: Create the route**

Create `src/app/api/bank-accounts/import/[id]/reimport/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, isSupAdmin } from "@/lib/session";
import { runExtraction } from "@/lib/bank-accounts/run-extraction";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Resolve effective user (may be impersonated)
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transaction.deleteMany({ where: { importId: id, userId } });

  await prisma.statementImport.update({
    where: { id },
    data: {
      status: "extracting",
      newCount: 0,
      extractedCount: 0,
      duplicateCount: 0,
      stagedTransactions: null,
      errorMessage: null,
    },
  });

  void runExtraction(id, userId);

  return NextResponse.json({ importId: id, status: "extracting" }, { status: 202 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npx vitest run src/app/api/bank-accounts/import/\\[id\\]/reimport/route.test.ts
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bank-accounts/import/\[id\]/reimport/
git commit -m "feat(bank-accounts): add POST /reimport route for super admin"
```

---

### Task 3: Update `ImportsList` to show the Re-import button

**Files:**
- Modify: `src/app/dashboard/bank-accounts/imports/imports-list.tsx`

- [ ] **Step 1: Update the component**

Replace the full file `src/app/dashboard/bank-accounts/imports/imports-list.tsx` with:

```typescript
// src/app/dashboard/bank-accounts/imports/imports-list.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Inbox,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { formatDate, formatINR } from "@/lib/format";

interface Item {
  id: string; fileName: string; status: string;
  account: { id: string; label: string };
  statementPeriodStart: string | null; statementPeriodEnd: string | null;
  openingBalance: number | null; closingBalance: number | null;
  extractedCount: number; newCount: number; duplicateCount: number;
  claudeCostUsd: number | null;
  createdAt: string;
  errorMessage: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "saved":
      return { chip: "ab-chip-success", icon: <CheckCircle2 size={11} />, label: "Saved" };
    case "preview":
      return { chip: "ab-chip-info", icon: <Clock size={11} />, label: "Needs review" };
    case "extracting":
      return { chip: "ab-chip-warning", icon: <Loader2 size={11} className="animate-spin" />, label: "Extracting" };
    case "failed":
      return { chip: "ab-chip-error", icon: <AlertCircle size={11} />, label: "Failed" };
    case "pending":
    default:
      return { chip: "", icon: <Clock size={11} />, label: "Pending" };
  }
}

export function ImportsList({ items, isSuperAdmin = false }: { items: Item[]; isSuperAdmin?: boolean }) {
  const router = useRouter();
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [reimportingIds, setReimportingIds] = useState<Set<string>>(new Set());

  function toggleError(id: string) {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this import and all its saved transactions?")) return;
    await fetch(`/api/bank-accounts/import/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function reimport(id: string) {
    if (!confirm("Re-import this statement? This will delete all existing transactions for this import and re-extract from the PDF.")) return;
    setReimportingIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/bank-accounts/import/${id}/reimport`, { method: "POST" });
    } finally {
      setReimportingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    }
  }

  if (items.length === 0) {
    return (
      <div className="ab-card p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-[#2a1218] flex items-center justify-center mx-auto mb-4">
          <Inbox size={22} className="text-[#ff385c]" />
        </div>
        <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">No imports yet</p>
        <p className="text-[13px] text-[#a0a0a5] mt-1 mb-4">Upload your first bank statement PDF to get started.</p>
        <a href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent inline-flex">
          Import Statement
        </a>
      </div>
    );
  }

  return (
    <div className="ab-card overflow-hidden">
      <ul className="divide-y divide-[#2a2a2e]">
        {items.map((i) => {
          const badge = statusBadge(i.status);
          const txnsHref = (() => {
            if (i.status !== "saved" || i.newCount === 0) return null;
            const p = new URLSearchParams({ accountId: i.account.id });
            if (i.statementPeriodStart) p.set("from", i.statementPeriodStart.slice(0, 10));
            if (i.statementPeriodEnd)   p.set("to",   i.statementPeriodEnd.slice(0, 10));
            return `/dashboard/bank-accounts/list?${p}`;
          })();
          const errorExpanded = expandedErrors.has(i.id);
          const isReimporting = reimportingIds.has(i.id);
          return (
            <li key={i.id} className="px-4 py-3 hover:bg-[#1c1c20]/50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText size={15} className="text-[#ff385c] shrink-0" />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-[#ededed] truncate max-w-[180px] sm:max-w-[340px]">
                      {i.fileName}
                    </span>
                    <span className={`ab-chip ${badge.chip}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                      {badge.icon} {badge.label}
                    </span>
                    {i.errorMessage && (
                      <button
                        onClick={() => toggleError(i.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#ff7a6e] hover:text-[#ffaa99] transition-colors"
                      >
                        {errorExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {errorExpanded ? "Hide error" : "Show error"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[12px] text-[#6e6e73]">
                    <span>{i.account.label}</span>
                    <span>·</span>
                    <span>
                      {i.statementPeriodStart
                        ? `${formatDate(i.statementPeriodStart)} → ${i.statementPeriodEnd ? formatDate(i.statementPeriodEnd) : "?"}`
                        : "Period unknown"}
                    </span>
                    <span>·</span>
                    <span>Uploaded {formatDate(i.createdAt)}</span>
                    {(i.openingBalance != null || i.closingBalance != null) && (
                      <>
                        <span>·</span>
                        <span className="mono">
                          {i.openingBalance != null ? formatINR(i.openingBalance) : "?"}
                          {" → "}
                          <span className={i.closingBalance != null && i.closingBalance < 0 ? "text-[#ff7a6e]" : "text-[#ededed]"}>
                            {i.closingBalance != null ? formatINR(i.closingBalance) : "?"}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                  {errorExpanded && i.errorMessage && (
                    <p className="text-[12px] text-[#ff7a6e] mt-1.5 break-words bg-[rgba(255,122,110,0.06)] rounded-lg px-3 py-2">
                      {i.errorMessage}
                    </p>
                  )}
                </div>

                {/* Txn count + view link */}
                <div className="text-right shrink-0">
                  <p className="mono text-[13px] font-semibold text-[#ededed] leading-none">
                    {i.newCount}
                    {i.extractedCount > 0 && (
                      <span className="text-[#6e6e73] font-normal text-[12px]"> / {i.extractedCount}</span>
                    )}
                  </p>
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    {i.duplicateCount > 0 && (
                      <span className="text-[11px] text-[#6e6e73]">{i.duplicateCount} dup</span>
                    )}
                    {txnsHref && (
                      <Link href={txnsHref} className="text-[11px] text-[#ff385c] hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                </div>

                {isSuperAdmin && (
                  <button
                    onClick={() => reimport(i.id)}
                    disabled={isReimporting}
                    className="p-1.5 rounded-lg text-[#6e6e73] hover:text-[#f59e0b] hover:bg-[rgba(245,158,11,0.08)] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Re-import (super admin)"
                  >
                    {isReimporting
                      ? <Loader2 size={14} className="animate-spin" />
                      : <RefreshCw size={14} />
                    }
                  </button>
                )}

                <button
                  onClick={() => remove(i.id)}
                  className="p-1.5 rounded-lg text-[#6e6e73] hover:text-[#ff7a6e] hover:bg-[rgba(255,122,110,0.08)] transition-colors shrink-0"
                  title="Delete import"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/bank-accounts/imports/imports-list.tsx
git commit -m "feat(bank-accounts): add Re-import button to imports list (super admin only)"
```

---

### Task 4: Pass `isSuperAdmin` from the imports page

**Files:**
- Modify: `src/app/dashboard/bank-accounts/imports/page.tsx`

- [ ] **Step 1: Update the page to detect super admin and pass the prop**

Replace `src/app/dashboard/bank-accounts/imports/page.tsx` with:

```typescript
// src/app/dashboard/bank-accounts/imports/page.tsx
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, isSupAdmin } from "@/lib/session";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ImportsList } from "./imports-list";
import { BackLink } from "@/components/bank-accounts/back-link";

export default async function ImportsPage() {
  const [session, userId] = await Promise.all([
    getServerSession(authOptions),
    getSessionUserId(),
  ]);
  if (!userId) redirect("/");
  const superAdmin = isSupAdmin(session?.user?.email ?? null);
  const [imports, ruleCovered, total] = await Promise.all([
    prisma.statementImport.findMany({
      where: { userId }, orderBy: { createdAt: "desc" },
      include: { account: true },
    }),
    prisma.transaction.count({ where: { userId, categorySource: "rule" } }),
    prisma.transaction.count({ where: { userId } }),
  ]);
  const coverage = total === 0 ? 0 : Math.round((ruleCovered / total) * 100);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <BackLink />
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Imports</h1>
          <p className="text-[14px] text-[#a0a0a5]">
            {total > 0
              ? <>{coverage}% of {total} transactions auto-categorized by merchant rules</>
              : "No transactions imported yet"}
          </p>
        </div>
        <Link href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent shrink-0">
          <UploadCloud size={15} /> Import new statement
        </Link>
      </div>
      <ImportsList
        isSuperAdmin={superAdmin}
        items={imports.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
          statementPeriodStart: i.statementPeriodStart?.toISOString() ?? null,
          statementPeriodEnd: i.statementPeriodEnd?.toISOString() ?? null,
          openingBalance: i.openingBalance,
          closingBalance: i.closingBalance,
          account: { id: i.account.id, label: i.account.label },
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/bank-accounts/imports/page.tsx
git commit -m "feat(bank-accounts): pass isSuperAdmin to ImportsList from server page"
```
