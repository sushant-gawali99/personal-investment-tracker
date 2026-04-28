import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatementReportForm } from "./statement-report-form";

export default function NewStatementReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/fd/statement-reports"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#b0b0b8] hover:text-[#dcdce4] transition-colors mb-2"
        >
          <ArrowLeft size={12} />
          Past FD Interest
        </Link>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">New Past FD Interest Report</h1>
        <p className="text-[14px] text-[#dcdce4] mt-1">
          Upload a bank passbook or savings account PDF to extract FD interest history.
        </p>
      </div>
      <StatementReportForm />
    </div>
  );
}
