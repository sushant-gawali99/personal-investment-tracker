import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { FDNewForm } from "./fd-new-form";

export default async function NewFDPage({ searchParams }: { searchParams: Promise<{ renewedFromId?: string; linkTo?: string }> }) {
  const { renewedFromId, linkTo } = await searchParams;
  const userId = await getSessionUserId();

  let renewedFrom = null;
  if (renewedFromId && userId) {
    renewedFrom = await prisma.fixedDeposit.findFirst({
      where: { id: renewedFromId, userId },
      select: { id: true, bankName: true, fdNumber: true, principal: true, maturityDate: true, interestRate: true, tenureMonths: true, nomineeName: true, nomineeRelation: true },
    });
  }

  // linkTo: this new FD will become the "renewedFrom" of the linked FD
  let linkToFd = null;
  if (linkTo && userId) {
    linkToFd = await prisma.fixedDeposit.findFirst({
      where: { id: linkTo, userId },
      select: { id: true, bankName: true, fdNumber: true },
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">
          {renewedFrom ? "Renew Fixed Deposit" : linkToFd ? "Add Previous FD" : "Add Fixed Deposit"}
        </h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          {renewedFrom
            ? `Creating a renewal for ${renewedFrom.bankName}${renewedFrom.fdNumber ? ` · FD #${renewedFrom.fdNumber}` : ""}`
            : linkToFd
            ? `Adding the FD that was renewed into ${linkToFd.bankName}${linkToFd.fdNumber ? ` · FD #${linkToFd.fdNumber}` : ""}`
            : "Upload your FD document for AI extraction, or fill in the details manually."}
        </p>
      </div>
      <FDNewForm renewedFrom={renewedFrom} linkToId={linkToFd?.id} />
    </div>
  );
}
