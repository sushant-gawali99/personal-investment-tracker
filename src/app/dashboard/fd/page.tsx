import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FDList } from "./fd-list";
import { formatINR } from "@/lib/format";
import { getSessionUserId } from "@/lib/session";

export default async function FDPage() {
  const userId = await getSessionUserId();
  const fds = await prisma.fixedDeposit.findMany({
    where: { OR: [{ userId: userId ?? "" }, { userId: "" }] },
    orderBy: { maturityDate: "asc" },
  });

  const totalPrincipal = fds.reduce((s, fd) => s + fd.principal, 0);
  const totalMaturity = fds.reduce((s, fd) => s + (fd.maturityAmount ?? fd.principal), 0);
  const totalInterest = totalMaturity - totalPrincipal;
  const activeFDs = fds.filter((fd) => new Date(fd.maturityDate) > new Date()).length;
  const avgRate = fds.length > 0
    ? fds.reduce((s, fd) => s + fd.interestRate, 0) / fds.length
    : 0;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const interestThisYear = fds.reduce((sum, fd) => {
    const start = new Date(fd.startDate);
    const end = new Date(fd.maturityDate);
    const overlapStart = start < yearStart ? yearStart : start;
    const overlapEnd = end > yearEnd ? yearEnd : end;
    if (overlapStart >= overlapEnd) return sum;
    const days = (overlapEnd.getTime() - overlapStart.getTime()) / 86400000;
    return sum + (fd.principal * fd.interestRate / 100) * (days / 365);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline font-semibold text-lg text-[#e4e1e6] tracking-tight">Fixed Deposits</h1>
          <p className="text-[#cbc4d0] text-xs mt-0.5">Track and analyse your fixed deposit investments.</p>
        </div>
        <Link
          href="/dashboard/fd/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-headline font-bold text-[#00382f] hover:bg-[#26fedc] transition-colors shadow-[0_0_15px_rgba(0,223,193,0.25)]"
        >
          <Plus size={13} />
          Add FD
        </Link>
      </div>

      {/* Stat cards */}
      {fds.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total FD Corpus", value: formatINR(totalMaturity) },
            { label: "Avg Interest Rate", value: `${avgRate.toFixed(2)}%` },
            { label: "Active Deposits", value: String(activeFDs) },
            { label: "Interest This Year", value: formatINR(interestThisYear) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1b1b1e] ghost-border rounded-xl p-3.5">
              <p className="text-[#cbc4d0] text-[10px] uppercase tracking-widest font-label mb-1">{label}</p>
              <p className="mono text-xl font-semibold text-[#e4e1e6]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Interest summary row */}
      {fds.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0e0e11] ghost-border rounded-xl p-4 flex items-center justify-between">
            <p className="text-xs text-[#cbc4d0] uppercase tracking-wider font-label">Total Principal</p>
            <p className="mono font-bold text-[#e4e1e6]">{formatINR(totalPrincipal)}</p>
          </div>
          <div className="bg-[#0e0e11] ghost-border rounded-xl p-4 flex items-center justify-between">
            <p className="text-xs text-[#cbc4d0] uppercase tracking-wider font-label">Total Interest Earned</p>
            <p className="mono font-bold text-primary">{formatINR(totalInterest)}</p>
          </div>
        </div>
      )}

      <FDList fds={fds} />
    </div>
  );
}
