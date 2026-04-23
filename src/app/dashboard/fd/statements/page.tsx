import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { StatementsList } from "./statements-list";

export default async function StatementsPage() {
  const userId = await getSessionUserId();
  const items = await prisma.fDStatement.findMany({
    where: { userId: userId ?? "" },
    orderBy: { uploadedAt: "desc" },
  });
  const serialized = items.map((s) => ({
    ...s,
    fromDate: s.fromDate ? s.fromDate.toISOString() : null,
    toDate: s.toDate ? s.toDate.toISOString() : null,
    uploadedAt: s.uploadedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/fd"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#a0a0a5] hover:text-[#ededed] transition-colors font-medium"
      >
        <ArrowLeft size={13} /> Back to Fixed Deposits
      </Link>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Bank Statements</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Upload and review bank statements to match FD interest credits and maturity events.</p>
        </div>
        <Link href="/dashboard/fd/statements/new" className="ab-btn ab-btn-accent">
          <Upload size={15} />
          Upload Statement
        </Link>
      </div>
      <StatementsList items={serialized} />
    </div>
  );
}
