"use client";

import { useState } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { formatINR, formatDate, daysUntil, formatTenure } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FdTxnSection, type FdTxnRow } from "./fd-txn-section";

export interface FDRenewalData {
  id: string;
  renewalNumber: number;
  startDate: Date | string;
  maturityDate: Date | string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  tenureDays: number;
  tenureText: string | null;
  maturityAmount: number | null;
  maturityInstruction: string | null;
  payoutFrequency: string | null;
}

export interface FDDetailData {
  id: string;
  bankName: string;
  /** Set after the backfill. New code should prefer bankId for filters. */
  bankId?: string | null;
  branchName: string | null;
  /** Set after the branch backfill. */
  branchId?: string | null;
  fdNumber: string | null;
  accountNumber: string | null;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  tenureDays: number;
  tenureText: string | null;
  startDate: Date | string;
  maturityDate: Date | string;
  maturityAmount: number | null;
  interestType: string;
  compoundFreq: string | null;
  maturityInstruction: string | null;
  payoutFrequency: string | null;
  depositorName: string | null;
  depositorSecondName: string | null;
  nomineeName: string | null;
  nomineeRelation: string | null;
  notes: string | null;
  sourceImageUrl: string | null;
  sourceImageBackUrl: string | null;
  sourcePdfUrl: string | null;
  createdAt: Date | string;
  renewals: FDRenewalData[];
  txns: FdTxnRow[];
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
      className="inline-flex items-center justify-center w-5 h-5 ml-2 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
    >
      {copied ? <Check size={12} className="text-[var(--accent-success)]" /> : <Copy size={12} />}
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
  const activeTenure = {
    tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
    tenureDays: latest?.tenureDays ?? fd.tenureDays,
    tenureText: latest?.tenureText ?? fd.tenureText,
  };
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
      <div className="ab-card p-4 sm:p-5">
        <div className="flex justify-between text-[12px] flex-wrap gap-2">
          <span className="text-[var(--text-secondary)] mono">{formatDate(activeStart)}</span>
          <span className="text-[var(--text-primary)] font-semibold">{activeRate}% p.a. · {fd.interestType}{fd.compoundFreq && fd.interestType === "compound" ? ` (${fd.compoundFreq})` : ""}</span>
          <span className="text-[var(--text-secondary)] mono">{formatDate(activeMaturity)}</span>
        </div>
        <div className="h-1 rounded-full bg-[var(--surface-subtle)] overflow-hidden mt-3">
          <div
            className={cn("h-full rounded-full", isMatured ? "bg-[var(--border-strong)]" : "bg-[var(--primary)]")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)] text-center mt-3">
          {formatTenure(activeTenure)} tenure · {isMatured ? "Matured" : `${Math.round(progress)}% elapsed · ${days} days remaining`}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[
          { label: "Principal", value: formatINR(activePrincipal), cls: "text-[var(--text-primary)]" },
          { label: "Accrued Interest", value: formatINR(accrued), cls: "text-[var(--accent-success)]" },
          { label: "Total Interest", value: formatINR(totalInterest), cls: "text-[var(--accent-success)]" },
          { label: "Maturity Value", value: formatINR(maturityValue), cls: "text-[var(--text-primary)]" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="ab-card p-4">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-1">{label}</p>
            <p className={cn("mono text-[17px] font-semibold", cls)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Two-column details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="ab-card p-4 sm:p-5 space-y-3">
          <h3 className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Deposit Details</h3>
          <dl className="text-[13px] space-y-0">
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Bank</dt>
              <dd className="text-[var(--text-primary)] text-right">{fd.bankName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">FD Number</dt>
              <dd className="text-[var(--text-primary)] mono text-right inline-flex items-center">
                {fd.fdNumber ?? "—"}
                {fd.fdNumber && <CopyButton value={fd.fdNumber} label="Copy FD number" />}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Account Number</dt>
              <dd className="text-[var(--text-primary)] mono text-right inline-flex items-center">
                {fd.accountNumber ?? "—"}
                {fd.accountNumber && <CopyButton value={fd.accountNumber} label="Copy account number" />}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Depositor</dt>
              <dd className="text-[var(--text-primary)] text-right">{fd.depositorName ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Second Depositor</dt>
              <dd className="text-[var(--text-primary)] text-right">{fd.depositorSecondName ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Interest Type</dt>
              <dd className="text-[var(--text-primary)] mono text-right">{fd.interestType}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Compound Frequency</dt>
              <dd className="text-[var(--text-primary)] mono text-right">{fd.interestType === "compound" ? (fd.compoundFreq ?? "—") : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Tenure</dt>
              <dd className="text-[var(--text-primary)] mono text-right">{formatTenure(activeTenure)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Start Date</dt>
              <dd className="text-[var(--text-primary)] mono text-right">{formatDate(activeStart)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
              <dt className="text-[var(--text-secondary)]">Maturity Date</dt>
              <dd className="text-[var(--text-primary)] mono text-right">{formatDate(activeMaturity)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-[var(--text-secondary)]">Created</dt>
              <dd className="text-[var(--text-primary)] mono text-right">{formatDate(fd.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-5">
          <div className="ab-card p-4 sm:p-5 space-y-3">
            <h3 className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Renewal &amp; Nominee</h3>
            <dl className="text-[13px] space-y-0">
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
                <dt className="text-[var(--text-secondary)]">Maturity Instruction</dt>
                <dd className="text-[var(--text-primary)] text-right">{formatInstruction(activeInstruction)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
                <dt className="text-[var(--text-secondary)]">Payout Frequency</dt>
                <dd className="text-[var(--text-primary)] text-right">{formatFrequency(activeFrequency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)]">
                <dt className="text-[var(--text-secondary)]">Nominee</dt>
                <dd className="text-[var(--text-primary)] text-right">{fd.nomineeName ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-[var(--text-secondary)]">Nominee Relation</dt>
                <dd className="text-[var(--text-primary)] text-right">{fd.nomineeRelation ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="ab-card p-4 sm:p-5">
            <h3 className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-3">Source Document</h3>
            {fd.sourcePdfUrl ? (
              <a
                href={fd.sourcePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)] font-semibold underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
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
                      <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{label}</p>
                      <a href={url!} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--text-primary)] font-semibold underline underline-offset-4 inline-flex items-center gap-1 hover:text-[var(--primary)] transition-colors">
                        <FileText size={11} /> Open
                      </a>
                    </div>
                    <a href={url!} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url!} alt={`FD certificate ${label}`} className="rounded-xl w-full h-44 object-contain bg-[var(--surface-muted)] border border-[var(--border)]" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--text-secondary)]">No document was attached when this FD was added.</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {fd.notes && (
        <div className="ab-card p-4 sm:p-5">
          <h3 className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-3">Notes</h3>
          <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{fd.notes}</p>
        </div>
      )}

      {/* Renewal history */}
      {fd.renewals.length > 0 && (
        <div className="ab-card p-4 sm:p-5 space-y-3">
          <h3 className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Renewal History</h3>
          <div>
            <div className="flex items-center justify-between text-[13px] py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <span className="ab-chip">Original</span>
                <span className="text-[var(--text-secondary)]">{formatDate(fd.startDate)} → {formatDate(fd.maturityDate)}</span>
              </div>
              <div className="text-right">
                <span className="mono text-[var(--text-primary)] font-semibold">{formatINR(fd.principal)}</span>
                <span className="text-[var(--text-secondary)] ml-2">@ {fd.interestRate}%</span>
              </div>
            </div>
            {fd.renewals.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-[13px] py-3 border-b border-[var(--border)] last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="ab-chip ab-chip-accent">R{r.renewalNumber}</span>
                  <span className="text-[var(--text-secondary)]">{formatDate(r.startDate)} → {formatDate(r.maturityDate)}</span>
                </div>
                <div className="text-right">
                  <span className="mono text-[var(--text-primary)] font-semibold">{formatINR(r.principal)}</span>
                  <span className="text-[var(--text-secondary)] ml-2">@ {r.interestRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FdTxnSection rows={fd.txns} />
    </div>
  );
}
