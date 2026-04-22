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
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Renew Fixed Deposit</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Update the details that changed on renewal.</p>
      </div>

      <div className="ab-card p-5 space-y-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[#a0a0a5]">Renewing from</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[16px] font-semibold text-[#ededed]">{fd.bankName}</p>
            {fd.fdNumber && <p className="text-[12px] text-[#a0a0a5] mono mt-0.5">FD #{fd.fdNumber}</p>}
          </div>
          <div className="text-right">
            <p className="mono text-[15px] font-semibold text-[#ededed]">{formatINR(fd.principal)}</p>
            <p className="text-[12px] text-[#a0a0a5] mt-0.5">{fd.interestRate}% · Matures {formatDate(fd.maturityDate)}</p>
          </div>
        </div>
      </div>

      <FDRenewForm fd={{
        id: fd.id,
        bankName: fd.bankName,
        principal: fd.principal,
        maturityDate: fd.maturityDate.toISOString(),
        tenureMonths: fd.tenureMonths,
        tenureDays: fd.tenureDays,
        tenureText: fd.tenureText,
        interestRate: fd.interestRate,
        nomineeName: fd.nomineeName,
        nomineeRelation: fd.nomineeRelation,
        maturityInstruction: fd.maturityInstruction,
        payoutFrequency: fd.payoutFrequency,
      }} />
    </div>
  );
}
