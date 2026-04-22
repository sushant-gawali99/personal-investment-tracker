"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import {
  Trash2, Download, ExternalLink, CalendarDays, Inbox, ChevronRight, Loader2,
  Minus, Circle, ArrowDownLeft, ArrowUpRight, Sparkles,
} from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

type Item = {
  id: string;
  bankName: string;
  fileName: string;
  fromDate: string | null;
  toDate: string | null;
  txnCount: number;
  matchedCount: number;
  uploadedAt: string;
  parseMethod: string;
};

type LoadedTxn = {
  id: string;
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: string;
  fdId: string | null;
};

const NON_FD_TYPE_META: Record<string, { label: string; icon: typeof Minus; tone: string }> = {
  tds:          { label: "TDS",          icon: Minus,        tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
  other:        { label: "Other",        icon: Circle,       tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
  transfer_in:  { label: "Transfer In",  icon: ArrowDownLeft,tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  transfer_out: { label: "Transfer Out", icon: ArrowUpRight, tone: "bg-[#2a1218] text-[#ff385c] border-[#3a1a22]" },
};

function bankInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function matchRateTone(matched: number, total: number): string {
  if (total === 0) return "text-[#6e6e73]";
  const ratio = matched / total;
  if (ratio >= 0.8) return "text-[#5ee0a4]";
  if (ratio >= 0.4) return "text-[#f5a524]";
  return "text-[#ff7a8a]";
}

export function StatementsList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [txnsById, setTxnsById] = useState<Record<string, LoadedTxn[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (txnsById[id]) return;
    setLoadingId(id);
    try {
      const r = await fetch(`/api/fd/statements/${id}`);
      if (r.ok) {
        const data = await r.json();
        setTxnsById((prev) => ({ ...prev, [id]: data.transactions ?? [] }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this statement and all its matched transactions?")) return;
    setPendingDelete(id);
    const r = await fetch(`/api/fd/statements/${id}`, { method: "DELETE" });
    setPendingDelete(null);
    if (r.ok) {
      setExpandedId((prev) => (prev === id ? null : prev));
      router.refresh();
    }
  }

  if (items.length === 0) {
    return (
      <div className="ab-card p-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#2a1218] flex items-center justify-center mb-4">
          <Inbox size={24} className="text-[#ff385c]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#ededed] mb-1">No statements yet</h3>
        <p className="text-[13px] text-[#a0a0a5] max-w-sm">
          Upload a bank statement PDF and we&apos;ll match interest credits, maturity events, and transfers to your FDs.
        </p>
      </div>
    );
  }

  const totalTxns = items.reduce((s, i) => s + i.txnCount, 0);
  const totalMatched = items.reduce((s, i) => s + i.matchedCount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Statements" value={items.length} />
        <StatTile label="Transactions" value={totalTxns} />
        <StatTile
          label="Matched"
          value={`${totalMatched}`}
          suffix={totalTxns > 0 ? `/ ${totalTxns}` : undefined}
          tone={matchRateTone(totalMatched, totalTxns)}
        />
      </div>

      <div className="ab-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#6e6e73] bg-[#17171a] border-b border-[#222226]">
                <th className="w-8 py-3"></th>
                <th className="text-left font-medium px-3 py-3">Bank</th>
                <th className="text-left font-medium px-3 py-3">Period</th>
                <th className="text-left font-medium px-3 py-3">Uploaded</th>
                <th className="text-right font-medium px-3 py-3">Transactions</th>
                <th className="text-right font-medium px-3 py-3">Match rate</th>
                <th className="text-right font-medium px-5 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const isDeleting = pendingDelete === s.id;
                const isExpanded = expandedId === s.id;
                const isLoading = loadingId === s.id;
                const rate = s.txnCount > 0 ? Math.round((s.matchedCount / s.txnCount) * 100) : 0;
                const txns = txnsById[s.id] ?? [];
                const nonFdTxns = txns.filter((t) => ["tds", "other", "transfer_in", "transfer_out"].includes(t.type));
                return (
                  <Fragment key={s.id}>
                    <tr
                      className={`border-t border-[#222226] transition-colors cursor-pointer ${
                        isDeleting ? "opacity-40" : isExpanded ? "bg-[#17171a]" : "hover:bg-[#17171a]"
                      }`}
                      onClick={() => toggleExpand(s.id)}
                    >
                      <td className="pl-5 py-3.5">
                        <ChevronRight size={14} className={`text-[#6e6e73] transition-transform ${isExpanded ? "rotate-90 text-[#ededed]" : ""}`} />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
                            <span className="font-bold text-[12px] text-[#ff385c]">{bankInitials(s.bankName)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#ededed] truncate" title={s.bankName}>{s.bankName}</p>
                            <p className="text-[11px] text-[#6e6e73] truncate mt-0.5" title={s.fileName}>{s.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        {s.fromDate ? (
                          <div className="flex items-center gap-1.5 text-[#ededed]">
                            <CalendarDays size={12} className="text-[#6e6e73]" />
                            <span>{formatDate(s.fromDate)}</span>
                            <span className="text-[#6e6e73]">→</span>
                            <span>{formatDate(s.toDate!)}</span>
                          </div>
                        ) : (
                          <span className="text-[#6e6e73]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-[#a0a0a5] whitespace-nowrap">{formatDate(s.uploadedAt)}</td>
                      <td className="px-3 py-3.5 text-right mono font-semibold text-[#ededed]">{s.txnCount}</td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-[#222226] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                rate >= 80 ? "bg-[#5ee0a4]" : rate >= 40 ? "bg-[#f5a524]" : "bg-[#ff7a8a]"
                              }`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className={`mono font-semibold tabular-nums ${matchRateTone(s.matchedCount, s.txnCount)}`}>
                            {s.matchedCount}/{s.txnCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/dashboard/fd/statements/${s.id}`}
                            className="w-8 h-8 rounded-md text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#24242a] inline-flex items-center justify-center transition-colors"
                            title="View statement"
                          >
                            <ExternalLink size={14} />
                          </Link>
                          <a
                            href={`/api/fd/statements/${s.id}/pdf`}
                            className="w-8 h-8 rounded-md text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#24242a] inline-flex items-center justify-center transition-colors"
                            title="Download PDF"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={() => del(s.id)}
                            disabled={isDeleting}
                            className="w-8 h-8 rounded-md text-[#a0a0a5] hover:text-[#ff7a8a] hover:bg-[#2a1218] inline-flex items-center justify-center transition-colors disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#131316]">
                        <td colSpan={7} className="px-5 py-4">
                          {isLoading ? (
                            <div className="flex items-center gap-2 text-[12px] text-[#a0a0a5] py-2">
                              <Loader2 size={12} className="animate-spin" /> Loading transactions…
                            </div>
                          ) : nonFdTxns.length === 0 ? (
                            <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] py-2">
                              <Sparkles size={12} /> No non-FD transactions in this statement.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[11px] uppercase tracking-wider text-[#6e6e73] font-medium">
                                Non-FD transactions ({nonFdTxns.length})
                              </p>
                              <table className="w-full text-[12px]">
                                <thead>
                                  <tr className="text-[10px] uppercase tracking-wider text-[#6e6e73]">
                                    <th className="text-left font-medium py-2">Date</th>
                                    <th className="text-left font-medium py-2">Type</th>
                                    <th className="text-left font-medium py-2">Particulars</th>
                                    <th className="text-right font-medium py-2">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {nonFdTxns.map((t) => {
                                    const meta = NON_FD_TYPE_META[t.type] ?? NON_FD_TYPE_META.other;
                                    const Icon = meta.icon;
                                    const isCredit = t.credit > 0;
                                    return (
                                      <tr key={t.id} className="border-t border-[#1e1e22]">
                                        <td className="py-2 text-[#ededed] whitespace-nowrap">{formatDate(t.txnDate)}</td>
                                        <td className="py-2">
                                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${meta.tone}`}>
                                            <Icon size={10} />
                                            {meta.label}
                                          </span>
                                        </td>
                                        <td className="py-2 text-[#a0a0a5] max-w-[50ch] truncate" title={t.particulars}>{t.particulars}</td>
                                        <td className={`py-2 text-right mono font-semibold whitespace-nowrap ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                                          {isCredit ? "+" : "−"}{formatINR(isCredit ? t.credit : t.debit)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
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

function StatTile({
  label, value, suffix, tone,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: string;
}) {
  return (
    <div className="ab-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-[#6e6e73] font-medium">{label}</p>
      <p className="text-[20px] font-semibold mt-1.5 flex items-baseline gap-1.5">
        <span className={tone ?? "text-[#ededed]"}>{value}</span>
        {suffix && <span className="text-[13px] font-normal text-[#6e6e73]">{suffix}</span>}
      </p>
    </div>
  );
}
