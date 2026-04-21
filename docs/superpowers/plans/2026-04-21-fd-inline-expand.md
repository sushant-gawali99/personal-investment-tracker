# FD Inline Expand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace list → detail navigation with an inline expandable row on the FD list page, backed by a shared `FDDetailContent` component reused by the preserved detail route.

**Architecture:** A new shared client component `FDDetailContent` renders the full deposit body (progress, summary cards, two-column details, notes, source document, renewal history) from a raw FD-with-renewals. The detail page keeps its header/banners and delegates the body to this component. The list page's row gets a chevron column; clicking expands an inline panel that renders the same component.

**Tech Stack:** Next.js 16 App Router, React (useState, client components), TypeScript, Tailwind CSS, lucide-react icons, Prisma types.

---

## File Structure

| Path | Change | Responsibility |
| --- | --- | --- |
| `src/app/dashboard/fd/fd-detail-content.tsx` | **Create** | Pure render of FD body (progress, summary cards, details, notes, source doc, renewal history). Includes internal `CopyButton` helper. Used by both the detail page and the list expanded row. |
| `src/app/dashboard/fd/[id]/page.tsx` | **Modify** | Strip body; keep back-link, banners, header card. Render `<FDDetailContent fd={fd} />` in place of the old body JSX. |
| `src/app/dashboard/fd/page.tsx` | **Modify** | Stop pre-resolving FDs to their latest renewal values; pass raw FDs (with renewals) to `<FDList>`. Keep a separate resolved array for the summary-stats computations. |
| `src/app/dashboard/fd/fd-list.tsx` | **Modify** | Expand `FD` type to carry all fields needed by `FDDetailContent` (including `renewals[]`). Compute latest values per row for the existing row cells. Replace the trash-icon Action column with a chevron column. Add expand state and an expansion `<tr>` that renders `<FDDetailContent>` plus an actions bar. |

No schema changes. No API changes. No new dependencies.

---

### Task 1: Create `FDDetailContent` + `CopyButton`

**Files:**
- Create: `src/app/dashboard/fd/fd-detail-content.tsx`

- [ ] **Step 1: Create the file with full content**

Write the following to `src/app/dashboard/fd/fd-detail-content.tsx`:

```tsx
"use client";

import { useState } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { formatINR, formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FDRenewalData {
  id: string;
  renewalNumber: number;
  startDate: Date | string;
  maturityDate: Date | string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  maturityAmount: number | null;
  maturityInstruction: string | null;
  payoutFrequency: string | null;
}

export interface FDDetailData {
  id: string;
  bankName: string;
  fdNumber: string | null;
  accountNumber: string | null;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  startDate: Date | string;
  maturityDate: Date | string;
  maturityAmount: number | null;
  interestType: string;
  compoundFreq: string | null;
  maturityInstruction: string | null;
  payoutFrequency: string | null;
  nomineeName: string | null;
  nomineeRelation: string | null;
  notes: string | null;
  sourceImageUrl: string | null;
  sourceImageBackUrl: string | null;
  sourcePdfUrl: string | null;
  createdAt: Date | string;
  renewals: FDRenewalData[];
}

const INSTRUCTION_LABEL: Record<string, string> = {
  renew_principal_interest: "Auto-renew principal + interest",
  renew_principal: "Auto-renew principal, payout interest",
  payout: "Credit to savings on maturity",
};
const FREQUENCY_LABEL: Record<string, string> = {
  on_maturity: "On maturity",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annually: "Annually",
};

function formatInstruction(v: string | null) { return v ? (INSTRUCTION_LABEL[v] ?? v) : "—"; }
function formatFrequency(v: string | null) { return v ? (FREQUENCY_LABEL[v] ?? v) : "—"; }

function computeAccruedInterest(principal: number, rate: number, startDate: Date, asOf: Date, interestType: string, compoundFreq: string | null) {
  const years = Math.max(0, (asOf.getTime() - startDate.getTime()) / (365 * 86400000));
  if (years === 0) return 0;
  if (interestType === "simple") {
    return principal * (rate / 100) * years;
  }
  const n = compoundFreq === "monthly" ? 12 : compoundFreq === "annually" ? 1 : compoundFreq === "half-yearly" ? 2 : 4;
  return principal * (Math.pow(1 + rate / 100 / n, n * years) - 1);
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable; silent fail is acceptable here.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className="inline-flex items-center justify-center w-5 h-5 ml-2 rounded text-[#6e6e73] hover:text-[#ededed] transition-colors"
    >
      {copied ? <Check size={12} className="text-[#5ee0a4]" /> : <Copy size={12} />}
    </button>
  );
}

export function FDDetailContent({ fd }: { fd: FDDetailData }) {
  const now = new Date();

  const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
  const activePrincipal = latest?.principal ?? fd.principal;
  const activeRate = latest?.interestRate ?? fd.interestRate;
  const activeStart = new Date(latest?.startDate ?? fd.startDate);
  const activeMaturity = new Date(latest?.maturityDate ?? fd.maturityDate);
  const activeTenure = latest?.tenureMonths ?? fd.tenureMonths;
  const activeMaturityAmount = latest?.maturityAmount ?? fd.maturityAmount;
  const activeInstruction = latest?.maturityInstruction ?? fd.maturityInstruction;
  const activeFrequency = latest?.payoutFrequency ?? fd.payoutFrequency;

  const isMatured = activeMaturity <= now;
  const days = daysUntil(activeMaturity);
  const totalDays = (activeMaturity.getTime() - activeStart.getTime()) / 86400000;
  const elapsedDays = Math.max(0, (now.getTime() - activeStart.getTime()) / 86400000);
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;
  const computedTotalInterest = computeAccruedInterest(activePrincipal, activeRate, activeStart, activeMaturity, fd.interestType, fd.compoundFreq);
  const totalInterest = activeMaturityAmount != null ? activeMaturityAmount - activePrincipal : computedTotalInterest;
  const maturityValue = activePrincipal + totalInterest;
  const accrued = computeAccruedInterest(activePrincipal, activeRate, activeStart, now > activeMaturity ? activeMaturity : now, fd.interestType, fd.compoundFreq);

  return (
    <div className="space-y-5">
      {/* Progress block */}
      <div className="ab-card p-5">
        <div className="flex justify-between text-[12px] flex-wrap gap-2">
          <span className="text-[#a0a0a5] mono">{formatDate(activeStart)}</span>
          <span className="text-[#ededed] font-semibold">{activeRate}% p.a. · {fd.interestType}{fd.compoundFreq && fd.interestType === "compound" ? ` (${fd.compoundFreq})` : ""}</span>
          <span className="text-[#a0a0a5] mono">{formatDate(activeMaturity)}</span>
        </div>
        <div className="h-1 rounded-full bg-[#222226] overflow-hidden mt-3">
          <div
            className={cn("h-full rounded-full", isMatured ? "bg-[#3a3a3f]" : "bg-[#ff385c]")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[12px] text-[#6e6e73] text-center mt-3">
          {activeTenure} months tenure · {isMatured ? "Matured" : `${Math.round(progress)}% elapsed · ${days} days remaining`}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Principal", value: formatINR(activePrincipal), cls: "text-[#ededed]" },
          { label: "Accrued Interest", value: formatINR(accrued), cls: "text-[#5ee0a4]" },
          { label: "Total Interest", value: formatINR(totalInterest), cls: "text-[#5ee0a4]" },
          { label: "Maturity Value", value: formatINR(maturityValue), cls: "text-[#ededed]" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="ab-card p-4">
            <p className="text-[10px] text-[#6e6e73] uppercase tracking-wider font-semibold mb-1">{label}</p>
            <p className={cn("mono text-[17px] font-semibold", cls)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Two-column details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="ab-card p-5 space-y-3">
          <h3 className="text-[11px] text-[#6e6e73] uppercase tracking-wider font-semibold">Deposit Details</h3>
          <dl className="text-[13px] space-y-0">
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">Bank</dt>
              <dd className="text-[#ededed] text-right">{fd.bankName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">FD Number</dt>
              <dd className="text-[#ededed] mono text-right inline-flex items-center">
                {fd.fdNumber ?? "—"}
                {fd.fdNumber && <CopyButton value={fd.fdNumber} label="Copy FD number" />}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">Account Number</dt>
              <dd className="text-[#ededed] mono text-right inline-flex items-center">
                {fd.accountNumber ?? "—"}
                {fd.accountNumber && <CopyButton value={fd.accountNumber} label="Copy account number" />}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">Interest Type</dt>
              <dd className="text-[#ededed] mono text-right">{fd.interestType}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">Compound Frequency</dt>
              <dd className="text-[#ededed] mono text-right">{fd.interestType === "compound" ? (fd.compoundFreq ?? "—") : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">Tenure</dt>
              <dd className="text-[#ededed] mono text-right">{activeTenure} months</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">Start Date</dt>
              <dd className="text-[#ededed] mono text-right">{formatDate(activeStart)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
              <dt className="text-[#a0a0a5]">Maturity Date</dt>
              <dd className="text-[#ededed] mono text-right">{formatDate(activeMaturity)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-[#a0a0a5]">Created</dt>
              <dd className="text-[#ededed] mono text-right">{formatDate(fd.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-5">
          <div className="ab-card p-5 space-y-3">
            <h3 className="text-[11px] text-[#6e6e73] uppercase tracking-wider font-semibold">Renewal &amp; Nominee</h3>
            <dl className="text-[13px] space-y-0">
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
                <dt className="text-[#a0a0a5]">Maturity Instruction</dt>
                <dd className="text-[#ededed] text-right">{formatInstruction(activeInstruction)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
                <dt className="text-[#a0a0a5]">Payout Frequency</dt>
                <dd className="text-[#ededed] text-right">{formatFrequency(activeFrequency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[#2a2a2e]">
                <dt className="text-[#a0a0a5]">Nominee</dt>
                <dd className="text-[#ededed] text-right">{fd.nomineeName ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-[#a0a0a5]">Nominee Relation</dt>
                <dd className="text-[#ededed] text-right">{fd.nomineeRelation ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="ab-card p-5">
            <h3 className="text-[11px] text-[#6e6e73] uppercase tracking-wider font-semibold mb-3">Source Document</h3>
            {fd.sourcePdfUrl ? (
              <a
                href={fd.sourcePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-[#ededed] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
              >
                <FileText size={14} /> View PDF
              </a>
            ) : fd.sourceImageUrl || fd.sourceImageBackUrl ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { url: fd.sourceImageUrl, label: "Front" },
                  { url: fd.sourceImageBackUrl, label: "Back" },
                ].filter((s) => s.url).map(({ url, label }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">{label}</p>
                      <a href={url!} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#ededed] font-semibold underline underline-offset-4 inline-flex items-center gap-1 hover:text-[#ff385c] transition-colors">
                        <FileText size={11} /> Open
                      </a>
                    </div>
                    <a href={url!} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url!} alt={`FD certificate ${label}`} className="rounded-xl w-full h-44 object-contain bg-[#1c1c20] border border-[#2a2a2e]" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#a0a0a5]">No document was attached when this FD was added.</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {fd.notes && (
        <div className="ab-card p-5">
          <h3 className="text-[11px] text-[#6e6e73] uppercase tracking-wider font-semibold mb-3">Notes</h3>
          <p className="text-[13px] text-[#a0a0a5] whitespace-pre-wrap leading-relaxed">{fd.notes}</p>
        </div>
      )}

      {/* Renewal history */}
      {fd.renewals.length > 0 && (
        <div className="ab-card p-5 space-y-3">
          <h3 className="text-[11px] text-[#6e6e73] uppercase tracking-wider font-semibold">Renewal History</h3>
          <div>
            <div className="flex items-center justify-between text-[13px] py-3 border-b border-[#2a2a2e]">
              <div className="flex items-center gap-3">
                <span className="ab-chip">Original</span>
                <span className="text-[#a0a0a5]">{formatDate(fd.startDate)} → {formatDate(fd.maturityDate)}</span>
              </div>
              <div className="text-right">
                <span className="mono text-[#ededed] font-semibold">{formatINR(fd.principal)}</span>
                <span className="text-[#a0a0a5] ml-2">@ {fd.interestRate}%</span>
              </div>
            </div>
            {fd.renewals.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-[13px] py-3 border-b border-[#2a2a2e] last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="ab-chip ab-chip-accent">R{r.renewalNumber}</span>
                  <span className="text-[#a0a0a5]">{formatDate(r.startDate)} → {formatDate(r.maturityDate)}</span>
                </div>
                <div className="text-right">
                  <span className="mono text-[#ededed] font-semibold">{formatINR(r.principal)}</span>
                  <span className="text-[#a0a0a5] ml-2">@ {r.interestRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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
git add src/app/dashboard/fd/fd-detail-content.tsx
git commit -m "feat: add shared FDDetailContent component with CopyButton"
```

---

### Task 2: Refactor detail page to use `FDDetailContent`

**Files:**
- Modify: `src/app/dashboard/fd/[id]/page.tsx`

- [ ] **Step 1: Replace file content**

Write the following full content to `src/app/dashboard/fd/[id]/page.tsx`, replacing the existing file:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatINR, formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FDDeleteButton } from "./fd-delete-button";
import { FDDetailContent } from "../fd-detail-content";
import { getSessionUserId } from "@/lib/session";

function computeAccruedInterest(principal: number, rate: number, startDate: Date, asOf: Date, interestType: string, compoundFreq: string | null) {
  const years = Math.max(0, (asOf.getTime() - startDate.getTime()) / (365 * 86400000));
  if (years === 0) return 0;
  if (interestType === "simple") {
    return principal * (rate / 100) * years;
  }
  const n = compoundFreq === "monthly" ? 12 : compoundFreq === "annually" ? 1 : compoundFreq === "half-yearly" ? 2 : 4;
  return principal * (Math.pow(1 + rate / 100 / n, n * years) - 1);
}

export default async function FDDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ addPrevious?: string }> }) {
  const { id } = await params;
  const { addPrevious } = await searchParams;
  const userId = await getSessionUserId();
  const fd = await prisma.fixedDeposit.findUnique({
    where: { id },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });
  if (!fd) notFound();
  if (fd.userId && fd.userId !== "" && fd.userId !== userId) notFound();

  const now = new Date();
  const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
  const activePrincipal = latest?.principal ?? fd.principal;
  const activeRate = latest?.interestRate ?? fd.interestRate;
  const activeStart = new Date(latest?.startDate ?? fd.startDate);
  const activeMaturity = new Date(latest?.maturityDate ?? fd.maturityDate);
  const activeMaturityAmount = latest?.maturityAmount ?? fd.maturityAmount;

  const isMatured = activeMaturity <= now;
  const days = daysUntil(activeMaturity);
  const computedTotalInterest = computeAccruedInterest(activePrincipal, activeRate, activeStart, activeMaturity, fd.interestType, fd.compoundFreq);
  const totalInterest = activeMaturityAmount != null ? activeMaturityAmount - activePrincipal : computedTotalInterest;
  const maturityValue = activePrincipal + totalInterest;

  const statusBadge = isMatured ? (
    <span className="ab-chip">Matured</span>
  ) : days <= 7 ? (
    <span className="ab-chip ab-chip-error flex items-center gap-1">
      <AlertTriangle size={10} />{days}d left
    </span>
  ) : days <= 30 ? (
    <span className="ab-chip ab-chip-warning">{days}d left</span>
  ) : (
    <span className="ab-chip ab-chip-success">{days}d left</span>
  );

  return (
    <div className="space-y-5">
      <Link href="/dashboard/fd" className="inline-flex items-center gap-1.5 text-[13px] text-[#a0a0a5] hover:text-[#ededed] transition-colors font-medium">
        <ArrowLeft size={13} /> Back to Fixed Deposits
      </Link>

      {isMatured && (
        <div className="ab-card-flat bg-[#2a1f0d] border-[#3a2d0f] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-[#f5a524] shrink-0" />
            <div>
              <p className="text-[14px] text-[#f5a524] font-semibold">This FD has matured</p>
              <p className="text-[12px] text-[#a0a0a5] mt-0.5">
                Matured on {formatDate(activeMaturity)} · {Math.floor((now.getTime() - activeMaturity.getTime()) / 86400000)} days ago · {formatINR(maturityValue)} available
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/fd/renew/${fd.id}`}
            className="ab-btn ab-btn-secondary"
          >
            <RefreshCw size={13} /> Renew Now
          </Link>
        </div>
      )}

      {addPrevious && fd.renewals.length === 0 && (
        <div className="ab-card-flat bg-[#2a1f0d] border-[#3a2d0f] px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[14px] text-[#f5a524] font-semibold">Complete the renewal history</p>
            <p className="text-[12px] text-[#a0a0a5] mt-1 leading-relaxed">
              This FD was previously renewed. Use the <strong className="text-[#ededed]">Renew</strong> button to add each previous renewal in order — starting from the earliest one.
            </p>
          </div>
          <Link
            href={`/dashboard/fd/renew/${id}`}
            className="ab-btn ab-btn-secondary"
          >
            <RefreshCw size={13} /> Add Renewal
          </Link>
        </div>
      )}

      <div className="ab-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
              <span className="font-bold text-[14px] text-[#ff385c]">
                {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className={cn("text-[22px] font-semibold text-[#ededed] tracking-tight")}>{fd.bankName}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {fd.fdNumber && <span className="text-[12px] text-[#a0a0a5] mono">FD #{fd.fdNumber}</span>}
                {fd.accountNumber && <span className="text-[12px] text-[#a0a0a5] mono">A/c {fd.accountNumber}</span>}
                {fd.renewals.length > 0 && (
                  <span className="ab-chip ab-chip-accent">
                    Renewal #{fd.renewals.length}
                  </span>
                )}
                {statusBadge}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/fd/renew/${fd.id}`}
              className="ab-btn ab-btn-secondary"
            >
              <RefreshCw size={13} /> Renew
            </Link>
            <FDDeleteButton id={fd.id} />
          </div>
        </div>
      </div>

      <FDDetailContent fd={fd} />
    </div>
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
git add src/app/dashboard/fd/[id]/page.tsx
git commit -m "refactor: detail page delegates body to FDDetailContent"
```

---

### Task 3: Update list server page to pass raw FDs

**Files:**
- Modify: `src/app/dashboard/fd/page.tsx`

- [ ] **Step 1: Replace file content**

Write the following full content to `src/app/dashboard/fd/page.tsx`, replacing the existing file:

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FDList } from "./fd-list";
import { formatINR } from "@/lib/format";
import { getSessionUserId } from "@/lib/session";

export default async function FDPage() {
  const userId = await getSessionUserId();
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "" },
    orderBy: { maturityDate: "asc" },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });

  // Summary stats resolve each FD to its latest-renewal values for totals.
  const resolved = fds.map((fd) => {
    const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
    return {
      principal: latest?.principal ?? fd.principal,
      interestRate: latest?.interestRate ?? fd.interestRate,
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
      startDate: new Date(latest?.startDate ?? fd.startDate),
      maturityDate: new Date(latest?.maturityDate ?? fd.maturityDate),
    };
  });

  const totalPrincipal = resolved.reduce((s, r) => s + r.principal, 0);
  const totalMaturity = resolved.reduce((s, r) => s + (r.maturityAmount ?? r.principal), 0);
  const totalInterest = totalMaturity - totalPrincipal;
  const activeFDs = resolved.filter((r) => r.maturityDate > new Date()).length;
  const avgRate = resolved.length > 0
    ? resolved.reduce((s, r) => s + r.interestRate, 0) / resolved.length
    : 0;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const interestThisYear = resolved.reduce((sum, r) => {
    const overlapStart = r.startDate < yearStart ? yearStart : r.startDate;
    const overlapEnd = r.maturityDate > yearEnd ? yearEnd : r.maturityDate;
    if (overlapStart >= overlapEnd) return sum;
    const days = (overlapEnd.getTime() - overlapStart.getTime()) / 86400000;
    return sum + (r.principal * r.interestRate / 100) * (days / 365);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Fixed Deposits</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Track and analyse your fixed deposit investments.</p>
        </div>
        <Link
          href="/dashboard/fd/new"
          className="ab-btn ab-btn-accent"
        >
          <Plus size={15} />
          Add FD
        </Link>
      </div>

      {fds.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total FD Corpus", value: formatINR(totalMaturity) },
            { label: "Avg Interest Rate", value: `${avgRate.toFixed(2)}%` },
            { label: "Active Deposits", value: String(activeFDs) },
            { label: "Interest This Year", value: formatINR(interestThisYear) },
          ].map(({ label, value }) => (
            <div key={label} className="ab-card p-4">
              <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className="mono text-[20px] font-semibold text-[#ededed]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {fds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="ab-card-flat p-4 flex items-center justify-between">
            <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Principal</p>
            <p className="mono font-semibold text-[#ededed]">{formatINR(totalPrincipal)}</p>
          </div>
          <div className="ab-card-flat p-4 flex items-center justify-between">
            <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Interest Earned</p>
            <p className="mono font-semibold text-[#5ee0a4]">{formatINR(totalInterest)}</p>
          </div>
        </div>
      )}

      <FDList fds={fds} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: **This step will show errors in `fd-list.tsx`** because the `FDList` prop type is narrower than what we now pass. Those errors are resolved in Task 4. Confirm the only errors are in `fd-list.tsx` (e.g. missing `renewals`, `compoundFreq` on the `FD` interface), not elsewhere.

- [ ] **Step 3: Do not commit yet**

Leave this change uncommitted; it will be committed together with Task 4 so the repo never contains a state where `fd-list.tsx` has type errors.

---

### Task 4: Update `fd-list.tsx` — widen `FD` type, chevron column, expansion row

**Files:**
- Modify: `src/app/dashboard/fd/fd-list.tsx`

- [ ] **Step 1: Replace file content**

Write the following full content to `src/app/dashboard/fd/fd-list.tsx`, replacing the existing file:

```tsx
"use client";

import Link from "next/link";
import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, CheckCircle2, ChevronRight, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatDate, daysUntil } from "@/lib/format";
import { FDDetailContent, type FDDetailData } from "./fd-detail-content";

type FD = FDDetailData;

type Filter = "all" | "active" | "matured";

export function FDList({ fds }: { fds: FD[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const now = new Date();

  const banks = Array.from(new Set(fds.map((fd) => fd.bankName))).sort();

  // Compute the "current" (latest-renewal-resolved) values used for row cells.
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
    const current = resolveCurrent(fd);
    const matured = current.maturityDate <= now;
    if (filter === "active" && matured) return false;
    if (filter === "matured" && !matured) return false;
    if (bankFilter !== "all" && fd.bankName !== bankFilter) return false;
    return true;
  });

  async function deleteFD(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/fd/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

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
    all: fds.length,
    active: fds.filter((fd) => resolveCurrent(fd).maturityDate > now).length,
    matured: fds.filter((fd) => resolveCurrent(fd).maturityDate <= now).length,
  };

  const HEADERS = ["Bank", "FD No.", "Principal", "Rate", "Tenure", "Duration", "At Maturity", "Status", ""];
  const COL_COUNT = HEADERS.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 bg-[#1c1c20] rounded-full w-fit">
          {(["all", "active", "matured"] as Filter[]).map((f) => (
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

                const statusBadge = isMatured ? (
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
                      className={cn(
                        "transition-colors",
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
                          onClick={() => toggleExpanded(fd.id)}
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
                              <Link
                                href={`/dashboard/fd/renew/${fd.id}`}
                                className="ab-btn ab-btn-secondary"
                              >
                                <RefreshCw size={13} /> Renew
                              </Link>
                              <button
                                type="button"
                                onClick={() => deleteFD(fd.id)}
                                disabled={deleting === fd.id}
                                className="ab-btn ab-btn-secondary"
                                style={{ color: "#ff7a6e", borderColor: "rgba(255, 122, 110, 0.3)" }}
                              >
                                <Trash2 size={13} /> {deleting === fd.id ? "Deleting…" : "Delete"}
                              </button>
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

- [ ] **Step 2: Type-check**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit Task 3 and Task 4 together**

```bash
git add src/app/dashboard/fd/page.tsx src/app/dashboard/fd/fd-list.tsx
git commit -m "feat: inline FD expand row with chevron column"
```

---

### Task 5: Build verification

**Files:** none

- [ ] **Step 1: Run production build**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker && npm run build
```

Expected: build succeeds. The pre-existing Turbopack NFT warning on `src/app/api/fd/upload/route.ts` is unrelated and acceptable.

- [ ] **Step 2: Commit any build-time fixes**

If the build surfaces issues not caught by `tsc --noEmit`, fix them and commit:

```bash
git add -p
git commit -m "fix: resolve build errors from FD inline-expand feature"
```
