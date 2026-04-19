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
        <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">No fixed deposits added yet</p>
        <p className="text-[14px] text-[#a0a0a5] mt-1.5">Upload an FD certificate to get started.</p>
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
                      "text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold px-4 py-3",
                      i === 2 || i === 3 || i === 7 ? "text-right" : "text-left"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2e]">
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
                      isMatured ? "bg-[#2a1f0d] hover:bg-[#2a1f0d]" : "hover:bg-[#1c1c20]"
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
                    <td className="px-4 py-3 text-right mono text-[#ededed] font-medium">{formatINR(fd.principal)}</td>
                    <td className="px-4 py-3 text-right mono text-[#ededed] font-medium">{fd.interestRate}%</td>
                    <td className="px-4 py-3 text-[#a0a0a5]">{fd.tenureMonths}m</td>
                    <td className="px-4 py-3 text-[#a0a0a5] text-[13px]">{formatDate(fd.startDate)}</td>
                    <td className="px-4 py-3 text-[#a0a0a5] text-[13px]">{formatDate(fd.maturityDate)}</td>
                    <td className="px-4 py-3 text-right mono text-[#ededed] font-semibold">{formatINR(maturityValue)}</td>
                    <td className="px-4 py-3">{statusBadge}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteFD(fd.id); }}
                        disabled={deleting === fd.id}
                        className="p-2 rounded-full hover:bg-[#2a1613] text-[#a0a0a5] hover:text-[#ff7a6e] transition-colors disabled:opacity-40"
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
