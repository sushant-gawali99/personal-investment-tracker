"use client";

import { useState } from "react";
import Link from "next/link";
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

      {/* FD cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((fd) => {
          const start = new Date(fd.startDate);
          const maturity = new Date(fd.maturityDate);
          const isMatured = maturity <= now;
          const days = daysUntil(maturity);
          const totalDays = (maturity.getTime() - start.getTime()) / 86400000;
          const elapsedDays = (now.getTime() - start.getTime()) / 86400000;
          const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
          const maturityValue = fd.maturityAmount ?? fd.principal;
          const interest = maturityValue - fd.principal;

          const maturedDaysAgo = isMatured ? Math.floor((now.getTime() - maturity.getTime()) / 86400000) : 0;

          const statusBadge = isMatured ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 flex items-center gap-1 font-headline font-bold">
              <CheckCircle2 size={9} /> Matured
            </span>
          ) : days <= 7 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffafd7]/10 text-[#ffafd7] flex items-center gap-1 font-headline font-bold">
              <AlertTriangle size={9} />{days}d left
            </span>
          ) : days <= 30 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-headline font-bold">{days}d left</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-headline font-bold">{days}d left</span>
          );

          return (
            <Link
              href={`/dashboard/fd/${fd.id}`}
              key={fd.id}
              className={cn(
                "block rounded-xl p-4 space-y-3 transition-colors",
                isMatured
                  ? "bg-amber-400/5 border border-amber-400/25 hover:border-amber-400/40 hover:bg-amber-400/8"
                  : "bg-[#1b1b1e] ghost-border hover:border-[#49454e]/60 hover:bg-[#1f1f22]"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", isMatured ? "bg-amber-400/10" : "bg-[#ffafd7]/10")}>
                    <span className={cn("font-headline font-black text-xs", isMatured ? "text-amber-400" : "text-[#ffafd7]")}>
                      {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-[#e4e1e6]">{fd.bankName}</p>
                    {fd.fdNumber && <p className="text-[10px] text-[#cbc4d0] mono mt-0.5">{fd.fdNumber}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteFD(fd.id); }}
                    disabled={deleting === fd.id}
                    className="p-1.5 rounded-lg hover:bg-[#ffafd7]/10 text-[#cbc4d0] hover:text-[#ffafd7] transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Amount breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Principal", value: formatINR(fd.principal), color: "text-[#e4e1e6]", border: "border-[#49454e]/40" },
                  { label: "Interest", value: `+${formatINR(interest)}`, color: "text-primary", border: "border-primary/30" },
                  { label: "At Maturity", value: formatINR(maturityValue), color: "text-[#d2bcfa]", border: "border-[#d2bcfa]/30" },
                ].map(({ label, value, color, border }) => (
                  <div key={label} className={cn("border-l-2 pl-3", border)}>
                    <p className="text-[9px] text-[#cbc4d0] uppercase tracking-wider font-label">{label}</p>
                    <p className={cn("mono text-sm font-bold mt-0.5", color)}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#cbc4d0]">{formatDate(fd.startDate)}</span>
                  <span className="text-[#e4e1e6] font-headline font-bold">{fd.interestRate}% p.a.</span>
                  <span className="text-[#cbc4d0]">{formatDate(fd.maturityDate)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#2a2a2d] overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isMatured ? "bg-[#49454e]" : "bg-gradient-to-r from-[#ffafd7]/60 to-[#ffafd7]"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-center font-headline font-bold" style={{ color: isMatured ? "rgb(251 191 36)" : undefined }}>
                  {isMatured
                    ? `Matured ${maturedDaysAgo === 0 ? "today" : `${maturedDaysAgo}d ago`} · ready to renew or withdraw`
                    : `${fd.tenureMonths}m tenure · ${Math.round(progress)}% elapsed`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
