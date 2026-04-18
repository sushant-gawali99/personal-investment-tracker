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
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="font-headline font-bold text-lg text-[#e4e1e6] tracking-tight">Renew Fixed Deposit</h1>
        <p className="text-[#cbc4d0] text-xs mt-0.5">Update the details that changed on renewal.</p>
      </div>

      {/* Previous FD summary */}
      <div className="bg-[#1b1b1e] ghost-border rounded-xl p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-widest font-label text-[#cbc4d0]">Renewing from</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-headline font-bold text-sm text-[#e4e1e6]">{fd.bankName}</p>
            {fd.fdNumber && <p className="text-[11px] text-[#cbc4d0] mono mt-0.5">FD #{fd.fdNumber}</p>}
          </div>
          <div className="text-right">
            <p className="mono text-sm text-[#e4e1e6]">{formatINR(fd.principal)}</p>
            <p className="text-[11px] text-[#cbc4d0] mt-0.5">{fd.interestRate}% · Matures {formatDate(fd.maturityDate)}</p>
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
