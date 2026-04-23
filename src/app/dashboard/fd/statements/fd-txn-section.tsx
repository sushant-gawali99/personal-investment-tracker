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
  statementId: string;
}

type TypeMeta = { label: string; icon: typeof TrendingUp; tone: string };

const TYPE_META: Record<string, TypeMeta> = {
  interest:        { label: "Interest",         icon: TrendingUp,   tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  maturity:        { label: "Maturity",         icon: CheckCircle2, tone: "bg-[#0e2236] text-[#5ba8ff] border-[#173152]" },
  premature_close: { label: "Premature Close",  icon: XCircle,      tone: "bg-[#2a1f0d] text-[#f5a524] border-[#3a2d0f]" },
  transfer_in:     { label: "Transfer In",      icon: ArrowDownLeft,tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  transfer_out:    { label: "Transfer Out",     icon: ArrowUpRight, tone: "bg-[#2a1218] text-[#ff385c] border-[#3a1a22]" },
  tds:             { label: "TDS",              icon: Minus,        tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
  other:           { label: "Other",            icon: Circle,       tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
};

export function FdTxnSection({ rows }: { rows: FdTxnRow[] }) {
  if (rows.length === 0) return null;

  const totalInterest = rows.filter((r) => r.type === "interest").reduce((a, r) => a + r.credit, 0);
  const totalTds = rows.filter((r) => r.type === "tds").reduce((a, r) => a + r.debit, 0);

  return (
    <div className="ab-card p-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Interest &amp; Transactions</h3>
          <p className="text-[12px] text-[#a0a0a5] mt-1">
            {rows.length} {rows.length === 1 ? "transaction" : "transactions"} matched from uploaded statements
          </p>
        </div>
        {(totalInterest > 0 || totalTds > 0) && (
          <div className="flex items-center gap-5 text-[12px]">
            {totalInterest > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[#a0a0a5]">Interest received</span>
                <span className="mono font-semibold text-[#5ee0a4]">{formatINR(totalInterest)}</span>
              </div>
            )}
            {totalTds > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[#a0a0a5]">TDS</span>
                <span className="mono font-semibold text-[#ededed]">{formatINR(totalTds)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile card list ── */}
      <div className="sm:hidden -mx-6 divide-y divide-[#222226]">
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
                  <span className="text-[11px] text-[#6e6e73]">{formatDate(r.txnDate)}</span>
                  <Link
                    href={`/dashboard/fd/statements/${r.statementId}`}
                    className="inline-flex items-center gap-1 text-[11px] text-[#a0a0a5] hover:text-[#ff385c] transition-colors"
                    title="View source statement"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                  </Link>
                </div>
                <p className="text-[12px] text-[#a0a0a5] mt-1 truncate" title={r.particulars}>{r.particulars}</p>
              </div>
              <span className={`mono text-[14px] font-semibold whitespace-nowrap shrink-0 ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                {isCredit ? "+" : "−"}{formatINR(isCredit ? r.credit : r.debit)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[#6e6e73]">
              <th className="text-left font-medium px-6 pb-3">Date</th>
              <th className="text-left font-medium px-3 pb-3">Type</th>
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
                <tr key={r.id} className="border-t border-[#222226] hover:bg-[#17171a] transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap text-[#ededed]">{formatDate(r.txnDate)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                      <Icon size={11} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#a0a0a5] max-w-[160px] sm:max-w-md truncate" title={r.particulars}>{r.particulars}</td>
                  <td className={`px-3 py-3 text-right mono font-semibold whitespace-nowrap ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                    {isCredit ? "+" : "−"}{formatINR(isCredit ? r.credit : r.debit)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/dashboard/fd/statements/${r.statementId}`}
                      className="inline-flex items-center gap-1 text-[12px] text-[#a0a0a5] hover:text-[#ff385c] transition-colors"
                      title="View source statement"
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
