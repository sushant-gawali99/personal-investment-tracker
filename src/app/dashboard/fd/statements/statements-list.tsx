"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, Download, ExternalLink, Sparkles, Cpu, CalendarDays, Inbox } from "lucide-react";
import { formatDate } from "@/lib/format";

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

  async function del(id: string) {
    if (!confirm("Delete this statement and all its matched transactions?")) return;
    setPendingDelete(id);
    const r = await fetch(`/api/fd/statements/${id}`, { method: "DELETE" });
    setPendingDelete(null);
    if (r.ok) router.refresh();
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
      {/* Summary strip */}
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

      {/* Table */}
      <div className="ab-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#6e6e73] bg-[#17171a] border-b border-[#222226]">
                <th className="text-left font-medium px-5 py-3">Bank</th>
                <th className="text-left font-medium px-3 py-3">Period</th>
                <th className="text-left font-medium px-3 py-3">Uploaded</th>
                <th className="text-right font-medium px-3 py-3">Transactions</th>
                <th className="text-right font-medium px-3 py-3">Match rate</th>
                <th className="text-left font-medium px-3 py-3">Source</th>
                <th className="text-right font-medium px-5 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const isDeleting = pendingDelete === s.id;
                const rate = s.txnCount > 0 ? Math.round((s.matchedCount / s.txnCount) * 100) : 0;
                return (
                  <tr
                    key={s.id}
                    className={`border-t border-[#222226] transition-colors ${
                      isDeleting ? "opacity-40" : "hover:bg-[#17171a]"
                    }`}
                  >
                    <td className="px-5 py-3.5">
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
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                        s.parseMethod === "ai"
                          ? "bg-[#1a1330] text-[#b79dff] border-[#2a2250]"
                          : "bg-[#0e2236] text-[#5ba8ff] border-[#173152]"
                      }`}>
                        {s.parseMethod === "ai" ? <Sparkles size={10} /> : <Cpu size={10} />}
                        {s.parseMethod === "ai" ? "AI parsed" : "Regex"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
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

