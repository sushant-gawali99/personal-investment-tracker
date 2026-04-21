import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FDList } from "./fd-list";
import { formatINR } from "@/lib/format";
import { getSessionUserId } from "@/lib/session";

export default async function FDPage() {
  const userId = await getSessionUserId();
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "" },
    orderBy: { maturityDate: "asc" },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });

  // Summary stats resolve each FD to its latest-renewal values for totals.
  const resolved = fds.map((fd) => {
    const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
    return {
      principal: latest?.principal ?? fd.principal,
      interestRate: latest?.interestRate ?? fd.interestRate,
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
      startDate: new Date(latest?.startDate ?? fd.startDate),
      maturityDate: new Date(latest?.maturityDate ?? fd.maturityDate),
    };
  });

  const totalPrincipal = resolved.reduce((s, r) => s + r.principal, 0);
  const totalMaturity = resolved.reduce((s, r) => s + (r.maturityAmount ?? r.principal), 0);
  const totalInterest = totalMaturity - totalPrincipal;
  const activeFDs = resolved.filter((r) => r.maturityDate > new Date()).length;
  const avgRate = resolved.length > 0
    ? resolved.reduce((s, r) => s + r.interestRate, 0) / resolved.length
    : 0;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const interestThisYear = resolved.reduce((sum, r) => {
    const overlapStart = r.startDate < yearStart ? yearStart : r.startDate;
    const overlapEnd = r.maturityDate > yearEnd ? yearEnd : r.maturityDate;
    if (overlapStart >= overlapEnd) return sum;
    const days = (overlapEnd.getTime() - overlapStart.getTime()) / 86400000;
    return sum + (r.principal * r.interestRate / 100) * (days / 365);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Fixed Deposits</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Track and analyse your fixed deposit investments.</p>
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
              <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className="mono text-[20px] font-semibold text-[#ededed]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {fds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="ab-card-flat p-4 flex items-center justify-between">
            <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Principal</p>
            <p className="mono font-semibold text-[#ededed]">{formatINR(totalPrincipal)}</p>
          </div>
          <div className="ab-card-flat p-4 flex items-center justify-between">
            <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Interest Earned</p>
            <p className="mono font-semibold text-[#5ee0a4]">{formatINR(totalInterest)}</p>
          </div>
        </div>
      )}

      <FDList fds={fds} />
    </div>
  );
}
