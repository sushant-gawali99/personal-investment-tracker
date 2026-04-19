import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { FDRenewForm } from "./fd-renew-form";
import { formatINR, formatDate } from "@/lib/format";

export default async function FDRenewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const fd = await prisma.fixedDeposit.findFirst({ where: { id, userId: userId ?? "" } });
  if (!fd) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#222222] tracking-tight">Renew Fixed Deposit</h1>
        <p className="text-[14px] text-[#6a6a6a] mt-1">Update the details that changed on renewal.</p>
      </div>

      <div className="ab-card p-5 space-y-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6a6a6a]">Renewing from</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[16px] font-semibold text-[#222222]">{fd.bankName}</p>
            {fd.fdNumber && <p className="text-[12px] text-[#6a6a6a] mono mt-0.5">FD #{fd.fdNumber}</p>}
          </div>
          <div className="text-right">
            <p className="mono text-[15px] font-semibold text-[#222222]">{formatINR(fd.principal)}</p>
            <p className="text-[12px] text-[#6a6a6a] mt-0.5">{fd.interestRate}% · Matures {formatDate(fd.maturityDate)}</p>
          </div>
        </div>
      </div>

      <FDRenewForm fd={{
        id: fd.id,
        bankName: fd.bankName,
        principal: fd.principal,
        maturityDate: fd.maturityDate.toISOString(),
        tenureMonths: fd.tenureMonths,
        interestRate: fd.interestRate,
        nomineeName: fd.nomineeName,
        nomineeRelation: fd.nomineeRelation,
        maturityInstruction: fd.maturityInstruction,
        payoutFrequency: fd.payoutFrequency,
      }} />
    </div>
  );
}
