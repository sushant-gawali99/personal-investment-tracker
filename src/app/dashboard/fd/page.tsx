import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FDList } from "./fd-list";
import { formatINR } from "@/lib/format";
import { getSessionUserId } from "@/lib/session";

export default async function FDPage() {
  const userId = await getSessionUserId();
  const rawFds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "" },
    orderBy: { maturityDate: "asc" },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });

  // Resolve each FD to its latest renewal values
  const fds = rawFds.map((fd) => {
    const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
    return {
      ...fd,
      principal: latest?.principal ?? fd.principal,
      interestRate: latest?.interestRate ?? fd.interestRate,
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
      startDate: latest?.startDate ?? fd.startDate,
      maturityDate: latest?.maturityDate ?? fd.maturityDate,
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
    };
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#222222] tracking-tight">Fixed Deposits</h1>
          <p className="text-[14px] text-[#6a6a6a] mt-1">Track and analyse your fixed deposit investments.</p>
        </div>
        <Link
          href="/dashboard/fd/new"
          className="ab-btn ab-btn-accent"
        >
          <Plus size={15} />
          Add FD
        </Link>
      </div>

      {fds.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total FD Corpus", value: formatINR(totalMaturity) },
            { label: "Avg Interest Rate", value: `${avgRate.toFixed(2)}%` },
            { label: "Active Deposits", value: String(activeFDs) },
            { label: "Interest This Year", value: formatINR(interestThisYear) },
          ].map(({ label, value }) => (
            <div key={label} className="ab-card p-4">
              <p className="text-[11px] text-[#6a6a6a] uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className="mono text-[20px] font-semibold text-[#222222]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {fds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="ab-card-flat p-4 flex items-center justify-between">
            <p className="text-[12px] text-[#6a6a6a] uppercase tracking-wider font-semibold">Total Principal</p>
            <p className="mono font-semibold text-[#222222]">{formatINR(totalPrincipal)}</p>
          </div>
          <div className="ab-card-flat p-4 flex items-center justify-between">
            <p className="text-[12px] text-[#6a6a6a] uppercase tracking-wider font-semibold">Total Interest Earned</p>
            <p className="mono font-semibold text-[#00a651]">{formatINR(totalInterest)}</p>
          </div>
        </div>
      )}

      <FDList fds={fds} />
    </div>
  );
}
