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
  const [deleting, setDeleting] = useState<string | null>(null);
  const now = new Date();

  const filtered = fds.filter((fd) => {
    const matured = new Date(fd.maturityDate) <= now;
    if (filter === "active") return !matured;
    if (filter === "matured") return matured;
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
      <div className="bg-[#1b1b1e] ghost-border rounded-xl p-10 text-center">
        <p className="font-headline font-bold text-[#e4e1e6]">No fixed deposits added yet.</p>
        <p className="text-[#cbc4d0] text-sm mt-1">Upload an FD certificate to get started.</p>
      </div>
    );
  }

  const counts = {
    all: fds.length,
    active: fds.filter((fd) => new Date(fd.maturityDate) > now).length,
    matured: fds.filter((fd) => new Date(fd.maturityDate) <= now).length,
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#0e0e11] ghost-border rounded-xl w-fit">
        {(["all", "active", "matured"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-headline font-bold transition-colors capitalize",
              filter === f
                ? "bg-primary text-[#00382f] shadow-[0_0_12px_rgba(0,223,193,0.2)]"
                : "text-[#cbc4d0] hover:text-[#e4e1e6]"
            )}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* FD table */}
      <div className="bg-[#1b1b1e] ghost-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(73,69,78,0.2)] bg-[#0e0e11]/40">
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
                      "text-[10px] text-[#cbc4d0] uppercase tracking-widest font-label font-normal px-3 py-2.5",
                      i === 2 || i === 3 || i === 7 ? "text-right" : "text-left"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((fd) => {
                const maturity = new Date(fd.maturityDate);
                const isMatured = maturity <= now;
                const days = daysUntil(maturity);
                const maturityValue = fd.maturityAmount ?? fd.principal;
                const maturedDaysAgo = isMatured ? Math.floor((now.getTime() - maturity.getTime()) / 86400000) : 0;

                const statusBadge = isMatured ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-headline font-bold">
                    <CheckCircle2 size={9} />
                    {maturedDaysAgo === 0 ? "Matured today" : `Matured ${maturedDaysAgo}d ago`}
                  </span>
                ) : days <= 7 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#ffafd7]/10 text-[#ffafd7] font-headline font-bold">
                    <AlertTriangle size={9} />{days}d left
                  </span>
                ) : days <= 30 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-headline font-bold">{days}d left</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-headline font-bold">{days}d left</span>
                );

                return (
                  <tr
                    key={fd.id}
                    onClick={() => router.push(`/dashboard/fd/${fd.id}`)}
                    className={cn(
                      "border-b border-[rgba(73,69,78,0.12)] last:border-0 cursor-pointer transition-colors",
                      isMatured ? "bg-amber-400/[0.03] hover:bg-amber-400/[0.07]" : "hover:bg-[#0e0e11]/50"
                    )}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", isMatured ? "bg-amber-400/10" : "bg-[#ffafd7]/10")}>
                          <span className={cn("font-headline font-black text-[10px]", isMatured ? "text-amber-400" : "text-[#ffafd7]")}>
                            {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                        </div>
                        <span className="font-headline font-bold text-[#e4e1e6] text-xs">{fd.bankName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-[#cbc4d0] mono">{fd.fdNumber ?? "—"}</td>
                    <td className="px-3 py-3 text-right mono text-[#e4e1e6]">{formatINR(fd.principal)}</td>
                    <td className="px-3 py-3 text-right mono text-[#e4e1e6]">{fd.interestRate}%</td>
                    <td className="px-3 py-3 text-[#cbc4d0]">{fd.tenureMonths}m</td>
                    <td className="px-3 py-3 text-[#cbc4d0] text-xs">{formatDate(fd.startDate)}</td>
                    <td className="px-3 py-3 text-[#cbc4d0] text-xs">{formatDate(fd.maturityDate)}</td>
                    <td className="px-3 py-3 text-right mono text-[#d2bcfa] font-bold">{formatINR(maturityValue)}</td>
                    <td className="px-3 py-3">{statusBadge}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteFD(fd.id); }}
                        disabled={deleting === fd.id}
                        className="p-1.5 rounded-lg hover:bg-[#ffafd7]/10 text-[#cbc4d0] hover:text-[#ffafd7] transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={13} />
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
