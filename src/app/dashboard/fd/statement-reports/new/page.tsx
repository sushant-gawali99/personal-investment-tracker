import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatementReportForm } from "./statement-report-form";

export default function NewStatementReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/fd/statement-reports"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#9a9aa2] hover:text-[#c8c8d2] transition-colors mb-2"
        >
          <ArrowLeft size={12} />
          Past FD Interest
        </Link>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">New Past FD Interest Report</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          Upload a bank passbook or savings account PDF to extract FD interest history.
        </p>
      </div>
      <StatementReportForm />
    </div>
  );
}
