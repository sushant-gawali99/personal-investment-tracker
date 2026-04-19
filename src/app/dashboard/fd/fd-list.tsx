"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatDate, daysUntil } from "@/lib/format";

interface FD {
  id: string;
  bankName: string;
  fdNumber: string | null;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  startDate: Date | string;
  maturityDate: Date | string;
  maturityAmount: number | null;
  interestType: string;
}

type Filter = "all" | "active" | "matured";

export function FDList({ fds }: { fds: FD[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const now = new Date();

  const banks = Array.from(new Set(fds.map((fd) => fd.bankName))).sort();

  const filtered = fds.filter((fd) => {
    const matured = new Date(fd.maturityDate) <= now;
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

  if (fds.length === 0) {
    return (
      <div className="ab-card p-12 text-center">
        <p className="text-[18px] font-semibold text-[#222222] tracking-tight">No fixed deposits added yet</p>
        <p className="text-[14px] text-[#6a6a6a] mt-1.5">Upload an FD certificate to get started.</p>
      </div>
    );
  }

  const counts = {
    all: fds.length,
    active: fds.filter((fd) => new Date(fd.maturityDate) > now).length,
    matured: fds.filter((fd) => new Date(fd.maturityDate) <= now).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 bg-[#f7f7f7] rounded-full w-fit">
          {(["all", "active", "matured"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all capitalize",
                filter === f
                  ? "bg-white text-[#222222] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6a6a6a] hover:text-[#222222]"
              )}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        <select
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          className="bg-white border border-[#c1c1c1] rounded-full px-4 py-2 text-[13px] font-semibold text-[#222222] focus:outline-none focus:border-[#222222] focus:shadow-[0_0_0_1px_#222222] cursor-pointer transition-all"
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
            className="text-[13px] text-[#222222] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="ab-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-[#f7f7f7]">
                {[
                  "Bank",
                  "FD No.",
                  "Principal",
                  "Rate",
                  "Tenure",
                  "Start",
                  "Maturity",
                  "At Maturity",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "text-[11px] text-[#6a6a6a] uppercase tracking-wider font-semibold px-4 py-3",
                      i === 2 || i === 3 || i === 7 ? "text-right" : "text-left"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebebeb]">
              {filtered.map((fd) => {
                const maturity = new Date(fd.maturityDate);
                const isMatured = maturity <= now;
                const days = daysUntil(maturity);
                const maturityValue = fd.maturityAmount ?? fd.principal;
                const maturedDaysAgo = isMatured ? Math.floor((now.getTime() - maturity.getTime()) / 86400000) : 0;

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
                  <tr
                    key={fd.id}
                    onClick={() => router.push(`/dashboard/fd/${fd.id}`)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isMatured ? "bg-[#fffaf0] hover:bg-[#fff4e0]" : "hover:bg-[#f7f7f7]"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#fff5f7] flex items-center justify-center shrink-0">
                          <span className="font-bold text-[11px] text-[#ff385c]">
                            {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold text-[#222222] text-[14px]">{fd.bankName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6a6a6a] mono">{fd.fdNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-right mono text-[#222222] font-medium">{formatINR(fd.principal)}</td>
                    <td className="px-4 py-3 text-right mono text-[#222222] font-medium">{fd.interestRate}%</td>
                    <td className="px-4 py-3 text-[#6a6a6a]">{fd.tenureMonths}m</td>
                    <td className="px-4 py-3 text-[#6a6a6a] text-[13px]">{formatDate(fd.startDate)}</td>
                    <td className="px-4 py-3 text-[#6a6a6a] text-[13px]">{formatDate(fd.maturityDate)}</td>
                    <td className="px-4 py-3 text-right mono text-[#222222] font-semibold">{formatINR(maturityValue)}</td>
                    <td className="px-4 py-3">{statusBadge}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteFD(fd.id); }}
                        disabled={deleting === fd.id}
                        className="p-2 rounded-full hover:bg-[#fdecea] text-[#6a6a6a] hover:text-[#c13515] transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
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
