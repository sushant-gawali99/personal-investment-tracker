import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUserId, isSupAdmin } from "@/lib/session";
import { formatDate } from "@/lib/format";
import type { FDReportData } from "@/lib/fd-statement-report/types";
import { ReportView } from "./report-view";

export default async function StatementReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [userId, session] = await Promise.all([
    getSessionUserId(),
    getServerSession(authOptions),
  ]);
  const superAdmin = isSupAdmin(session?.user?.email ?? null);

  const report = await prisma.fDStatementReport.findFirst({
    where: { id, userId: userId ?? "" },
  });

  if (!report) notFound();

  const reportData = JSON.parse(report.reportJson) as FDReportData;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/dashboard/fd/statement-reports"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#606065] hover:text-[#a0a0a5] transition-colors mb-2"
          >
            <ArrowLeft size={12} />
            Past FD Interest
          </Link>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">{report.bankName}</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">
            {report.accountHolderName && <span>{report.accountHolderName} · </span>}
            {report.accountNumber && <span>A/C {report.accountNumber} · </span>}
            Added {formatDate(report.createdAt)}
          </p>
        </div>
      </div>

      <ReportView
        reportData={reportData}
        reportId={id}
        isSuperAdmin={superAdmin}
        statementPdfUrl={report.statementPdfUrl ?? undefined}
        bankName={report.bankName}
        accountHolderName={report.accountHolderName ?? undefined}
        accountNumber={report.accountNumber ?? undefined}
        statementFromDate={report.statementFromDate?.toISOString() ?? undefined}
        statementToDate={report.statementToDate?.toISOString() ?? undefined}
        createdAt={report.createdAt.toISOString()}
      />
    </div>
  );
}
