"use client";
import Link from "next/link";
import { ExternalLink, TrendingUp, CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight, Minus, Circle } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

export interface FdTxnRow {
  id: string;
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: string;
  accountLabel: string;
}

type TypeMeta = { label: string; icon: typeof TrendingUp; tone: string };

const TYPE_META: Record<string, TypeMeta> = {
  interest:        { label: "Interest",         icon: TrendingUp,   tone: "bg-[var(--chip-success-bg)] text-[var(--accent-success)] border-[var(--chip-success-border)]" },
  maturity:        { label: "Maturity",         icon: CheckCircle2, tone: "bg-[var(--chip-info-bg)] text-[var(--accent-info)] border-[var(--chip-info-border)]" },
  premature_close: { label: "Premature Close",  icon: XCircle,      tone: "bg-[var(--chip-warning-bg)] text-[var(--accent-warning)] border-[var(--chip-warning-border)]" },
  transfer_in:     { label: "Transfer In",      icon: ArrowDownLeft,tone: "bg-[var(--chip-success-bg)] text-[var(--accent-success)] border-[var(--chip-success-border)]" },
  transfer_out:    { label: "Transfer Out",     icon: ArrowUpRight, tone: "bg-[var(--primary-tint)] text-[var(--primary)] border-[var(--chip-error-border)]" },
  tds:             { label: "TDS",              icon: Minus,        tone: "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-strong)]" },
  other:           { label: "Other",            icon: Circle,       tone: "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-strong)]" },
};

export function FdTxnSection({ rows }: { rows: FdTxnRow[] }) {
  if (rows.length === 0) return null;

  const totalInterest = rows.filter((r) => r.type === "interest").reduce((a, r) => a + r.credit, 0);
  const totalTds = rows.filter((r) => r.type === "tds").reduce((a, r) => a + r.debit, 0);

  return (
    <div className="ab-card p-6">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Interest &amp; Transactions</h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            {rows.length} {rows.length === 1 ? "transaction" : "transactions"} linked from your bank statements
          </p>
        </div>
        {(totalInterest > 0 || totalTds > 0) && (
          <div className="flex items-center gap-5 text-[12px]">
            {totalInterest > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[var(--text-secondary)]">Interest received</span>
                <span className="mono font-semibold text-[var(--accent-success)]">{formatINR(totalInterest)}</span>
              </div>
            )}
            {totalTds > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[var(--text-secondary)]">TDS</span>
                <span className="mono font-semibold text-[var(--text-primary)]">{formatINR(totalTds)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sm:hidden -mx-6 divide-y divide-[var(--surface-subtle)]">
        {rows.map((r) => {
          const meta = TYPE_META[r.type] ?? TYPE_META.other;
          const Icon = meta.icon;
          const isCredit = r.credit > 0;
          return (
            <div key={r.id} className="px-6 py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                    <Icon size={11} />
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">{formatDate(r.txnDate)}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">·</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] truncate">{r.accountLabel}</span>
                  <Link
                    href={`/dashboard/bank-accounts/list?q=${encodeURIComponent(r.particulars.slice(0, 20))}`}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                    title="View in bank transactions"
                  >
                    <ExternalLink size={11} />
                  </Link>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1 truncate" title={r.particulars}>{r.particulars}</p>
              </div>
              <span className={`mono text-[14px] font-semibold whitespace-nowrap shrink-0 ${isCredit ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]"}`}>
                {isCredit ? "+" : "−"}{formatINR(isCredit ? r.credit : r.debit)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
              <th className="text-left font-medium px-6 pb-3">Date</th>
              <th className="text-left font-medium px-3 pb-3">Type</th>
              <th className="text-left font-medium px-3 pb-3">Account</th>
              <th className="text-left font-medium px-3 pb-3">Particulars</th>
              <th className="text-right font-medium px-3 pb-3">Amount</th>
              <th className="text-right font-medium px-6 pb-3 w-14 sm:w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = TYPE_META[r.type] ?? TYPE_META.other;
              const Icon = meta.icon;
              const isCredit = r.credit > 0;
              return (
                <tr key={r.id} className="border-t border-[var(--surface-subtle)] hover:bg-[var(--surface-raised)] transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap text-[var(--text-primary)]">{formatDate(r.txnDate)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                      <Icon size={11} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)] whitespace-nowrap">{r.accountLabel}</td>
                  <td className="px-3 py-3 text-[var(--text-secondary)] max-w-[160px] sm:max-w-md truncate" title={r.particulars}>{r.particulars}</td>
                  <td className={`px-3 py-3 text-right mono font-semibold whitespace-nowrap ${isCredit ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]"}`}>
                    {isCredit ? "+" : "−"}{formatINR(isCredit ? r.credit : r.debit)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/dashboard/bank-accounts/list?q=${encodeURIComponent(r.particulars.slice(0, 20))}`}
                      className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                      title="View in bank transactions"
                    >
                      <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
