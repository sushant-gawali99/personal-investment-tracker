import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { groupBanks } from "@/lib/fd-bank";
import { StatementUploadForm } from "./statement-upload-form";

export default async function NewStatementPage() {
  const userId = await getSessionUserId();
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "", disabled: false },
    select: { bankName: true },
  });
  const banks = groupBanks(fds);
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Upload Bank Statement</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Parse a PDF statement and match transactions to your FDs.</p>
      </div>
      <StatementUploadForm banks={banks} />
    </div>
  );
}
