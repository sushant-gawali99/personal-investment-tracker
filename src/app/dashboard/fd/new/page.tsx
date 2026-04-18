import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { FDNewForm } from "./fd-new-form";

export default async function NewFDPage({ searchParams }: { searchParams: Promise<{ renewedFromId?: string }> }) {
  const { renewedFromId } = await searchParams;
  const userId = await getSessionUserId();

  let renewedFrom = null;
  if (renewedFromId && userId) {
    renewedFrom = await prisma.fixedDeposit.findFirst({
      where: { id: renewedFromId, userId },
      select: { id: true, bankName: true, fdNumber: true, principal: true, maturityDate: true, interestRate: true, tenureMonths: true, nomineeName: true, nomineeRelation: true },
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{renewedFrom ? "Renew Fixed Deposit" : "Add Fixed Deposit"}</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          {renewedFrom
            ? `Creating a renewal for ${renewedFrom.bankName}${renewedFrom.fdNumber ? ` · FD #${renewedFrom.fdNumber}` : ""}`
            : "Upload your FD document for AI extraction, or fill in the details manually."}
        </p>
      </div>
      <FDNewForm renewedFrom={renewedFrom} />
    </div>
  );
}
